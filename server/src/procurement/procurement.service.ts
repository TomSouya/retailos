import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, In, Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { InventoryService } from '../inventory/inventory.service'
import { ProductEntity } from '../database/entities/product.entity'
import { PurchaseOrderEntity } from '../database/entities/purchase-order.entity'
import { PurchaseOrderItemEntity } from '../database/entities/purchase-order-item.entity'
import { SupplierEntity } from '../database/entities/supplier.entity'
import { PURCHASE_ORDER_SEED } from '../domain/phase2-data'
import { scopedStores } from '../domain/rbac'
import {
  ensurePermission,
  scopeTypeOf,
} from '../domain/permissions'
import { Actor } from '../domain/types'
import { nextPurchaseStatus } from './transitions'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function formatDate(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function formatDateTime(date: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseDateTime(value: string) {
  if (!value) return null
  const iso = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(iso.length === 16 ? `${iso}:00+08:00` : `${iso}+08:00`)
}

function toDto(entity: PurchaseOrderEntity) {
  return {
    id: entity.id,
    supplierId: entity.supplierId,
    supplierName: entity.supplierName,
    storeId: entity.storeId,
    storeName: entity.storeName,
    status: entity.status,
    totalAmount: Number(entity.totalAmount),
    itemCount: entity.itemCount,
    createdBy: entity.createdBy,
    createdAt: formatDateTime(entity.createdAt),
    approvedBy: entity.approvedBy || '',
    approvedAt: entity.approvedAt
      ? formatDateTime(entity.approvedAt)
      : '',
    receivedAt: entity.receivedAt
      ? formatDateTime(entity.receivedAt)
      : '',
    note: entity.note || '',
    sourceApprovalId: entity.sourceApprovalId || '',
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
export class ProcurementService implements OnModuleInit {
  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly ordersRepository: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderItemEntity)
    private readonly itemsRepository: Repository<PurchaseOrderItemEntity>,
    @InjectRepository(SupplierEntity)
    private readonly suppliersRepository: Repository<SupplierEntity>,
    @InjectRepository(ProductEntity)
    private readonly productsRepository: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    if ((await this.ordersRepository.count()) > 0) return

    for (const seed of PURCHASE_ORDER_SEED) {
      const entity = this.ordersRepository.create({
        ...seed,
        createdAt: parseDateTime(seed.createdAt),
        approvedAt: parseDateTime(seed.approvedAt),
        receivedAt: parseDateTime(seed.receivedAt),
        items: seed.items.map((item) =>
          this.itemsRepository.create({ ...item }),
        ),
      })
      await this.ordersRepository.save(entity)
    }
  }

  async list(
    actor: Actor,
    query: { status?: string; search?: string },
  ) {
    ensurePermission(actor, 'procurement.read', '查看采购单')

    const storeIds = scopedStores(actor).map((store) => store.id)
    if (!storeIds.length) return []

    const where =
      scopeTypeOf(actor.key) === 'global' ? {} : { storeId: In(storeIds) }

    const rows = await this.ordersRepository.find({
      where,
      relations: { items: true },
      order: { createdAt: 'DESC' },
    })

    const keyword = String(query.search || '').trim().toLowerCase()
    return rows
      .filter((row) =>
        query.status && query.status !== 'all'
          ? row.status === query.status
          : true,
      )
      .filter((row) => {
        if (!keyword) return true
        return (
          row.id.toLowerCase().includes(keyword) ||
          row.supplierName.toLowerCase().includes(keyword) ||
          row.storeName.toLowerCase().includes(keyword)
        )
      })
      .map(toDto)
  }

  async create(
    actor: Actor,
    body: {
      supplierId?: string
      storeId?: string
      note?: string
      items?: Array<{
        sku?: string
        name?: string
        quantity?: number
        unitPrice?: number
      }>
    },
  ) {
    ensurePermission(actor, 'procurement.create', '创建采购单')

    const supplier = await this.suppliersRepository.findOne({
      where: { id: String(body.supplierId || '') },
    })
    if (!supplier) throw new BadRequestException('供应商不存在')

    const allowedStores = scopedStores(actor)
    const store = allowedStores.find(
      (item) => item.id === body.storeId,
    )
    if (!store) {
      throw new ForbiddenException('当前角色无权为该门店创建采购单')
    }

    if (!Array.isArray(body.items) || !body.items.length) {
      throw new BadRequestException('采购明细不能为空')
    }

    const items = body.items.map((item) => {
      const quantity = Number(item.quantity)
      const unitPrice = Number(item.unitPrice)
      if (
        !item.sku ||
        !item.name ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        throw new BadRequestException('采购明细不合法')
      }
      return this.itemsRepository.create({
        sku: item.sku,
        name: item.name,
        quantity,
        unitPrice,
        amount: roundMoney(quantity * unitPrice),
      })
    })

    const totalAmount = roundMoney(
      items.reduce((sum, item) => sum + Number(item.amount), 0),
    )

    const entity = this.ordersRepository.create({
      id: `PO-${formatDate()}-${String(Date.now()).slice(-4)}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      storeId: store.id,
      storeName: store.name,
      status: 'draft',
      totalAmount,
      itemCount: items.length,
      createdBy: actor.name,
      createdAt: new Date(),
      approvedBy: null,
      approvedAt: null,
      receivedAt: null,
      note: body.note || '',
      items,
    })

    const saved = await this.ordersRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '创建采购单',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    return toDto(saved)
  }

  async createDraftFromApproval(
    approval: {
      id: string
      storeId: string
      storeName: string
      items: Array<{ sku: string; name: string; quantity: number }>
    },
    operator: string,
    manager?: EntityManager,
  ): Promise<PurchaseOrderEntity> {
    const ordersRepository = manager
      ? manager.getRepository(PurchaseOrderEntity)
      : this.ordersRepository
    const itemsRepository = manager
      ? manager.getRepository(PurchaseOrderItemEntity)
      : this.itemsRepository
    const productsRepository = manager
      ? manager.getRepository(ProductEntity)
      : this.productsRepository
    const suppliersRepository = manager
      ? manager.getRepository(SupplierEntity)
      : this.suppliersRepository

    const existing = await ordersRepository.findOne({
      where: { sourceApprovalId: approval.id },
      relations: { items: true },
    })
    if (existing) return existing

    const supplier =
      (await suppliersRepository.findOne({
        where: { status: 'active' },
        order: { id: 'ASC' },
      })) ||
      (await suppliersRepository.findOne({ order: { id: 'ASC' } }))
    if (!supplier) {
      throw new BadRequestException('没有可用供应商，无法自动生成采购单')
    }

    const items: PurchaseOrderItemEntity[] = []
    for (const approvalItem of approval.items || []) {
      const product = await productsRepository.findOne({
        where: { id: approvalItem.sku },
      })
      const quantity = Math.max(1, Number(approvalItem.quantity) || 0)
      const unitPrice =
        Number(product?.costPrice) || Number(product?.price) || 0
      items.push(
        itemsRepository.create({
          sku: approvalItem.sku,
          name: approvalItem.name || product?.name || approvalItem.sku,
          quantity,
          unitPrice,
          amount: roundMoney(quantity * unitPrice),
        }),
      )
    }
    if (!items.length) {
      throw new BadRequestException('补货申请没有明细，无法生成采购单')
    }

    const totalAmount = roundMoney(
      items.reduce((sum, item) => sum + Number(item.amount), 0),
    )

    const entity = ordersRepository.create({
      id: `PO-${formatDate()}-${String(Date.now()).slice(-4)}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      storeId: approval.storeId,
      storeName: approval.storeName,
      status: 'draft',
      totalAmount,
      itemCount: items.length,
      createdBy: operator,
      createdAt: new Date(),
      approvedBy: null,
      approvedAt: null,
      receivedAt: null,
      note: `由补货申请 ${approval.id} 自动生成，请补充供应商与价格后提交`,
      sourceApprovalId: approval.id,
      items,
    })

    return ordersRepository.save(entity)
  }

  async updateDraft(
    actor: Actor,
    id: string,
    body: {
      supplierId?: string
      note?: string
      items?: Array<{ sku?: string; unitPrice?: number }>
    },
  ) {
    ensurePermission(actor, 'procurement.create', '编辑采购单草稿')

    const entity = await this.ordersRepository.findOne({
      where: { id },
      relations: { items: true },
    })
    if (!entity) throw new NotFoundException('采购单不存在')
    if (entity.status !== 'draft') {
      throw new BadRequestException('只有草稿采购单可以编辑')
    }

    if (scopeTypeOf(actor.key) !== 'global') {
      const storeIds = scopedStores(actor).map((store) => store.id)
      if (!storeIds.includes(entity.storeId)) {
        throw new ForbiddenException('当前角色无权编辑该采购单')
      }
    }

    if (body.supplierId) {
      const supplier = await this.suppliersRepository.findOne({
        where: { id: String(body.supplierId) },
      })
      if (!supplier) throw new BadRequestException('供应商不存在')
      entity.supplierId = supplier.id
      entity.supplierName = supplier.name
    }

    if (body.note !== undefined) {
      entity.note = String(body.note || '').trim().slice(0, 255)
    }

    if (Array.isArray(body.items)) {
      const knownSkus = new Set(entity.items.map((item) => item.sku))
      const priceBySku = new Map<string, number>()
      for (const item of body.items) {
        const sku = String(item.sku || '')
        const unitPrice = Number(item.unitPrice)
        if (!sku || !Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new BadRequestException('采购单价不合法')
        }
        if (!knownSkus.has(sku)) {
          throw new BadRequestException(`采购明细不存在：${sku}`)
        }
        priceBySku.set(sku, unitPrice)
      }

      for (const item of entity.items) {
        const unitPrice = priceBySku.get(item.sku)
        if (unitPrice === undefined) continue
        item.unitPrice = unitPrice
        item.amount = roundMoney(Number(item.quantity) * unitPrice)
      }
    }

    entity.totalAmount = roundMoney(
      entity.items.reduce((sum, item) => sum + Number(item.amount), 0),
    )
    entity.itemCount = entity.items.length

    const saved = await this.ordersRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '编辑采购单草稿',
      object: saved.id,
      result: 'draft',
      approvalId: saved.sourceApprovalId || '—',
    })

    return toDto(saved)
  }

  async transition(
    actor: Actor,
    id: string,
    action: 'submit' | 'approve' | 'receive',
  ) {
    const entity = await this.ordersRepository.findOne({
      where: { id },
      relations: { items: true },
    })
    if (!entity) throw new NotFoundException('采购单不存在')

    if (scopeTypeOf(actor.key) !== 'global') {
      const storeIds = scopedStores(actor).map((store) => store.id)
      if (!storeIds.includes(entity.storeId)) {
        throw new ForbiddenException('当前角色无权操作该采购单')
      }
    }

    if (action === 'submit') {
      ensurePermission(actor, 'procurement.create', '提交采购单')
      entity.status = nextPurchaseStatus(entity.status, 'submit')
    } else if (action === 'approve') {
      ensurePermission(actor, 'procurement.approve', '审批采购单')
      entity.status = nextPurchaseStatus(entity.status, 'approve')
      entity.approvedBy = actor.name
      entity.approvedAt = new Date()
    } else if (action === 'receive') {
      ensurePermission(actor, 'procurement.receive', '采购到货验收')
      nextPurchaseStatus(entity.status, 'receive')
    } else {
      throw new BadRequestException('未知操作')
    }

    let saved: PurchaseOrderEntity
    if (action === 'receive') {
      // 事务内锁定采购单并复检状态，保证并发验收只入库一次
      saved = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(PurchaseOrderEntity)
        const locked = await repository.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        })
        if (!locked) throw new NotFoundException('采购单不存在')
        nextPurchaseStatus(locked.status, 'receive')

        const items = await manager
          .getRepository(PurchaseOrderItemEntity)
          .find({ where: { purchaseOrder: { id } } })

        locked.status = 'received'
        locked.receivedAt = new Date()
        const received = await repository.save(locked)

        await this.inventoryService.applyPurchaseReceipt(
          manager,
          { ...received, items },
          actor,
        )
        return { ...received, items }
      })
    } else {
      saved = await this.ordersRepository.save(entity)
    }

    const actionText = {
      submit: '提交采购单',
      approve: '审批通过采购单',
      receive: '采购到货验收',
    }[action]

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: actionText,
      object: saved.id,
      result: saved.status,
      approvalId: '—',
    })

    return toDto(saved)
  }
}
