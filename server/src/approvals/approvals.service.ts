import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, DataSource, Repository } from 'typeorm'
import { INITIAL_APPROVALS, STORES } from '../domain/data'
import {
  hasPermission,
  scopeTypeOf,
} from '../domain/permissions'
import { Actor, Approval, Risk } from '../domain/types'
import { ApprovalEntity } from '../database/entities/approval.entity'
import { ApprovalItemEntity } from '../database/entities/approval-item.entity'
import { AuditService } from '../audit/audit.service'
import { OrdersService } from '../orders/orders.service'
import { ProcurementService } from '../procurement/procurement.service'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date, withSeconds = false) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base
}

function formatDate(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function parseDateTime(value: string) {
  if (!value) return new Date()
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(iso.length === 16 ? `${iso}:00+08:00` : `${iso}+08:00`)
}

function toApprovalDto(entity: ApprovalEntity): Approval {
  return {
    id: entity.id,
    type: entity.type as Approval['type'],
    storeId: entity.storeId,
    storeName: entity.storeName,
    requester: entity.requester,
    risk: entity.risk as Risk,
    status: entity.status as Approval['status'],
    createdAt: formatDateTime(entity.createdAt),
    items: (entity.items || []).map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
    })),
    summary: entity.summary || undefined,
    params: entity.params || undefined,
    expiresAt: entity.expiresAt || undefined,
    decidedAt: entity.decidedAt
      ? formatDateTime(entity.decidedAt)
      : undefined,
    decidedBy: entity.decidedBy || undefined,
  }
}

@Injectable()
export class ApprovalsService implements OnModuleInit {
  constructor(
    @InjectRepository(ApprovalEntity)
    private readonly approvalsRepository: Repository<ApprovalEntity>,
    @InjectRepository(ApprovalItemEntity)
    private readonly itemsRepository: Repository<ApprovalItemEntity>,
    private readonly auditService: AuditService,
    private readonly ordersService: OrdersService,
    private readonly procurementService: ProcurementService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    const approvalCount = await this.approvalsRepository.count()
    if (approvalCount === 0) {
      for (const seed of INITIAL_APPROVALS) {
        const entity = this.approvalsRepository.create({
          ...seed,
          createdAt: parseDateTime(seed.createdAt),
          items: seed.items.map((item) =>
            this.itemsRepository.create({ ...item }),
          ),
        })
        await this.approvalsRepository.save(entity)
      }
    }
  }

  async list(actor: Actor): Promise<Approval[]> {
    let where: Record<string, any> = {}
    const scopeType = scopeTypeOf(actor.key)

    if (scopeType === 'region') {
      const storeIds = STORES.filter(
        (store) => store.region === actor.region,
      ).map((store) => store.id)
      if (!storeIds.length) return []
      where = { storeId: In(storeIds) }
    } else if (scopeType === 'store') {
      where = { storeId: actor.storeId }
    }

    const rows = await this.approvalsRepository.find({
      where,
      relations: { items: true },
      order: { createdAt: 'DESC' },
    })
    return rows.map(toApprovalDto)
  }

  async create(body: {
    actor: Actor
    storeId: string
    storeName?: string
    risk?: Risk
    items: Array<{ sku: string; name: string; quantity: number }>
    summary?: string
    params?: Record<string, any>
    expiresAt?: string
  }): Promise<Approval> {
    const { actor } = body
    if (!hasPermission(actor, 'inventory.replenish')) {
      throw new ForbiddenException('当前角色不能发起补货申请')
    }
    if (!body.storeId || !Array.isArray(body.items) || !body.items.length) {
      throw new BadRequestException('storeId 与 items 不能为空')
    }
    if (scopeTypeOf(actor.key) === 'store' && actor.storeId !== body.storeId) {
      throw new ForbiddenException('当前角色只能为本店发起补货申请')
    }

    const store = STORES.find((entry) => entry.id === body.storeId)
    if (!store) throw new BadRequestException('门店不存在')

    const entity = this.approvalsRepository.create({
      id: `AP-${formatDate()}-${String(Date.now()).slice(-6)}`,
      type: 'replenishment',
      storeId: body.storeId,
      storeName: body.storeName || store.name,
      requester: actor.name,
      risk: body.risk || 'medium',
      status: 'pending',
      createdAt: new Date(),
      summary:
        body.summary ||
        `为${store.name}创建 ${body.items.length} 个 SKU 的补货申请`,
      params: body.params,
      expiresAt: body.expiresAt,
      items: body.items.map((item) =>
        this.itemsRepository.create({ ...item }),
      ),
    })

    const saved = await this.approvalsRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '提交补货申请',
      object: saved.id,
      result: 'submitted',
      approvalId: saved.id,
    })

    return toApprovalDto(saved)
  }

  async requestRefund(
    actor: Actor,
    orderId: string,
    body: { amount?: number; reason?: string },
  ): Promise<Approval> {
    if (!hasPermission(actor, 'orders.refund_request')) {
      throw new ForbiddenException('当前角色不能发起退款申请')
    }

    const order = await this.ordersService.detail(actor, orderId)
    if (!['paid', 'partially_refunded'].includes(order.status)) {
      throw new BadRequestException('只有已支付或部分退款的订单可以申请退款')
    }

    const refundable = Number(order.refundableAmount)
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

    const pendingRefunds = await this.approvalsRepository.find({
      where: { type: 'refund', status: 'pending' },
    })
    if (pendingRefunds.some((item) => item.params?.orderId === orderId)) {
      throw new BadRequestException('该订单已有待审批的退款申请')
    }

    const entity = this.approvalsRepository.create({
      id: `AP-${formatDate()}-${String(Date.now()).slice(-6)}`,
      type: 'refund',
      storeId: order.storeId,
      storeName: order.storeName,
      requester: actor.name,
      risk: amount >= Number(order.amount) * 0.8 ? 'high' : 'medium',
      status: 'pending',
      createdAt: new Date(),
      summary: `订单 ${order.id} 退款 ¥${amount.toFixed(2)}：${reason}`,
      params: {
        orderId: order.id,
        amount,
        reason,
        orderAmount: Number(order.amount),
        memberName: order.memberName,
      },
      items: [],
    })

    const saved = await this.approvalsRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '提交退款申请',
      object: saved.id,
      result: 'submitted',
      approvalId: saved.id,
    })

    return toApprovalDto(saved)
  }

  async decide(
    id: string,
    decision: 'approved' | 'rejected',
    actor: Actor,
  ): Promise<Approval> {
    if (!hasPermission(actor, 'procurement.approve')) {
      throw new ForbiddenException('当前角色不能审批申请')
    }

    const approval = await this.approvalsRepository.findOne({
      where: { id },
      relations: { items: true },
    })
    if (!approval) throw new NotFoundException('申请不存在')
    if (approval.status !== 'pending') {
      throw new BadRequestException('该申请已处理')
    }
    if (scopeTypeOf(actor.key) === 'region') {
      const store = STORES.find((entry) => entry.id === approval.storeId)
      if (store?.region !== actor.region) {
        throw new ForbiddenException(`只能审批${actor.region}区域的申请`)
      }
    } else if (scopeTypeOf(actor.key) === 'store') {
      if (approval.storeId !== actor.storeId) {
        throw new ForbiddenException('只能审批所属门店的申请')
      }
    }

    const isRefund = approval.type === 'refund'
    if (isRefund && decision === 'approved') {
      const params = approval.params || {}
      await this.ordersService.applyRefund(actor, params.orderId, {
        amount: Number(params.amount),
        reason: params.reason,
        approvalId: approval.id,
      })
    }

    approval.status = decision
    approval.decidedAt = new Date()
    approval.decidedBy = actor.name

    let saved: ApprovalEntity
    let purchaseOrderId = ''

    if (!isRefund && decision === 'approved') {
      const result = await this.dataSource.transaction(async (manager) => {
        const order = await this.procurementService.createDraftFromApproval(
          approval,
          actor.name,
          manager,
        )
        approval.params = {
          ...(approval.params || {}),
          purchaseOrderId: order.id,
        }
        const record = await manager
          .getRepository(ApprovalEntity)
          .save(approval)
        return { record, order }
      })
      saved = result.record
      purchaseOrderId = result.order.id
    } else {
      saved = await this.approvalsRepository.save(approval)
    }

    const action = isRefund ? '退款申请' : '补货申请'
    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: decision === 'approved' ? `审批通过${action}` : `驳回${action}`,
      object: saved.id,
      result: decision,
      approvalId: saved.id,
    })

    if (purchaseOrderId) {
      await this.auditService.record({
        actor: actor.name,
        role: actor.label,
        action: '自动生成采购单草稿',
        object: purchaseOrderId,
        result: 'draft',
        approvalId: saved.id,
      })
    }

    return toApprovalDto(saved)
  }
}
