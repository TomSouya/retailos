import { STORES } from './data'
import { TOOL, TOOL_LABELS } from './tools'
import {
  lowStockItems,
  resolveTargetStore,
  salesSummary,
  salesTrend,
  scopedAnomalies,
  scopedInventory,
  storeRanking,
} from './rbac'
import { Actor, Approval, Scenario, ToolSpec, UiNode } from './types'

function tool(
  name: string,
  input: Record<string, any>,
  duration: number,
): ToolSpec {
  return {
    name,
    label: TOOL_LABELS[name] || name,
    input,
    duration,
  }
}

function metricGrid(items: any[]): UiNode {
  return { type: 'metricGrid', props: { items } }
}

function createCard(
  title: string,
  subtitle: string,
  children: UiNode[],
): UiNode {
  return { type: 'card', props: { title, subtitle }, children }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatCurrency(value: number, digits = 0) {
  return `¥${new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}`
}

function mentionedStore(text: string) {
  return (
    STORES.find(
      (store) => text.includes(store.name) || text.includes(store.city),
    ) || null
  )
}

export function targetStoreFor(text: string, actor: Actor) {
  return mentionedStore(text) || resolveTargetStore(actor) || STORES[0]
}

function rankingColumns() {
  return [
    { key: 'rank', label: '#', width: '42px' },
    { key: 'name', label: '门店', minWidth: '96px' },
    { key: 'region', label: '区域', width: '64px' },
    { key: 'sales', label: '销售额', align: 'right', format: 'currency' },
    { key: 'delta', label: '环比', align: 'right', format: 'delta' },
  ]
}

function inventoryColumns() {
  return [
    { key: 'id', label: 'SKU', width: '86px' },
    { key: 'name', label: '商品', minWidth: '132px' },
    { key: 'stock', label: '当前', align: 'right', format: 'number', width: '56px' },
    {
      key: 'safetyStock',
      label: '安全',
      align: 'right',
      format: 'number',
      width: '56px',
    },
    { key: 'status', label: '状态', format: 'status', width: '76px' },
  ]
}

function replenishmentColumns() {
  return [
    { key: 'id', label: 'SKU', width: '86px' },
    { key: 'name', label: '商品', minWidth: '132px' },
    { key: 'stock', label: '当前', align: 'right', format: 'number', width: '56px' },
    {
      key: 'safetyStock',
      label: '安全',
      align: 'right',
      format: 'number',
      width: '56px',
    },
    {
      key: 'suggestQty',
      label: '建议补货',
      align: 'right',
      format: 'number',
      width: '76px',
    },
  ]
}

function salesScenario(actor: Actor, text: string): Scenario {
  const namedStore = mentionedStore(text)
  const storeId =
    actor.key === 'store_manager' ? actor.storeId : namedStore?.id || undefined
  const summary = salesSummary(actor, { storeId })
  const trend = salesTrend(actor, { storeId })
  const canRank = actor.key !== 'store_manager'
  const ranking = canRank ? storeRanking(actor) : []
  const scopeName = storeId
    ? STORES.find((store) => store.id === storeId)?.name || '门店'
    : actor.scope

  const tools: ToolSpec[] = [
    tool(TOOL.GET_SALES_SUMMARY, { storeId }, 760),
    tool(TOOL.GET_SALES_TREND, { storeId, range: 'week' }, 560),
  ]
  if (canRank) {
    tools.push(tool(TOOL.GET_STORE_RANKING, { top: 6 }, 680))
  }

  const children: UiNode[] = [
    metricGrid([
      {
        label: '销售额',
        value: summary.sales,
        format: 'currency',
        delta: `${summary.delta >= 0 ? '+' : ''}${summary.delta.toFixed(1)}%`,
        tone: 'accent',
      },
      {
        label: '订单量',
        value: summary.orders,
        format: 'number',
        tone: 'default',
      },
      {
        label: '客单价',
        value: summary.aov,
        format: 'currency1',
        tone: 'success',
      },
      { label: '会员复购率', value: '41.2%', tone: 'default' },
    ]),
    {
      type: 'chart',
      props: {
        title: '销售趋势',
        kind: 'line',
        x: trend.labels,
        series: [{ name: '销售额', data: trend.sales }],
        height: '180px',
      },
    },
  ]

  if (canRank) {
    children.push({
      type: 'table',
      props: {
        title: '门店排行',
        columns: rankingColumns(),
        rows: ranking,
        maxHeight: 246,
      },
    })
  } else {
    children.push({
      type: 'callout',
      props: {
        tone: 'info',
        title: '店长视角',
        text: '当前只展示本店数据；跨店排行需要区域经理或企业老板权限。',
      },
    })
  }

  return {
    plan:
      actor.key === 'store_manager'
        ? '我会先拉取本店的销售额与订单量，再读取本周趋势。'
        : '我会先拉取销售额与订单量，再计算门店排行，最后标出异常门店。',
    tools,
    reply: `${scopeName}本周销售额 ${formatCurrency(summary.sales)}，环比 ${summary.delta >= 0 ? '+' : ''}${summary.delta.toFixed(1)}%；订单量 ${formatNumber(summary.orders)} 单。`,
    ui: createCard(
      `${scopeName} · 本周经营概览`,
      '2026-11-15 至 2026-11-21',
      children,
    ),
  }
}

function anomalyScenario(actor: Actor): Scenario {
  const storeId = actor.key === 'store_manager' ? actor.storeId : undefined
  const items = scopedAnomalies(actor)
  const high = items.filter((item) => item.severity === 'high').length
  const medium = items.filter((item) => item.severity === 'medium').length
  const low = items.filter((item) => item.severity === 'low').length

  const tools: ToolSpec[] = [
    tool(TOOL.SCAN_ANOMALIES, { storeId }, 880),
  ]
  if (actor.key !== 'store_manager') {
    tools.push(tool(TOOL.GET_STORE_RANKING, { metric: 'sales' }, 540))
  }

  const children: UiNode[] = [
    metricGrid([
      { label: '异常门店', value: items.length, format: 'number', tone: 'danger' },
      { label: '高风险', value: high, format: 'number', tone: 'danger' },
      { label: '中风险', value: medium, format: 'number', tone: 'accent' },
      { label: '低风险', value: low, format: 'number', tone: 'default' },
    ]),
    {
      type: 'table',
      props: {
        title: '异常清单',
        columns: [
          { key: 'store', label: '门店', minWidth: '72px' },
          { key: 'type', label: '异常', minWidth: '80px' },
          { key: 'severity', label: '等级', format: 'status', width: '64px' },
          { key: 'time', label: '时间', align: 'right', width: '58px' },
        ],
        rows: items.slice(0, 4),
        maxHeight: 220,
      },
    },
    {
      type: 'callout',
      props: {
        tone: items.length ? 'warning' : 'success',
        title: items.length ? '建议优先处理' : '当前无异常',
        text: items.length
          ? `${items[0].store}：${items[0].detail}`
          : '当前范围内没有需要优先处理的经营异常。',
      },
    },
  ]

  return {
    plan: '我会按销售额、库存周转、缺货风险、会员复购四个维度扫描，优先列出高影响异常。',
    tools,
    reply: items.length
      ? `共发现 ${items.length} 条需要关注的异常，其中 ${high} 条高风险。建议先处理 ${items[0].store}。`
      : '当前范围内没有发现需要优先处理的异常。',
    ui: createCard(
      '异常门店扫描',
      `${actor.scope} · 最近 7 天`,
      children,
    ),
  }
}

function inventoryScenario(
  actor: Actor,
  text: string,
  providedItems?: any[],
): Scenario {
  const target = targetStoreFor(text, actor)
  const storeId = target?.id
  const items = providedItems ?? lowStockItems(actor, { storeId })
  const allItems = scopedInventory(actor, storeId)
  const low = items.filter((item) => item.status === 'low').length
  const out = items.filter((item) => item.status === 'out').length
  const storeName = target?.name || '当前门店'

  return {
    plan: `我会先定位${storeName}的库存明细，筛出低于安全库存的 SKU，再给出补货建议。`,
    tools: [
      tool(TOOL.GET_INVENTORY, { storeId }, 620),
      tool(TOOL.GET_LOW_STOCK, { storeId }, 480),
    ],
    reply: `${storeName}有 ${items.length} 个 SKU 低于安全库存，其中 ${out} 个已缺货。`,
    ui: createCard(`${storeName} · 低库存清单`, '按安全库存阈值筛选', [
      metricGrid([
        {
          label: 'SKU 总数',
          value: allItems.length,
          format: 'number',
          tone: 'default',
        },
        { label: '低库存', value: low, format: 'number', tone: 'accent' },
        { label: '已缺货', value: out, format: 'number', tone: 'danger' },
        { label: '库存准确率', value: '98.2%', tone: 'success' },
      ]),
      {
        type: 'table',
        props: {
          title: '需要补货的 SKU',
          columns: inventoryColumns(),
          rows: items,
          maxHeight: 230,
        },
      },
      {
        type: 'callout',
        props: {
          tone: items.length ? 'warning' : 'success',
          title: items.length ? '补货建议' : '库存正常',
          text: items.length
            ? '已缺货 SKU 建议今日优先补货；鲜奶与蓝莓按 1.5 倍安全库存补货。'
            : '当前门店没有低于安全库存的 SKU。',
        },
      },
    ]),
  }
}

function replenishmentScenario(
  actor: Actor,
  text: string,
  providedItems?: any[],
): Scenario {
  const target = targetStoreFor(text, actor)
  const storeId = target?.id || ''
  const storeName = target?.name || '当前门店'
  const items = providedItems ?? lowStockItems(actor, { storeId })
  const totalQuantity = items.reduce((sum, item) => sum + item.suggestQty, 0)

  const approval: Approval | undefined = items.length
    ? {
        id: `AP-DRAFT-${Date.now()}`,
        type: 'replenishment',
        storeId,
        storeName,
        requester: actor.name,
        risk: items.some((item) => item.status === 'out') ? 'high' : 'medium',
        status: 'pending',
        createdAt: new Date().toISOString(),
        summary: `为${storeName}创建 ${items.length} 个 SKU 的补货申请`,
        items: items.map((item) => ({
          sku: item.id,
          name: item.name,
          quantity: item.suggestQty,
        })),
        params: {
          store: `星辰生活 · ${storeName}`,
          itemCount: items.length,
          totalQuantity,
        },
        expiresAt: '今日 18:00',
      }
    : undefined

  return {
    plan: `我会先确认${storeName}的低库存 SKU，再生成补货申请草稿，提交后进入区域经理审批。`,
    tools: [
      tool(TOOL.GET_LOW_STOCK, { storeId }, 520),
      tool(TOOL.CREATE_REPLENISHMENT_DRAFT, { storeId }, 860),
    ],
    reply: items.length
      ? `我整理了 ${items.length} 个低库存 SKU，建议补货 ${totalQuantity} 件。提交后会进入区域经理审批。`
      : `${storeName}当前没有低于安全库存的 SKU，不需要创建补货申请。`,
    ui: createCard('补货申请草稿', `${storeName} · 提交前请确认数量`, [
      {
        type: 'table',
        props: {
          title: '补货明细',
          columns: replenishmentColumns(),
          rows: items,
          maxHeight: 230,
        },
      },
      {
        type: 'callout',
        props: {
          tone: 'info',
          title: '审批路径',
          text: '店长提交 → 区域经理审批 → 仓库发货 → 门店确认收货。审批与收货结果都会写入审计日志。',
        },
      },
    ]),
    approval,
  }
}

export function pickScenario(
  text: string,
  actor: Actor,
  overrides: { lowStockItems?: any[] } = {},
): Scenario {
  const content = String(text || '')
  if (/补货|补货申请|低库存.*申请/.test(content)) {
    return replenishmentScenario(
      actor,
      content,
      overrides.lowStockItems,
    )
  }
  if (/库存|低库存|安全库存|缺货/.test(content)) {
    return inventoryScenario(actor, content, overrides.lowStockItems)
  }
  if (/异常|风险|重点关注|下滑/.test(content)) {
    return anomalyScenario(actor)
  }
  return salesScenario(actor, content)
}
