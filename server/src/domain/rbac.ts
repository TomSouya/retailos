import {
  ANOMALIES,
  INVENTORY,
  KPI_WEEK,
  STORES,
  TREND_WEEK,
  inventoryStatus,
} from './data'
import {
  hasPermission,
  scopeTypeOf,
} from './permissions'
import { TOOL } from './tools'
import {
  Actor,
  Anomaly,
  InventoryItem,
  SalesSummary,
  SalesTrend,
  Store,
} from './types'

export class AgentToolError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'AgentToolError'
    this.code = code
  }
}

const TOOL_PERMISSIONS: Record<string, string> = {
  [TOOL.GET_SALES_SUMMARY]: 'dashboard.read',
  [TOOL.GET_SALES_TREND]: 'dashboard.read',
  [TOOL.GET_STORE_RANKING]: 'dashboard.read',
  [TOOL.GET_ORDER_COUNT]: 'orders.read',
  [TOOL.SCAN_ANOMALIES]: 'dashboard.read',
  [TOOL.GET_INVENTORY]: 'inventory.read',
  [TOOL.GET_LOW_STOCK]: 'inventory.read',
  [TOOL.CREATE_REPLENISHMENT_DRAFT]: 'inventory.replenish',
  [TOOL.CREATE_REPLENISHMENT]: 'inventory.replenish',
  [TOOL.SEARCH_PRODUCTS]: 'products.read',
  [TOOL.LIST_PURCHASE_ORDERS]: 'procurement.read',
  [TOOL.LIST_SALES_ORDERS]: 'orders.read',
  [TOOL.LIST_PENDING_APPROVALS]: 'procurement.approve',
  [TOOL.CREATE_PURCHASE_ORDER_DRAFT]: 'procurement.create',
  [TOOL.PREPARE_APPROVAL_DECISION]: 'procurement.approve',
  [TOOL.PREPARE_REFUND_REQUEST]: 'orders.refund_request',
  [TOOL.PREPARE_PURCHASE_ORDER_ACTION]: 'procurement.create',
  [TOOL.PREPARE_STORE_CREATE]: 'stores.write',
  [TOOL.PREPARE_MEMBER_CREATE]: 'members.write',
  [TOOL.PREPARE_PRODUCT_CREATE]: 'products.write',
}

export function toolPermission(tool: string): string | undefined {
  return TOOL_PERMISSIONS[tool]
}

export function scopedStores(actor: Actor): Store[] {
  if (!actor) return []
  const scopeType = scopeTypeOf(actor.key)
  if (scopeType === 'global') return STORES
  if (scopeType === 'store') {
    return STORES.filter((store) => store.id === actor.storeId)
  }
  return STORES.filter((store) => store.region === actor.region)
}

export function scopedInventory(
  actor: Actor,
  storeId?: string,
): InventoryItem[] {
  const allowedIds = new Set(scopedStores(actor).map((store) => store.id))
  return INVENTORY.filter((item) => {
    if (!allowedIds.has(item.storeId)) return false
    if (storeId && item.storeId !== storeId) return false
    return true
  })
}

export function resolveTargetStore(
  actor: Actor,
  storeId?: string,
): Store | null {
  const scoped = scopedStores(actor)
  if (storeId) return scoped.find((store) => store.id === storeId) || null
  if (actor?.key === 'store_manager') {
    return scoped.find((store) => store.id === actor.storeId) || null
  }
  return scoped[0] || null
}

export function authorizeTool(params: {
  actor: Actor
  tool: string
  input?: Record<string, any>
}): { allowed: boolean; reason?: string } {
  const { actor, tool, input = {} } = params
  if (!actor) return { allowed: false, reason: '未登录，不能调用工具' }

  const permission = TOOL_PERMISSIONS[tool]
  if (!permission) return { allowed: false, reason: `未知工具：${tool}` }
  if (!hasPermission(actor, permission)) {
    return {
      allowed: false,
      reason: `${actor.label}无权调用「${tool}」`,
    }
  }

  if (input.storeId) {
    const scopeType = scopeTypeOf(actor.key)
    if (scopeType === 'store' && actor.storeId !== input.storeId) {
      const ownStore = STORES.find((item) => item.id === actor.storeId)
      return {
        allowed: false,
        reason: `当前角色只能访问所属门店数据${
          ownStore ? `（${ownStore.name}）` : ''
        }，无权查看其他门店`,
      }
    }

    if (scopeType === 'region') {
      const store = STORES.find((item) => item.id === input.storeId)
      if (store && store.region !== actor.region) {
        return { allowed: false, reason: `当前角色只能访问${actor.region}区域` }
      }
    }
  }

  return { allowed: true }
}

export function salesSummary(
  actor: Actor,
  input: Record<string, any> = {},
): SalesSummary {
  if (actor.key === 'owner' && !input.storeId) {
    return {
      sales: KPI_WEEK.sales,
      orders: KPI_WEEK.orders,
      aov: KPI_WEEK.aov,
      delta: KPI_WEEK.delta,
      stores: 50,
      scope: actor.scope,
    }
  }

  const scoped = input.storeId
    ? scopedStores(actor).filter((store) => store.id === input.storeId)
    : scopedStores(actor)

  const total = scoped.reduce(
    (acc, store) => {
      acc.sales += store.sales
      acc.orders += store.orders
      acc.delta += store.delta * store.sales
      return acc
    },
    { sales: 0, orders: 0, delta: 0 },
  )

  return {
    sales: total.sales,
    orders: total.orders,
    aov: total.orders ? total.sales / total.orders : 0,
    delta: total.sales ? total.delta / total.sales : 0,
    stores: scoped.length,
    scope: input.storeId ? scoped[0]?.name || '门店' : actor.scope,
  }
}

export function salesTrend(
  actor: Actor,
  input: Record<string, any> = {},
): SalesTrend {
  const scoped = input.storeId
    ? scopedStores(actor).filter((store) => store.id === input.storeId)
    : scopedStores(actor)
  const scopeSales = scoped.reduce((sum, store) => sum + store.sales, 0)
  const allSales = STORES.reduce((sum, store) => sum + store.sales, 0)
  const ratio = allSales ? Math.min(scopeSales / allSales, 1) : 1

  return {
    labels: TREND_WEEK.labels,
    sales: TREND_WEEK.sales.map((value) => Math.round(value * ratio)),
    scope: input.storeId ? scoped[0]?.name || '门店' : actor.scope,
  }
}

export function storeRanking(actor: Actor) {
  return scopedStores(actor)
    .slice()
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 6)
    .map((store, index) => ({ ...store, rank: index + 1 }))
}

export function orderCount(actor: Actor, input: Record<string, any> = {}) {
  const scoped = input.storeId
    ? scopedStores(actor).filter((store) => store.id === input.storeId)
    : scopedStores(actor)
  return {
    orders: scoped.reduce((sum, store) => sum + store.orders, 0),
    scope: input.storeId ? scoped[0]?.name || '门店' : actor.scope,
  }
}

export function scopedAnomalies(actor: Actor): Anomaly[] {
  const scopeType = scopeTypeOf(actor.key)
  if (scopeType === 'global') return ANOMALIES
  if (scopeType === 'store') {
    const store = STORES.find((item) => item.id === actor.storeId)
    return ANOMALIES.filter((item) => item.store === store?.name)
  }
  return ANOMALIES.filter((item) => item.region === actor.region)
}

export function lowStockItems(
  actor: Actor,
  input: Record<string, any> = {},
) {
  return scopedInventory(actor, input.storeId)
    .filter((item) => inventoryStatus(item) !== 'normal')
    .map((item) => ({
      ...item,
      status: inventoryStatus(item),
      suggestQty: Math.max(item.safetyStock - item.stock, 12),
    }))
}

export function executeTool(params: {
  actor: Actor
  tool: string
  input?: Record<string, any>
}) {
  const { actor, tool, input = {} } = params
  const auth = authorizeTool({ actor, tool, input })
  if (!auth.allowed) {
    throw new AgentToolError('FORBIDDEN', auth.reason || '无权调用该工具')
  }

  switch (tool) {
    case TOOL.GET_SALES_SUMMARY:
      return salesSummary(actor, input)
    case TOOL.GET_SALES_TREND:
      return salesTrend(actor, input)
    case TOOL.GET_STORE_RANKING:
      return { stores: storeRanking(actor) }
    case TOOL.GET_ORDER_COUNT:
      return orderCount(actor, input)
    case TOOL.SCAN_ANOMALIES:
      return { anomalies: scopedAnomalies(actor) }
    case TOOL.GET_INVENTORY:
      return {
        items: scopedInventory(actor, input.storeId).map((item) => ({
          ...item,
          status: inventoryStatus(item),
        })),
      }
    case TOOL.GET_LOW_STOCK:
      return { items: lowStockItems(actor, input) }
    case TOOL.CREATE_REPLENISHMENT_DRAFT:
      return {
        items: lowStockItems(actor, input),
        status: 'draft',
      }
    default:
      throw new AgentToolError('UNKNOWN_TOOL', `未知工具：${tool}`)
  }
}
