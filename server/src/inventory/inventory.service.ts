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
import { INVENTORY } from '../domain/data'
import { scopedStores } from '../domain/rbac'
import { ensurePermission } from '../domain/permissions'
import { Actor } from '../domain/types'
import { InventoryItemEntity } from '../database/entities/inventory-item.entity'
import { ProductEntity } from '../database/entities/product.entity'
import { PurchaseOrderEntity } from '../database/entities/purchase-order.entity'
import { StockMovementEntity } from '../database/entities/stock-movement.entity'

const TYPE_LABELS = {
  purchase_received: '采购入库',
  replenishment_out: '补货出库',
  adjustment: '库存调整',
}

const MOVEMENT_SEED = [
  {
    id: 'MV-SEED-001',
    storeId: 'S001',
    storeName: '静安店',
    sku: 'SKU-1001',
    name: '有机鲜牛奶 950ml',
    type: 'purchase_received',
    quantity: 18,
    beforeStock: 0,
    afterStock: 18,
    refId: 'PO-20261115-001',
    operator: '顾岩',
    note: '期初采购入库',
    createdAt: '2026-11-15 08:30',
  },
  {
    id: 'MV-SEED-002',
    storeId: 'S001',
    storeName: '静安店',
    sku: 'SKU-1002',
    name: '云南蓝莓 125g',
    type: 'purchase_received',
    quantity: 6,
    beforeStock: 0,
    afterStock: 6,
    refId: 'PO-20261118-001',
    operator: '顾岩',
    note: '生鲜到货验收',
    createdAt: '2026-11-18 09:40',
  },
  {
    id: 'MV-SEED-003',
    storeId: 'S001',
    storeName: '静安店',
    sku: 'SKU-1006',
    name: '冷萃咖啡 280ml',
    type: 'replenishment_out',
    quantity: -12,
    beforeStock: 12,
    afterStock: 0,
    refId: 'AP-20261120-009',
    operator: '周然',
    note: '门店间调拨出库',
    createdAt: '2026-11-20 16:10',
  },
]

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDate(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
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

function statusOf(stock: number, safetyStock: number) {
  if (stock <= 0) return 'out'
  if (stock < safetyStock) return 'low'
  return 'normal'
}

function toItemDto(entity: InventoryItemEntity, storeName = '') {
  return {
    id: entity.sku,
    sku: entity.sku,
    storeId: entity.storeId,
    storeName,
    name: entity.name,
    category: entity.category,
    stock: entity.stock,
    safetyStock: entity.safetyStock,
    unit: entity.unit,
    price: Number(entity.price),
    status: statusOf(entity.stock, entity.safetyStock),
    updatedAt: formatDateTime(entity.updatedAt),
  }
}

function toMovementDto(entity: StockMovementEntity) {
  return {
    id: entity.id,
    storeId: entity.storeId,
    storeName: entity.storeName,
    sku: entity.sku,
    name: entity.name,
    type: entity.type,
    typeLabel: TYPE_LABELS[entity.type] || entity.type,
    quantity: entity.quantity,
    beforeStock: entity.beforeStock,
    afterStock: entity.afterStock,
    refId: entity.refId,
    operator: entity.operator,
    note: entity.note || '',
    createdAt: formatDateTime(entity.createdAt),
  }
}

@Injectable()
export class InventoryService implements OnModuleInit {
  constructor(
    @InjectRepository(InventoryItemEntity)
    private readonly inventoryRepository: Repository<InventoryItemEntity>,
    @InjectRepository(StockMovementEntity)
    private readonly movementsRepository: Repository<StockMovementEntity>,
    @InjectRepository(ProductEntity)
    private readonly productsRepository: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    if ((await this.inventoryRepository.count()) === 0) {
      const now = new Date()
      await this.inventoryRepository.save(
        INVENTORY.map((item) =>
          this.inventoryRepository.create({
            storeId: item.storeId,
            sku: item.id,
            name: item.name,
            category: item.category,
            stock: item.stock,
            safetyStock: item.safetyStock,
            unit: item.unit,
            price: item.price,
            updatedAt: now,
          }),
        ),
      )
    }

    if ((await this.movementsRepository.count()) === 0) {
      await this.movementsRepository.save(
        MOVEMENT_SEED.map((item) =>
          this.movementsRepository.create({
            ...item,
            createdAt: parseDateTime(item.createdAt),
          }),
        ),
      )
    }
  }

  async list(
    actor: Actor,
    query: { search?: string; category?: string; status?: string; storeId?: string },
  ) {
    ensurePermission(actor, 'inventory.read', '查看库存')

    const scoped = scopedStores(actor)
    const storeIds = scoped.map((store) => store.id)
    if (!storeIds.length) return []
    const storeNames = new Map(
      scoped.map((store) => [store.id, store.name]),
    )

    const rows = await this.inventoryRepository.find({
      where:
        actor.key === 'owner' ? {} : { storeId: In(storeIds) },
      order: { storeId: 'ASC', name: 'ASC' },
    })

    const keyword = String(query.search || '').trim().toLowerCase()
    return rows
      .filter((row) =>
        query.storeId && query.storeId !== 'all'
          ? row.storeId === query.storeId
          : true,
      )
      .filter((row) =>
        query.category && query.category !== 'all'
          ? row.category === query.category
          : true,
      )
      .filter((row) =>
        query.status && query.status !== 'all'
          ? statusOf(row.stock, row.safetyStock) === query.status
          : true,
      )
      .filter((row) => {
        if (!keyword) return true
        return (
          row.name.toLowerCase().includes(keyword) ||
          row.sku.toLowerCase().includes(keyword)
        )
      })
      .map((row) =>
        toItemDto(row, storeNames.get(row.storeId) || ''),
      )
  }

  async movements(
    actor: Actor,
    query: { storeId?: string; sku?: string; limit?: number },
  ) {
    ensurePermission(actor, 'inventory.read', '查看库存流水')
    const storeIds = scopedStores(actor).map((store) => store.id)
    if (!storeIds.length) return []

    const rows = await this.movementsRepository.find({
      where: actor.key === 'owner' ? {} : { storeId: In(storeIds) },
      order: { createdAt: 'DESC' },
      take: Math.min(Number(query.limit) || 50, 100),
    })

    return rows
      .filter((row) =>
        query.storeId && query.storeId !== 'all'
          ? row.storeId === query.storeId
          : true,
      )
      .filter((row) =>
        query.sku ? row.sku === query.sku : true,
      )
      .map(toMovementDto)
  }

  async adjust(
    actor: Actor,
    sku: string,
    body: { storeId?: string; delta?: number; reason?: string },
  ) {
    ensurePermission(actor, 'inventory.adjust', '调整库存')

    const storeId = String(body.storeId || '')
    const delta = Number(body.delta)
    const reason = String(body.reason || '').trim()

    if (!storeId || !sku) {
      throw new BadRequestException('门店与 SKU 不能为空')
    }
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('调整数量必须为非零整数')
    }
    if (Math.abs(delta) > 100000) {
      throw new BadRequestException('单次调整数量不能超过 100000')
    }
    if (!reason) throw new BadRequestException('请填写调整原因')
    if (reason.length > 200) {
      throw new BadRequestException('调整原因不能超过 200 字')
    }

    const store = scopedStores(actor).find((item) => item.id === storeId)
    if (!store) {
      throw new ForbiddenException('当前角色无权调整该门店库存')
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const inventoryRepository = manager.getRepository(InventoryItemEntity)
      const movementRepository = manager.getRepository(StockMovementEntity)

      const item = await inventoryRepository.findOne({
        where: { storeId, sku },
      })
      if (!item) {
        throw new NotFoundException('该门店没有此 SKU 的库存记录')
      }

      const beforeStock = Number(item.stock)
      const afterStock = beforeStock + delta
      if (afterStock < 0) {
        throw new BadRequestException(
          `调整后库存不能为负（当前 ${beforeStock}）`,
        )
      }

      item.stock = afterStock
      item.updatedAt = new Date()
      await inventoryRepository.save(item)

      const movement = movementRepository.create({
        id: `MV-${formatDate()}-${String(Date.now()).slice(-6)}`,
        storeId,
        storeName: store.name,
        sku,
        name: item.name,
        type: 'adjustment',
        quantity: delta,
        beforeStock,
        afterStock,
        refId: `ADJ-${formatDate()}-${String(Date.now()).slice(-4)}`,
        operator: actor.name,
        note: reason,
        createdAt: new Date(),
      })
      const savedMovement = await movementRepository.save(movement)

      return { item, movement: savedMovement }
    })

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '库存调整',
      object: `${storeId}/${sku}`,
      result: 'success',
      approvalId: '—',
    })

    return {
      item: toItemDto(result.item),
      movement: toMovementDto(result.movement),
    }
  }

  async applyPurchaseReceipt(
    manager: EntityManager,
    order: PurchaseOrderEntity,
    actor: Actor,
  ) {
    const inventoryRepository = manager.getRepository(InventoryItemEntity)
    const movementRepository = manager.getRepository(StockMovementEntity)
    const productRepository = manager.getRepository(ProductEntity)

    for (const item of order.items || []) {
      const product = await productRepository.findOne({
        where: { id: item.sku },
      })

      const existing = await inventoryRepository.findOne({
        where: { storeId: order.storeId, sku: item.sku },
      })

      const beforeStock = existing?.stock || 0
      const afterStock = beforeStock + Number(item.quantity)

      if (existing) {
        existing.stock = afterStock
        existing.price = Number(item.unitPrice)
        existing.updatedAt = new Date()
        await inventoryRepository.save(existing)
      } else {
        await inventoryRepository.save(
          inventoryRepository.create({
            storeId: order.storeId,
            sku: item.sku,
            name: item.name,
            category: product?.category || '未分类',
            stock: afterStock,
            safetyStock: product?.safetyStock || 0,
            unit: product?.unit || '件',
            price: Number(item.unitPrice),
            updatedAt: new Date(),
          }),
        )
      }

      await movementRepository.save(
        movementRepository.create({
          id: `MV-${formatDate()}-${String(Date.now()).slice(-6)}`,
          storeId: order.storeId,
          storeName: order.storeName,
          sku: item.sku,
          name: item.name,
          type: 'purchase_received',
          quantity: Number(item.quantity),
          beforeStock,
          afterStock,
          refId: order.id,
          operator: actor.name,
          note: `采购单 ${order.id} 到货`,
          createdAt: new Date(),
        }),
      )
    }
  }
}
