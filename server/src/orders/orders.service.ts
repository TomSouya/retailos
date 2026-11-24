import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { SalesOrderEntity } from '../database/entities/sales-order.entity'
import { SalesOrderItemEntity } from '../database/entities/sales-order-item.entity'
import { SALES_ORDER_SEED } from '../domain/phase2-data'
import { scopedStores } from '../domain/rbac'
import { ensurePermission } from '../domain/permissions'
import { Actor } from '../domain/types'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseDateTime(value: string) {
  if (!value) return new Date()
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(iso.length === 16 ? `${iso}:00+08:00` : `${iso}+08:00`)
}

function toDto(entity: SalesOrderEntity) {
  const amount = Number(entity.amount)
  const refundedAmount = Number(entity.refundedAmount || 0)
  return {
    id: entity.id,
    storeId: entity.storeId,
    storeName: entity.storeName,
    memberName: entity.memberName,
    itemCount: entity.itemCount,
    amount,
    refundedAmount,
    refundableAmount: Math.round((amount - refundedAmount) * 100) / 100,
    refundReason: entity.refundReason || '',
    paymentMethod: entity.paymentMethod,
    status: entity.status,
    createdAt: formatDateTime(entity.createdAt),
    items: (entity.items || []).map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
    })),
  }
}

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    @InjectRepository(SalesOrderEntity)
    private readonly ordersRepository: Repository<SalesOrderEntity>,
    @InjectRepository(SalesOrderItemEntity)
    private readonly itemsRepository: Repository<SalesOrderItemEntity>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    if ((await this.ordersRepository.count()) > 0) return

    for (const seed of SALES_ORDER_SEED) {
      const entity = this.ordersRepository.create({
        ...seed,
        createdAt: parseDateTime(seed.createdAt),
        items: seed.items.map((item) =>
          this.itemsRepository.create({ ...item }),
        ),
      })
      await this.ordersRepository.save(entity)
    }
  }

  private scopedQuery(
    actor: Actor,
    query: { status?: string; search?: string; storeId?: string },
  ) {
    ensurePermission(actor, 'orders.read', '查看销售订单')
    const allowed = scopedStores(actor).map((store) => store.id)
    if (!allowed.length) {
      throw new ForbiddenException('当前角色没有可查看的门店')
    }

    const builder = this.ordersRepository
      .createQueryBuilder('orders')
      .where('orders.storeId IN (:...storeIds)', { storeIds: allowed })

    if (query.storeId && query.storeId !== 'all') {
      builder.andWhere('orders.storeId = :storeId', {
        storeId: query.storeId,
      })
    }
    if (query.status && query.status !== 'all') {
      builder.andWhere('orders.status = :status', { status: query.status })
    }

    const keyword = String(query.search || '').trim()
    if (keyword) {
      builder.andWhere(
        '(orders.id LIKE :keyword OR orders.memberName LIKE :keyword OR orders.storeName LIKE :keyword)',
        { keyword: `%${keyword}%` },
      )
    }

    return builder.orderBy('orders.createdAt', 'DESC')
  }

  async list(
    actor: Actor,
    query: { status?: string; search?: string; storeId?: string },
  ) {
    const rows = await this.scopedQuery(actor, query).getMany()
    return rows.map(toDto)
  }

  async page(
    actor: Actor,
    query: {
      status?: string
      search?: string
      storeId?: string
      page?: number
      pageSize?: number
    },
  ) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1))
    const pageSize = Math.min(
      50,
      Math.max(1, Math.floor(Number(query.pageSize) || 10)),
    )

    const [rows, total] = await this.scopedQuery(actor, query)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount()

    const raw = await this.scopedQuery(actor, query)
      .select('COUNT(*)', 'total')
      .addSelect(
        "COALESCE(SUM(CASE WHEN orders.status = 'paid' THEN 1 ELSE 0 END), 0)",
        'paid',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN orders.status IN ('refunded', 'partially_refunded') THEN 1 ELSE 0 END), 0)",
        'refunded',
      )
      .addSelect('COALESCE(SUM(orders.amount), 0)', 'amount')
      .getRawOne()

    return {
      orders: rows.map(toDto),
      total,
      page,
      pageSize,
      summary: {
        total: Number(raw?.total || 0),
        paid: Number(raw?.paid || 0),
        refunded: Number(raw?.refunded || 0),
        amount: Number(raw?.amount || 0),
      },
    }
  }

  async detail(actor: Actor, id: string) {
    ensurePermission(actor, 'orders.read', '查看销售订单')
    const entity = await this.ordersRepository.findOne({
      where: { id },
      relations: { items: true },
    })
    if (!entity) throw new NotFoundException('订单不存在')

    const allowed = new Set(
      scopedStores(actor).map((store) => store.id),
    )
    if (!allowed.has(entity.storeId)) {
      throw new ForbiddenException('当前角色无权查看该订单')
    }

    return toDto(entity)
  }

  async applyRefund(
    actor: Actor,
    id: string,
    body: { amount?: number; reason?: string; approvalId?: string },
  ) {
    ensurePermission(actor, 'orders.refund', '处理退款')

    // 事务内用行锁读取订单，避免并发退款各自通过可退金额校验
    const refundResult = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SalesOrderEntity)
      const entity = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      })
      if (!entity) throw new NotFoundException('订单不存在')

      const allowed = new Set(
        scopedStores(actor).map((store) => store.id),
      )
      if (!allowed.has(entity.storeId)) {
        throw new ForbiddenException('当前角色无权处理该订单')
      }
      if (!['paid', 'partially_refunded'].includes(entity.status)) {
        throw new BadRequestException('只有已支付或部分退款的订单可以退款')
      }

      const total = Number(entity.amount)
      const refunded = Number(entity.refundedAmount || 0)
      const refundable = Math.round((total - refunded) * 100) / 100
      const amount =
        body.amount === undefined || body.amount === null
          ? refundable
          : Number(body.amount)

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('退款金额不合法')
      }
      if (amount > refundable + 0.001) {
        throw new BadRequestException(`退款金额不能超过可退金额 ¥${refundable}`)
      }

      const reason = String(body.reason || '').trim()
      if (!reason) throw new BadRequestException('请填写退款原因')
      if (reason.length > 200) {
        throw new BadRequestException('退款原因不能超过 200 字')
      }

      entity.refundedAmount = Math.round((refunded + amount) * 100) / 100
      entity.refundReason = reason
      entity.status =
        entity.refundedAmount >= total ? 'refunded' : 'partially_refunded'
      const saved = await repository.save(entity)

      return { id: saved.id, status: saved.status, amount }
    })

    const detail = await this.ordersRepository.findOne({
      where: { id: refundResult.id },
      relations: { items: true },
    })
    if (!detail) throw new NotFoundException('订单不存在')

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '订单退款',
      object: refundResult.id,
      result: `${refundResult.status} ¥${refundResult.amount.toFixed(2)}`,
      approvalId: body.approvalId || '—',
    })

    return toDto(detail)
  }
}
