import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, MoreThanOrEqual, Repository } from 'typeorm'
import { InventoryItemEntity } from '../database/entities/inventory-item.entity'
import { ProductEntity } from '../database/entities/product.entity'
import { SalesOrderEntity } from '../database/entities/sales-order.entity'
import { StoreEntity } from '../database/entities/store.entity'
import {
  hasPermission,
  scopeTypeOf,
} from '../domain/permissions'
import { Actor } from '../domain/types'

type RangeKey = 'today' | 'week' | 'month'

const RANGE_DAYS: Record<RangeKey, number> = {
  today: 1,
  week: 7,
  month: 30,
}

const RANGE_LABELS: Record<RangeKey, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
}

const SEVERITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  )
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDay(date: Date) {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatClock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dayKey(date: Date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(SalesOrderEntity)
    private readonly ordersRepository: Repository<SalesOrderEntity>,
    @InjectRepository(StoreEntity)
    private readonly storesRepository: Repository<StoreEntity>,
    @InjectRepository(InventoryItemEntity)
    private readonly inventoryRepository: Repository<InventoryItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productsRepository: Repository<ProductEntity>,
  ) {}

  private normalizeRange(value?: string): RangeKey {
    return value === 'today' || value === 'month' ? value : 'week'
  }

  private net(order: SalesOrderEntity) {
    return Math.max(
      Number(order.amount) - Number(order.refundedAmount || 0),
      0,
    )
  }

  private metrics(orders: SalesOrderEntity[]) {
    const sales = round(orders.reduce((sum, item) => sum + this.net(item), 0))
    const count = orders.length
    return {
      sales,
      orders: count,
      aov: count ? round(sales / count) : 0,
    }
  }

  private delta(current: number, previous: number): number | null {
    if (!previous) return null
    return round(((current - previous) / previous) * 100)
  }

  private cogsOf(
    order: SalesOrderEntity,
    costBySku: Map<string, number>,
  ) {
    const amount = Number(order.amount)
    const ratio = amount > 0 ? this.net(order) / amount : 0
    return (order.items || []).reduce(
      (sum, item) =>
        sum +
        Number(item.quantity) * (costBySku.get(item.sku) || 0) * ratio,
      0,
    )
  }

  private periodCogs(
    orders: SalesOrderEntity[],
    costBySku: Map<string, number>,
  ) {
    return round(
      orders.reduce(
        (sum, order) => sum + this.cogsOf(order, costBySku),
        0,
      ),
    )
  }

  private unitsSoldOf(
    orders: SalesOrderEntity[],
  ) {
    return orders.reduce((sum, order) => {
      const amount = Number(order.amount)
      const ratio = amount > 0 ? this.net(order) / amount : 0
      return (
        sum +
        (order.items || []).reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity) * ratio,
          0,
        )
      )
    }, 0)
  }

  private memberShare(orders: SalesOrderEntity[]) {
    if (!orders.length) return 0
    const memberOrders = orders.filter((order) => {
      const name = String(order.memberName || '').trim()
      return name && name !== '到店顾客'
    }).length
    return round((memberOrders / orders.length) * 100)
  }

  private async scopedStores(actor: Actor) {
    if (!hasPermission(actor, 'dashboard.read')) {
      throw new ForbiddenException('当前角色无权查看经营驾驶舱')
    }

    const stores = await this.storesRepository.find({ order: { id: 'ASC' } })
    const scopeType = scopeTypeOf(actor.key)
    if (scopeType === 'global') return stores
    if (scopeType === 'store') {
      return stores.filter((store) => store.id === actor.storeId)
    }
    return stores.filter((store) => store.region === actor.region)
  }

  private async collect(
    actor: Actor,
    range: RangeKey,
    storeId?: string,
  ) {
    let stores = await this.scopedStores(actor)
    if (storeId) {
      stores = stores.filter((store) => store.id === storeId)
      if (!stores.length) {
        throw new ForbiddenException('当前角色无权查看该门店')
      }
    }

    const days = RANGE_DAYS[range]
    const today = startOfDay(new Date())
    const currentStart = addDays(today, -(days - 1))
    const previousStart = addDays(currentStart, -days)
    const end = addDays(today, 1)

    if (!stores.length) {
      return {
        stores,
        current: [] as SalesOrderEntity[],
        previous: [] as SalesOrderEntity[],
        currentStart,
        today,
        days,
      }
    }

    const rows = await this.ordersRepository.find({
      where: {
        storeId: In(stores.map((store) => store.id)),
        createdAt: MoreThanOrEqual(previousStart),
      },
      relations: { items: true },
      order: { createdAt: 'ASC' },
    })

    const inWindow = rows.filter((row) => row.createdAt < end)
    return {
      stores,
      current: inWindow.filter((row) => row.createdAt >= currentStart),
      previous: inWindow.filter((row) => row.createdAt < currentStart),
      currentStart,
      today,
      days,
    }
  }

  private storeSales(
    ctx: {
      current: SalesOrderEntity[]
      previous: SalesOrderEntity[]
      stores: StoreEntity[]
    },
    costBySku: Map<string, number> = new Map(),
  ) {
    return ctx.stores.map((store) => {
      const currentOrders = ctx.current.filter(
        (order) => order.storeId === store.id,
      )
      const previousOrders = ctx.previous.filter(
        (order) => order.storeId === store.id,
      )
      const current = this.metrics(currentOrders)
      const previous = this.metrics(previousOrders)
      const cogs = this.periodCogs(currentOrders, costBySku)
      const grossProfit = round(current.sales - cogs)
      return {
        id: store.id,
        name: store.name,
        region: store.region,
        sales: current.sales,
        orders: current.orders,
        aov: current.aov,
        grossProfit,
        grossMargin: current.sales
          ? round((grossProfit / current.sales) * 100)
          : 0,
        delta: this.delta(current.sales, previous.sales),
        status: store.status,
      }
    })
  }

  private trendBuckets(
    ctx: {
      current: SalesOrderEntity[]
      currentStart: Date
      days: number
    },
    range: RangeKey,
  ) {
    if (range === 'today') {
      const hours = Array.from({ length: 14 }, (_, index) => 8 + index)
      return {
        labels: hours.map((hour) => `${pad(hour)}:00`),
        sales: hours.map((hour) =>
          round(
            ctx.current
              .filter((order) => order.createdAt.getHours() === hour)
              .reduce((sum, order) => sum + this.net(order), 0),
          ),
        ),
      }
    }

    const labels: string[] = []
    const sales: number[] = []
    for (let index = 0; index < ctx.days; index += 1) {
      const day = addDays(ctx.currentStart, index)
      labels.push(formatDay(day))
      sales.push(
        round(
          ctx.current
            .filter((order) => dayKey(order.createdAt) === dayKey(day))
            .reduce((sum, order) => sum + this.net(order), 0),
        ),
      )
    }
    return { labels, sales }
  }

  async dashboard(actor: Actor, rangeInput?: string) {
    const range = this.normalizeRange(rangeInput)
    const ctx = await this.collect(actor, range)
    const current = this.metrics(ctx.current)
    const previous = this.metrics(ctx.previous)
    const memberShare = this.memberShare(ctx.current)
    const previousMemberShare = this.memberShare(ctx.previous)

    const products = await this.productsRepository.find()
    const costBySku = new Map(
      products.map((product) => [
        product.id,
        Number(product.costPrice || 0),
      ]),
    )
    const storeRows = this.storeSales(ctx, costBySku)
    const storeIds = ctx.stores.map((store) => store.id)
    const inventory = storeIds.length
      ? await this.inventoryRepository.find({
          where: { storeId: In(storeIds) },
        })
      : []

    const inventoryValue = round(
      inventory.reduce(
        (sum, item) =>
          sum +
          Math.max(item.stock, 0) * (costBySku.get(item.sku) || 0),
        0,
      ),
    )
    const unitsStock = inventory.reduce(
      (sum, item) => sum + Math.max(item.stock, 0),
      0,
    )
    const cogs = this.periodCogs(ctx.current, costBySku)
    const previousCogs = this.periodCogs(ctx.previous, costBySku)
    const grossProfit = round(current.sales - cogs)
    const previousGrossProfit = round(previous.sales - previousCogs)
    const grossMargin = current.sales
      ? round((grossProfit / current.sales) * 100)
      : 0
    const unitsSold = Math.round(this.unitsSoldOf(ctx.current))
    const turnoverDays =
      cogs > 0
        ? round((inventoryValue * ctx.days) / cogs)
        : null
    const sellThrough =
      unitsSold + unitsStock > 0
        ? round((unitsSold / (unitsSold + unitsStock)) * 100)
        : 0

    const ranking = storeRows
      .map((row) => {
        const items = inventory.filter((item) => item.storeId === row.id)
        const lowStock = items.filter(
          (item) => item.stock < item.safetyStock,
        ).length
        const outStock = items.filter((item) => item.stock <= 0).length

        let status = row.status
        if (outStock > 0) status = 'danger'
        else if (
          lowStock > 0 ||
          (row.delta !== null && row.delta <= -15)
        ) {
          status = 'warning'
        }

        return { ...row, status, lowStock, outStock }
      })
      .sort((a, b) => b.sales - a.sales)

    const nowText = formatClock(new Date())
    const anomalies = ranking
      .flatMap((row) => {
        const list: Array<Record<string, any>> = []
        if (row.outStock > 0) {
          list.push({
            id: `${row.id}-out`,
            store: row.name,
            region: row.region,
            type: '缺货风险',
            detail: `${row.outStock} 个 SKU 已缺货，${row.lowStock} 个低于安全库存`,
            severity: 'high',
            time: nowText,
          })
        } else if (row.lowStock > 0) {
          list.push({
            id: `${row.id}-stock`,
            store: row.name,
            region: row.region,
            type: '库存预警',
            detail: `${row.lowStock} 个 SKU 低于安全库存`,
            severity: 'medium',
            time: nowText,
          })
        }
        if (row.delta !== null && row.delta <= -15) {
          list.push({
            id: `${row.id}-sales`,
            store: row.name,
            region: row.region,
            type: '销售下滑',
            detail: `销售额环比 ${row.delta}%，低于上一周期`,
            severity: row.delta <= -30 ? 'high' : 'medium',
            time: nowText,
          })
        }
        return list
      })
      .sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
      )
      .slice(0, 5)

    const categoryBySku = new Map(
      products.map((product) => [product.id, product.category]),
    )
    const productSales = new Map<
      string,
      { name: string; sales: number; sku: string }
    >()

    for (const order of ctx.current) {
      const amount = Number(order.amount)
      const ratio = amount > 0 ? this.net(order) / amount : 0
      for (const item of order.items || []) {
        const entry = productSales.get(item.sku) || {
          sku: item.sku,
          name: item.name,
          sales: 0,
        }
        entry.sales += Number(item.amount) * ratio
        productSales.set(item.sku, entry)
      }
    }

    const productRows = [...productSales.values()]
      .map((item) => ({ ...item, sales: round(item.sales) }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5)
    const maxProductSales = productRows[0]?.sales || 0

    return {
      range,
      rangeLabel: RANGE_LABELS[range],
      updatedAt: formatDateTime(new Date()),
      kpis: {
        sales: current.sales,
        orders: current.orders,
        aov: current.aov,
        memberShare,
        grossProfit,
        grossMargin,
        cogs,
        salesDelta: this.delta(current.sales, previous.sales),
        ordersDelta: this.delta(current.orders, previous.orders),
        aovDelta: this.delta(current.aov, previous.aov),
        memberShareDelta: this.delta(memberShare, previousMemberShare),
        grossProfitDelta: this.delta(grossProfit, previousGrossProfit),
      },
      operations: {
        cogs,
        grossProfit,
        grossMargin,
        inventoryValue,
        turnoverDays,
        sellThrough,
        unitsSold,
        unitsStock,
      },
      trend: this.trendBuckets(ctx, range),
      ranking: ranking.slice(0, 6).map((row, index) => ({
        rank: index + 1,
        id: row.id,
        name: row.name,
        region: row.region,
        sales: row.sales,
        orders: row.orders,
        aov: row.aov,
        grossProfit: row.grossProfit,
        grossMargin: row.grossMargin,
        delta: row.delta,
        status: row.status,
      })),
      anomalies,
      topProducts: productRows.map((item) => ({
        name: item.name,
        category: categoryBySku.get(item.sku) || '其他',
        sales: item.sales,
        share: maxProductSales
          ? Math.round((item.sales / maxProductSales) * 100)
          : 0,
      })),
      storePulse: ranking.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        sales: row.sales,
      })),
    }
  }

  async summary(
    actor: Actor,
    input: { storeId?: string; range?: string } = {},
  ) {
    const range = this.normalizeRange(input.range)
    const ctx = await this.collect(actor, range, input.storeId)
    const current = this.metrics(ctx.current)
    const previous = this.metrics(ctx.previous)
    const products = await this.productsRepository.find()
    const costBySku = new Map(
      products.map((product) => [
        product.id,
        Number(product.costPrice || 0),
      ]),
    )
    const cogs = this.periodCogs(ctx.current, costBySku)
    const grossProfit = round(current.sales - cogs)
    const scope = input.storeId
      ? ctx.stores[0]?.name || '门店'
      : ctx.stores.length === 1
        ? ctx.stores[0].name
        : actor.scope

    return {
      ...current,
      delta: this.delta(current.sales, previous.sales),
      cogs,
      grossProfit,
      grossMargin: current.sales
        ? round((grossProfit / current.sales) * 100)
        : 0,
      stores: ctx.stores.length,
      scope,
    }
  }

  async trend(
    actor: Actor,
    input: { storeId?: string; range?: string } = {},
  ) {
    const range = this.normalizeRange(input.range)
    const ctx = await this.collect(actor, range, input.storeId)
    return {
      ...this.trendBuckets(ctx, range),
      scope: input.storeId
        ? ctx.stores[0]?.name || '门店'
        : actor.scope,
    }
  }

  async ranking(
    actor: Actor,
    input: { range?: string } = {},
  ) {
    const range = this.normalizeRange(input.range)
    const ctx = await this.collect(actor, range)
    const products = await this.productsRepository.find()
    const costBySku = new Map(
      products.map((product) => [
        product.id,
        Number(product.costPrice || 0),
      ]),
    )
    return this.storeSales(ctx, costBySku)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6)
      .map((row, index) => ({ ...row, rank: index + 1 }))
  }
}
