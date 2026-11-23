import { stores } from '@/mocks/data'
import {
  agentReadModel,
  executeTool,
  resolveTargetStore,
} from '@/mocks/agentServer'
import { AGENT_TOOL, AGENT_TOOL_LABELS } from '@/contracts/tools'
import { UI_NODE, createCard } from '@/contracts/uiSchema'
import { createApprovalRequest } from '@/contracts/approval'
import { formatCurrency, formatNumber } from '@/utils/format'

function tool(name, input, duration) {
  return {
    name,
    label: AGENT_TOOL_LABELS[name],
    input,
    duration,
  }
}

function metricGrid(items) {
  return {
    type: UI_NODE.METRIC_GRID,
    props: { items },
  }
}

function mentionedStore(text) {
  return (
    stores.find(
      (store) => text.includes(store.name) || text.includes(store.city),
    ) || null
  )
}

function targetStoreFor(text, actor) {
  return mentionedStore(text) || resolveTargetStore(actor) || stores[0]
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
    { key: 'safetyStock', label: '安全', align: 'right', format: 'number', width: '56px' },
    { key: 'status', label: '状态', format: 'status', width: '76px' },
  ]
}

function replenishmentColumns() {
  return [
    { key: 'id', label: 'SKU', width: '86px' },
    { key: 'name', label: '商品', minWidth: '132px' },
    { key: 'stock', label: '当前', align: 'right', format: 'number', width: '56px' },
    { key: 'safetyStock', label: '安全', align: 'right', format: 'number', width: '56px' },
    { key: 'suggestQty', label: '建议补货', align: 'right', format: 'number', width: '76px' },
  ]
}

function salesScenario(actor, text) {
  const namedStore = mentionedStore(text)
  const storeId =
    actor.key === 'store_manager' ? actor.storeId : namedStore?.id || undefined
  const summary = agentReadModel.salesSummary(actor, { storeId })
  const trend = agentReadModel.salesTrend(actor, { storeId })
  const canRank = actor.key !== 'store_manager'
  const ranking = canRank ? agentReadModel.storeRanking(actor) : []
  const scopeName = storeId
    ? stores.find((store) => store.id === storeId)?.name || '门店'
    : actor.scope

  const tools = [
    tool(AGENT_TOOL.GET_SALES_SUMMARY, { storeId }, 760),
    tool(AGENT_TOOL.GET_SALES_TREND, { storeId, range: 'week' }, 560),
  ]
  if (canRank) {
    tools.push(tool(AGENT_TOOL.GET_STORE_RANKING, { top: 6 }, 680))
  }

  const children = [
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
      {
        label: '会员复购率',
        value: '41.2%',
        tone: 'default',
      },
    ]),
    {
      type: UI_NODE.CHART,
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
      type: UI_NODE.TABLE,
      props: {
        title: '门店排行',
        columns: rankingColumns(),
        rows: ranking,
        maxHeight: 246,
      },
    })
  } else {
    children.push({
      type: UI_NODE.CALLOUT,
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
    ui: createCard({
      title: `${scopeName} · 本周经营概览`,
      subtitle: '2026-11-15 至 2026-11-21',
      children,
    }),
  }
}

function anomalyScenario(actor) {
  const storeId = actor.key === 'store_manager' ? actor.storeId : undefined
  const items = agentReadModel.scopedAnomalies(actor)
  const high = items.filter((item) => item.severity === 'high').length
  const medium = items.filter((item) => item.severity === 'medium').length
  const low = items.filter((item) => item.severity === 'low').length

  const tools = [tool(AGENT_TOOL.SCAN_ANOMALIES, { storeId }, 880)]
  if (actor.key !== 'store_manager') {
    tools.push(tool(AGENT_TOOL.GET_STORE_RANKING, { metric: 'sales' }, 540))
  }

  const children = [
    metricGrid([
      {
        label: '异常门店',
        value: items.length,
        format: 'number',
        tone: 'danger',
      },
      { label: '高风险', value: high, format: 'number', tone: 'danger' },
      { label: '中风险', value: medium, format: 'number', tone: 'accent' },
      { label: '低风险', value: low, format: 'number', tone: 'default' },
    ]),
    {
      type: UI_NODE.TABLE,
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
      type: UI_NODE.CALLOUT,
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
    ui: createCard({
      title: '异常门店扫描',
      subtitle: `${actor.scope} · 最近 7 天`,
      children,
    }),
  }
}

function inventoryScenario(actor, text) {
  const target = targetStoreFor(text, actor)
  const storeId = target?.id
  const items = agentReadModel.lowStockItems(actor, { storeId })
  const allItems = agentReadModel.scopedInventory(actor, storeId)
  const low = items.filter((item) => item.status === 'low').length
  const out = items.filter((item) => item.status === 'out').length
  const storeName = target?.name || '当前门店'

  return {
    plan: `我会先定位${storeName}的库存明细，筛出低于安全库存的 SKU，再给出补货建议。`,
    tools: [
      tool(AGENT_TOOL.GET_INVENTORY, { storeId }, 620),
      tool(AGENT_TOOL.GET_LOW_STOCK, { storeId }, 480),
    ],
    reply: `${storeName}有 ${items.length} 个 SKU 低于安全库存，其中 ${out} 个已缺货。`,
    ui: createCard({
      title: `${storeName} · 低库存清单`,
      subtitle: '按安全库存阈值筛选',
      children: [
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
          type: UI_NODE.TABLE,
          props: {
            title: '需要补货的 SKU',
            columns: inventoryColumns(),
            rows: items,
            maxHeight: 230,
          },
        },
        {
          type: UI_NODE.CALLOUT,
          props: {
            tone: items.length ? 'warning' : 'success',
            title: items.length ? '补货建议' : '库存正常',
            text: items.length
              ? '已缺货 SKU 建议今日优先补货；鲜奶与蓝莓按 1.5 倍安全库存补货。'
              : '当前门店没有低于安全库存的 SKU。',
          },
        },
      ],
    }),
  }
}

function replenishmentScenario(actor, text) {
  const target = targetStoreFor(text, actor)
  const storeId = target?.id
  const storeName = target?.name || '当前门店'
  const items = agentReadModel.lowStockItems(actor, { storeId })
  const totalQuantity = items.reduce((sum, item) => sum + item.suggestQty, 0)

  const approval = items.length
    ? createApprovalRequest({
        id: `AP-DRAFT-${Date.now()}`,
        type: 'replenishment',
        storeId,
        storeName,
        risk: items.some((item) => item.status === 'out') ? 'high' : 'medium',
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
      })
    : null

  return {
    plan: `我会先确认${storeName}的低库存 SKU，再生成补货申请草稿，提交后进入区域经理审批。`,
    tools: [
      tool(AGENT_TOOL.GET_LOW_STOCK, { storeId }, 520),
      tool(AGENT_TOOL.CREATE_REPLENISHMENT_DRAFT, { storeId }, 860),
    ],
    reply: items.length
      ? `我整理了 ${items.length} 个低库存 SKU，建议补货 ${totalQuantity} 件。提交后会进入区域经理审批。`
      : `${storeName}当前没有低于安全库存的 SKU，不需要创建补货申请。`,
    ui: createCard({
      title: '补货申请草稿',
      subtitle: `${storeName} · 提交前请确认数量`,
      children: [
        {
          type: UI_NODE.TABLE,
          props: {
            title: '补货明细',
            columns: replenishmentColumns(),
            rows: items,
            maxHeight: 230,
          },
        },
        {
          type: UI_NODE.CALLOUT,
          props: {
            tone: 'info',
            title: '审批路径',
            text: '店长提交 → 区域经理审批 → 仓库发货 → 门店确认收货。审批与收货结果都会写入审计日志。',
          },
        },
      ],
    }),
    approval,
  }
}

function keywordOf(text) {
  const explicit = text.match(/(?:PO|SO)-\d{8}-\d+|SKU-[A-Za-z0-9-]+/i)
  if (explicit) return explicit[0]
  return text
    .replace(/[，。？！?!、,.：:；;]/g, ' ')
    .replace(
      /(请|帮我|帮忙|查一下|查询|查看|看看|搜索|找一下|找|一下|最近|所有|全部|列表|明细|详情|状态|信息|数据|销售订单|采购单|商品|产品|采购|订单|供应商|怎么样|如何|哪些|多少|的)/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
}

function productQueryScenario(actor, text) {
  const keyword = keywordOf(text)
  const input = { keyword, limit: 8 }
  const output = executeTool({
    actor,
    tool: AGENT_TOOL.SEARCH_PRODUCTS,
    input,
  })
  const hit = keyword ? `与「${keyword}」匹配` : '当前'

  return {
    plan: `我会按关键词检索商品主数据，返回${hit} SKU 的分类、价格与上下架状态。`,
    tools: [tool(AGENT_TOOL.SEARCH_PRODUCTS, input, 640)],
    reply: output.rows.length
      ? `${hit}的商品共 ${output.total} 个，其中在售 ${output.summary.active} 个、已下架 ${output.summary.inactive} 个。`
      : `${hit}没有找到匹配的商品，可以换个关键词或 SKU 再试。`,
    ui: createCard({
      title: '商品搜索结果',
      subtitle: keyword ? `关键词：${keyword}` : '按更新时间排序',
      children: [
        metricGrid([
          { label: '命中商品', value: output.total, format: 'number' },
          { label: '在售', value: output.summary.active, format: 'number', tone: 'success' },
          { label: '已下架', value: output.summary.inactive, format: 'number' },
          { label: '展示条数', value: output.rows.length, format: 'number' },
        ]),
        {
          type: UI_NODE.TABLE,
          props: {
            title: '商品列表',
            columns: [
              { key: 'id', label: 'SKU', width: '86px' },
              { key: 'name', label: '商品', minWidth: '120px' },
              { key: 'category', label: '分类', width: '64px' },
              { key: 'price', label: '单价', align: 'right', format: 'currency1' },
              { key: 'safetyStock', label: '安全', align: 'right', format: 'number', width: '48px' },
              { key: 'status', label: '状态', format: 'status', width: '70px' },
            ],
            rows: output.rows,
            maxHeight: 240,
          },
        },
      ],
    }),
  }
}

function purchaseQueryScenario(actor, text) {
  const keyword = keywordOf(text)
  const input = { keyword, limit: 8 }
  const output = executeTool({
    actor,
    tool: AGENT_TOOL.LIST_PURCHASE_ORDERS,
    input,
  })

  return {
    plan: '我会按采购单号、供应商或门店检索采购单，汇总待审批、待验收与已入库数量。',
    tools: [tool(AGENT_TOOL.LIST_PURCHASE_ORDERS, input, 720)],
    reply: output.rows.length
      ? `共 ${formatNumber(output.total)} 张采购单：${output.summary.pending} 张待审批、${output.summary.approved} 张待验收、${output.summary.received} 张已入库。`
      : '当前范围内没有匹配的采购单。',
    ui: createCard({
      title: '采购单查询结果',
      subtitle: keyword ? `关键词：${keyword}` : '按创建时间倒序',
      children: [
        metricGrid([
          { label: '采购单', value: output.total, format: 'number' },
          { label: '待审批', value: output.summary.pending, format: 'number', tone: 'accent' },
          { label: '待验收', value: output.summary.approved, format: 'number' },
          { label: '已入库', value: output.summary.received, format: 'number', tone: 'success' },
        ]),
        {
          type: UI_NODE.TABLE,
          props: {
            title: '采购单列表',
            columns: [
              { key: 'id', label: '采购单号', width: '118px' },
              { key: 'supplierName', label: '供应商', minWidth: '96px' },
              { key: 'storeName', label: '门店', width: '64px' },
              { key: 'totalAmount', label: '金额', align: 'right', format: 'currency' },
              { key: 'status', label: '状态', format: 'status', width: '70px' },
              { key: 'createdAt', label: '创建时间', width: '112px' },
            ],
            rows: output.rows,
            maxHeight: 240,
          },
        },
      ],
    }),
  }
}

function orderQueryScenario(actor, text) {
  const keyword = keywordOf(text)
  const input = { keyword, limit: 8 }
  const output = executeTool({
    actor,
    tool: AGENT_TOOL.LIST_SALES_ORDERS,
    input,
  })

  return {
    plan: '我会按订单号、会员或门店检索销售订单，统计支付状态与累计金额。',
    tools: [tool(AGENT_TOOL.LIST_SALES_ORDERS, input, 660)],
    reply: output.rows.length
      ? `共 ${formatNumber(output.total)} 张销售订单，已支付 ${output.summary.paid} 张、已退款 ${output.summary.refunded} 张，累计 ${formatCurrency(output.summary.amount)}。`
      : '当前范围内没有匹配的销售订单。',
    ui: createCard({
      title: '销售订单查询结果',
      subtitle: keyword ? `关键词：${keyword}` : '按创建时间倒序',
      children: [
        metricGrid([
          { label: '订单数', value: output.total, format: 'number' },
          { label: '已支付', value: output.summary.paid, format: 'number', tone: 'success' },
          { label: '已退款', value: output.summary.refunded, format: 'number', tone: 'danger' },
          { label: '累计金额', value: output.summary.amount, format: 'currency' },
        ]),
        {
          type: UI_NODE.TABLE,
          props: {
            title: '订单列表',
            columns: [
              { key: 'id', label: '订单号', width: '118px' },
              { key: 'storeName', label: '门店', width: '64px' },
              { key: 'memberName', label: '会员', minWidth: '64px' },
              { key: 'amount', label: '金额', align: 'right', format: 'currency' },
              { key: 'status', label: '状态', format: 'status', width: '70px' },
              { key: 'createdAt', label: '时间', width: '112px' },
            ],
            rows: output.rows,
            maxHeight: 240,
          },
        },
      ],
    }),
  }
}

/**
 * 根据用户输入、角色与数据范围选择场景。
 * 场景只负责“计划 + UI 投影”，工具执行与鉴权在 mockStream / agentServer 中完成。
 * @param {string} text
 * @param {Object} actor
 */
export function pickScenario(text, actor) {
  const content = String(text || '')
  if (/补货|补货申请|低库存.*申请/.test(content)) {
    return replenishmentScenario(actor, content)
  }
  if (/库存|低库存|安全库存|缺货/.test(content)) {
    return inventoryScenario(actor, content)
  }
  if (/采购|供应商/.test(content)) {
    return purchaseQueryScenario(actor, content)
  }
  const wantsSalesReport =
    /销售额|销售情况|销售数据|销售业绩|营业额|客单价|环比|趋势|排行|经营概览/.test(
      content,
    )
  if (/订单/.test(content) && !wantsSalesReport) {
    return orderQueryScenario(actor, content)
  }
  if (/商品|产品|SKU/i.test(content)) {
    return productQueryScenario(actor, content)
  }
  if (/异常|风险|重点关注|下滑/.test(content)) {
    return anomalyScenario(actor, content)
  }
  return salesScenario(actor, content)
}
