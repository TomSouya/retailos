import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { AuditService } from '../audit/audit.service'
import { StoreEntity } from '../database/entities/store.entity'
import { SalesOrderEntity } from '../database/entities/sales-order.entity'
import { InventoryItemEntity } from '../database/entities/inventory-item.entity'
import { STORES } from '../domain/data'
import { STORE_SEED } from '../domain/profile-data'
import { scopedStores } from '../domain/rbac'
import {
  ensurePermission,
  scopeTypeOf,
} from '../domain/permissions'
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

@Injectable()
export class StoresService implements OnModuleInit {
  constructor(
    @InjectRepository(StoreEntity)
    private readonly storesRepository: Repository<StoreEntity>,
    @InjectRepository(SalesOrderEntity)
    private readonly ordersRepository: Repository<SalesOrderEntity>,
    @InjectRepository(InventoryItemEntity)
    private readonly inventoryRepository: Repository<InventoryItemEntity>,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    if ((await this.storesRepository.count()) === 0) {
      const now = new Date()
      await this.storesRepository.save(
        STORE_SEED.map((store) =>
          this.storesRepository.create({ ...store, updatedAt: now }),
        ),
      )
    }

    // 把数据库门店同步到内存 STORES，保证新建门店也能被 RBAC 范围识别
    const rows = await this.storesRepository.find({ order: { id: 'ASC' } })
    for (const row of rows) {
      const existing = STORES.find((store) => store.id === row.id)
      if (existing) {
        existing.name = row.name
        existing.city = row.city
        existing.region = row.region
        existing.manager = row.manager
        existing.status = row.status
      } else {
        STORES.push({
          id: row.id,
          name: row.name,
          city: row.city,
          region: row.region,
          sales: 0,
          orders: 0,
          aov: 0,
          delta: 0,
          status: row.status,
          manager: row.manager,
        })
      }
    }
  }

  private async nextStoreId() {
    const rows = await this.storesRepository.find()
    const max = rows.reduce((current, row) => {
      const matched = /^S(\d+)$/.exec(row.id)
      return matched ? Math.max(current, Number(matched[1])) : current
    }, 0)
    return `S${String(max + 1).padStart(3, '0')}`
  }

  async create(
    actor: Actor,
    body: {
      name?: string
      city?: string
      region?: string
      manager?: string
      phone?: string
      openedAt?: string
    },
  ) {
    ensurePermission(actor, 'stores.write', '新增门店')

    const name = String(body.name || '').trim()
    const city = String(body.city || '').trim()
    const region = String(body.region || '').trim()
    const manager = String(body.manager || '').trim()
    const phone = String(body.phone || '').trim()
    const openedAt = String(body.openedAt || '').trim()

    if (!name || !city || !region || !manager || !phone) {
      throw new BadRequestException('门店名称、城市、区域、店长和电话不能为空')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(openedAt)) {
      throw new BadRequestException('开业时间格式应为 YYYY-MM-DD')
    }
    if (scopeTypeOf(actor.key) !== 'global' && region !== actor.region) {
      throw new ForbiddenException(`只能在${actor.region}区域新增门店`)
    }

    const duplicate = await this.storesRepository.findOne({
      where: { name },
    })
    if (duplicate) throw new BadRequestException('门店名称已存在')

    const entity = await this.storesRepository.save(
      this.storesRepository.create({
        id: await this.nextStoreId(),
        name,
        city,
        region,
        manager,
        phone,
        status: 'normal',
        openedAt,
        updatedAt: new Date(),
      }),
    )

    STORES.push({
      id: entity.id,
      name: entity.name,
      city: entity.city,
      region: entity.region,
      sales: 0,
      orders: 0,
      aov: 0,
      delta: 0,
      status: entity.status,
      manager: entity.manager,
    })

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '新增门店',
      object: entity.id,
      result: 'success',
      approvalId: '—',
    })

    const stores = await this.buildDtos(actor)
    return stores.find((item) => item.id === entity.id) || null
  }

  private scopeIds(actor: Actor) {
    return scopedStores(actor).map((store) => store.id)
  }

  private async buildDtos(actor: Actor) {
    ensurePermission(actor, 'stores.read', '查看门店')
    const allowed = this.scopeIds(actor)
    if (!allowed.length) return []

    const scopeType = scopeTypeOf(actor.key)
    const where =
      scopeType === 'global'
        ? {}
        : scopeType === 'store'
          ? { id: actor.storeId || '' }
          : { region: actor.region }
    const stores = await this.storesRepository.find({
      where,
      order: { id: 'ASC' },
    })
    const orders = await this.ordersRepository.find({
      where: { storeId: In(allowed) },
    })
    const inventory = await this.inventoryRepository.find({
      where: { storeId: In(allowed) },
    })

    return stores.map((store) => {
      const storeOrders = orders.filter((order) => order.storeId === store.id)
      const storeInventory = inventory.filter(
        (item) => item.storeId === store.id,
      )
      const memberNames = new Set(
        storeOrders.map((order) => order.memberName),
      )
      const sales = storeOrders.reduce(
        (sum, order) =>
          sum +
          Math.max(
            Number(order.amount) - Number(order.refundedAmount || 0),
            0,
          ),
        0,
      )

      return {
        id: store.id,
        name: store.name,
        city: store.city,
        region: store.region,
        manager: store.manager,
        phone: store.phone,
        status: store.status,
        openedAt: store.openedAt,
        updatedAt: formatDateTime(store.updatedAt),
        sales: Math.round(sales * 100) / 100,
        orders: storeOrders.length,
        members: memberNames.size,
        lowStock: storeInventory.filter(
          (item) => item.stock < item.safetyStock,
        ).length,
        inventoryCount: storeInventory.length,
      }
    })
  }

  async list(actor: Actor) {
    return this.buildDtos(actor)
  }

  async detail(actor: Actor, id: string) {
    ensurePermission(actor, 'stores.read', '查看门店')
    const allowed = this.scopeIds(actor)
    if (!allowed.includes(id)) {
      throw new ForbiddenException('当前角色无权查看该门店')
    }

    const stores = await this.buildDtos(actor)
    const store = stores.find((item) => item.id === id)
    if (!store) throw new NotFoundException('门店不存在')

    const orders = await this.ordersRepository.find({
      where: { storeId: id },
      order: { createdAt: 'DESC' },
      take: 8,
    })

    return {
      store,
      orders: orders.map((order) => ({
        id: order.id,
        memberName: order.memberName,
        itemCount: order.itemCount,
        amount: Number(order.amount),
        refundedAmount: Number(order.refundedAmount || 0),
        status: order.status,
        createdAt: formatDateTime(order.createdAt),
      })),
    }
  }

  async update(
    actor: Actor,
    id: string,
    body: { manager?: string; phone?: string; status?: string },
  ) {
    ensurePermission(actor, 'stores.write', '编辑门店')
    const allowed = this.scopeIds(actor)
    if (!allowed.includes(id)) {
      throw new ForbiddenException('当前角色无权编辑该门店')
    }

    const entity = await this.storesRepository.findOne({ where: { id } })
    if (!entity) throw new NotFoundException('门店不存在')

    if (body.manager !== undefined) {
      if (!body.manager.trim()) throw new BadRequestException('店长不能为空')
      entity.manager = body.manager.trim()
    }
    if (body.phone !== undefined) {
      if (!body.phone.trim()) throw new BadRequestException('门店电话不能为空')
      entity.phone = body.phone.trim()
    }
    if (body.status !== undefined) {
      if (!['normal', 'warning', 'danger'].includes(body.status)) {
        throw new BadRequestException('门店状态不合法')
      }
      entity.status = body.status
    }
    entity.updatedAt = new Date()
    const saved = await this.storesRepository.save(entity)

    const memoryStore = STORES.find((store) => store.id === saved.id)
    if (memoryStore) {
      memoryStore.manager = saved.manager
      memoryStore.status = saved.status
    }

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '编辑门店',
      object: saved.id,
      result: 'success',
      approvalId: '—',
    })

    const stores = await this.buildDtos(actor)
    return stores.find((item) => item.id === id) || null
  }
}
