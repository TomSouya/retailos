import {
  anomalies,
  inventory,
  inventoryStatus,
  kpiByRange,
  stores,
  trendByRange,
} from './data'
import { AGENT_TOOL } from '@/contracts/tools'
import { products, purchaseOrders, salesOrders } from './phase2'

/**
 * 模拟服务端边界。
 * 真实后端必须在这里做同样的 RBAC、门店范围与参数校验；
 * 前端隐藏按钮不构成权限控制。
 */
export class AgentToolError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AgentToolError'
    this.code = code
  }
}

const TOOL_ROLES = {
  [AGENT_TOOL.GET_SALES_SUMMARY]: ['owner', 'regional_manager', 'store_manager'],
  [AGENT_TOOL.GET_SALES_TREND]: ['owner', 'regional_manager', 'store_manager'],
  [AGENT_TOOL.GET_STORE_RANKING]: ['owner', 'regional_manager'],
  [AGENT_TOOL.GET_ORDER_COUNT]: ['owner', 'regional_manager', 'store_manager'],
  [AGENT_TOOL.SCAN_ANOMALIES]: ['owner', 'regional_manager', 'store_manager'],
  [AGENT_TOOL.GET_INVENTORY]: ['owner', 'regional_manager', 'store_manager', 'warehouse'],
  [AGENT_TOOL.GET_LOW_STOCK]: ['owner', 'regional_manager', 'store_manager', 'warehouse'],
  [AGENT_TOOL.CREATE_REPLENISHMENT_DRAFT]: ['owner', 'store_manager'],
  [AGENT_TOOL.CREATE_REPLENISHMENT]: ['owner', 'store_manager'],
  [AGENT_TOOL.SEARCH_PRODUCTS]: ['owner', 'regional_manager', 'store_manager'],
  [AGENT_TOOL.LIST_PURCHASE_ORDERS]: ['owner', 'regional_manager', 'warehouse'],
  [AGENT_TOOL.LIST_SALES_ORDERS]: ['owner', 'regional_manager', 'store_manager'],
}

export function scopedStores(actor) {
  if (!actor) return []
  if (actor.key === 'owner') return stores
  if (actor.key === 'regional_manager' || actor.key === 'warehouse') {
    return stores.filter((store) => store.region === actor.region)
  }
  if (actor.key === 'store_manager') {
    return stores.filter((store) => store.id === actor.storeId)
  }
  return []
}

function scopedInventory(actor, storeId) {
  const allowedIds = new Set(scopedStores(actor).map((store) => store.id))
  return inventory.filter((item) => {
    if (!allowedIds.has(item.storeId)) return false
    if (storeId && item.storeId !== storeId) return false
    return true
  })
}

export function resolveTargetStore(actor, storeId) {
  const scoped = scopedStores(actor)
  if (storeId) return scoped.find((store) => store.id === storeId) || null
  if (actor?.key === 'store_manager') {
    return scoped.find((store) => store.id === actor.storeId) || null
  }
  return scoped[0] || null
}

export function authorizeTool({ actor, tool, input = {} }) {
  if (!actor) return { allowed: false, reason: '未登录，不能调用工具' }

  const roles = TOOL_ROLES[tool]
  if (!roles) return { allowed: false, reason: `未知工具：${tool}` }
  if (!roles.includes(actor.key)) {
    return { allowed: false, reason: `${actor.label}无权调用「${tool}」` }
  }

  if (input.storeId) {
    if (actor.key === 'store_manager' && actor.storeId !== input.storeId) {
      return { allowed: false, reason: '店长只能访问本店数据' }
    }

    if (actor.key === 'regional_manager' || actor.key === 'warehouse') {
      const store = stores.find((item) => item.id === input.storeId)
      if (store && store.region !== actor.region) {
        return { allowed: false, reason: `当前角色只能访问${actor.region}区域` }
      }
    }
  }

  return { allowed: true }
}

function salesSummary(actor, input) {
  if (actor.key === 'owner' && !input.storeId) {
    const kpi = kpiByRange.week
    return {
      sales: kpi.sales,
      orders: kpi.orders,
      aov: kpi.aov,
      delta: kpi.salesDelta,
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

function salesTrend(actor, input) {
  const scoped = input.storeId
    ? scopedStores(actor).filter((store) => store.id === input.storeId)
    : scopedStores(actor)
  const scopeSales = scoped.reduce((sum, store) => sum + store.sales, 0)
  const allSales = stores.reduce((sum, store) => sum + store.sales, 0)
  const ratio = allSales ? Math.min(scopeSales / allSales, 1) : 1
  const base = trendByRange.week

  return {
    labels: base.labels,
    sales: base.sales.map((value) => Math.round(value * ratio)),
    scope: input.storeId ? scoped[0]?.name || '门店' : actor.scope,
  }
}

function storeRanking(actor) {
  return scopedStores(actor)
    .slice()
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 6)
    .map((store, index) => ({ ...store, rank: index + 1 }))
}

function orderCount(actor, input) {
  const scoped = input.storeId
    ? scopedStores(actor).filter((store) => store.id === input.storeId)
    : scopedStores(actor)
  return {
    orders: scoped.reduce((sum, store) => sum + store.orders, 0),
    scope: input.storeId ? scoped[0]?.name || '门店' : actor.scope,
  }
}

function scopedAnomalies(actor) {
  if (actor.key === 'owner') return anomalies
  if (actor.key === 'store_manager') {
    const store = stores.find((item) => item.id === actor.storeId)
    return anomalies.filter((item) => item.store === store?.name)
  }
  return anomalies.filter((item) => item.region === actor.region)
}

function lowStockItems(actor, input) {
  return scopedInventory(actor, input.storeId)
    .filter((item) => inventoryStatus(item) !== 'normal')
    .map((item) => ({
      ...item,
      status: inventoryStatus(item),
      suggestQty: Math.max(item.safetyStock - item.stock, 12),
    }))
}

/**
 * 执行工具。真实后端应在同一入口做鉴权、审计与副作用控制。
 * @param {{ actor: Object, tool: string, input?: Object }} params
 */
export function executeTool({ actor, tool, input = {} }) {
  const auth = authorizeTool({ actor, tool, input })
  if (!auth.allowed) {
    throw new AgentToolError('FORBIDDEN', auth.reason)
  }

  switch (tool) {
    case AGENT_TOOL.GET_SALES_SUMMARY:
      return salesSummary(actor, input)
    case AGENT_TOOL.GET_SALES_TREND:
      return salesTrend(actor, input)
    case AGENT_TOOL.GET_STORE_RANKING:
      return { stores: storeRanking(actor) }
    case AGENT_TOOL.GET_ORDER_COUNT:
      return orderCount(actor, input)
    case AGENT_TOOL.SCAN_ANOMALIES:
      return { anomalies: scopedAnomalies(actor) }
    case AGENT_TOOL.GET_INVENTORY:
      return {
        items: scopedInventory(actor, input.storeId).map((item) => ({
          ...item,
          status: inventoryStatus(item),
        })),
      }
    case AGENT_TOOL.GET_LOW_STOCK:
      return { items: lowStockItems(actor, input) }
    case AGENT_TOOL.CREATE_REPLENISHMENT_DRAFT:
      return {
        items: lowStockItems(actor, input),
        status: 'draft',
      }
    case AGENT_TOOL.SEARCH_PRODUCTS: {
      const keyword = String(input.keyword || '').trim().toLowerCase()
      const rows = products
        .filter((item) => !input.category || item.category === input.category)
        .filter((item) => !input.status || item.status === input.status)
        .filter(
          (item) =>
            !keyword ||
            item.name.toLowerCase().includes(keyword) ||
            item.id.toLowerCase().includes(keyword),
        )
      return {
        kind: 'products',
        total: rows.length,
        summary: {
          active: rows.filter((item) => item.status === 'active').length,
          inactive: rows.filter((item) => item.status === 'inactive').length,
        },
        rows: rows.slice(0, Number(input.limit) || 8),
      }
    }
    case AGENT_TOOL.LIST_PURCHASE_ORDERS: {
      const allowed = new Set(scopedStores(actor).map((store) => store.id))
      const keyword = String(input.keyword || '').trim().toLowerCase()
      const rows = purchaseOrders
        .filter((item) => allowed.has(item.storeId))
        .filter((item) => !input.status || item.status === input.status)
        .filter(
          (item) =>
            !keyword ||
            item.id.toLowerCase().includes(keyword) ||
            item.supplierName.toLowerCase().includes(keyword) ||
            item.storeName.toLowerCase().includes(keyword),
        )
      const countBy = (status) =>
        rows.filter((item) => item.status === status).length
      return {
        kind: 'purchase_orders',
        total: rows.length,
        summary: {
          draft: countBy('draft'),
          pending: countBy('pending'),
          approved: countBy('approved'),
          received: countBy('received'),
        },
        rows: rows.slice(0, Number(input.limit) || 8),
      }
    }
    case AGENT_TOOL.LIST_SALES_ORDERS: {
      const allowed = new Set(scopedStores(actor).map((store) => store.id))
      const keyword = String(input.keyword || '').trim().toLowerCase()
      const rows = salesOrders
        .filter((item) => allowed.has(item.storeId))
        .filter(
          (item) => !input.storeId || item.storeId === input.storeId,
        )
        .filter((item) => !input.status || item.status === input.status)
        .filter(
          (item) =>
            !keyword ||
            item.id.toLowerCase().includes(keyword) ||
            item.memberName.toLowerCase().includes(keyword) ||
            item.storeName.toLowerCase().includes(keyword),
        )
      return {
        kind: 'sales_orders',
        total: rows.length,
        summary: {
          paid: rows.filter((item) => item.status === 'paid').length,
          refunded: rows.filter((item) =>
            ['refunded', 'partially_refunded'].includes(item.status),
          ).length,
          amount: rows.reduce((sum, item) => sum + Number(item.amount), 0),
        },
        rows: rows.slice(0, Number(input.limit) || 8),
      }
    }
    default:
      throw new AgentToolError('UNKNOWN_TOOL', `未知工具：${tool}`)
  }
}

/**
 * 只读投影，供 mock 场景构建 UI 使用。
 * 真实后端应通过工具结果或快照事件返回这些数据。
 */
export const agentReadModel = {
  salesSummary,
  salesTrend,
  storeRanking,
  orderCount,
  scopedAnomalies,
  lowStockItems,
  scopedInventory,
}
