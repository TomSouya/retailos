import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
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

  async list(
    actor: Actor,
    query: { status?: string; search?: string; storeId?: string },
  ) {
    ensurePermission(actor, 'orders.read', '查看销售订单')
    const allowed = new Set(
      scopedStores(actor).map((store) => store.id),
    )

    const rows = await this.ordersRepository.find({
      relations: { items: true },
      order: { createdAt: 'DESC' },
    })

    const keyword = String(query.search || '').trim().toLowerCase()
    return rows
      .filter((row) => allowed.has(row.storeId))
      .filter((row) =>
        query.storeId && query.storeId !== 'all'
          ? row.storeId === query.storeId
          : true,
      )
      .filter((row) =>
        query.status && query.status !== 'all'
          ? row.status === query.status
          : true,
      )
      .filter((row) => {
        if (!keyword) return true
        return (
          row.id.toLowerCase().includes(keyword) ||
          row.memberName.toLowerCase().includes(keyword) ||
          row.storeName.toLowerCase().includes(keyword)
        )
      })
      .map(toDto)
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
    const entity = await this.ordersRepository.findOne({
      where: { id },
      relations: { items: true },
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
    const saved = await this.ordersRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '订单退款',
      object: saved.id,
      result: `${saved.status} ¥${amount.toFixed(2)}`,
      approvalId: body.approvalId || '—',
    })

    return toDto(saved)
  }
}
