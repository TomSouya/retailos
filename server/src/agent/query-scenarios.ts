import { TOOL, TOOL_LABELS } from '../domain/tools'
import { Actor, Scenario, ToolSpec, UiNode } from '../domain/types'
import { AgentToolsService } from './agent-tools.service'

function tool(
  name: string,
  input: Record<string, any>,
  duration: number,
): ToolSpec {
  return { name, label: TOOL_LABELS[name] || name, input, duration }
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

/** 从自然语言中提取单号或商品关键词。 */
function keywordOf(text: string) {
  const explicit = text.match(/(?:PO|SO)-\d{8}-\d+|SKU-[A-Za-z0-9-]+/i)
  if (explicit) return explicit[0]

  const cleaned = text
    .replace(/[，。？！?!、,.：:；;]/g, ' ')
    .replace(
      /(请|帮我|帮忙|查一下|查询|查看|看看|搜索|找一下|找|一下|最近|所有|全部|列表|明细|详情|状态|信息|数据|销售订单|采购单|商品|产品|采购|订单|供应商|怎么样|如何|哪些|多少|的)/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 20)
}

export async function productQueryScenario(
  actor: Actor,
  text: string,
  agentTools: AgentToolsService,
): Promise<Scenario> {
  const keyword = keywordOf(text)
  const input = { keyword, limit: 8 }
  const result = await agentTools.run(actor, TOOL.SEARCH_PRODUCTS, input)
  const rows = result.rows || []
  const summary = result.summary

  const hit = keyword ? `与「${keyword}」匹配` : '当前'
  return {
    plan: `我会按关键词检索商品主数据，返回 ${hit} SKU 的分类、价格、安全库存与上下架状态。`,
    tools: [tool(TOOL.SEARCH_PRODUCTS, input, 640)],
    reply: rows.length
      ? `${hit}的商品共 ${result.total} 个，其中在售 ${summary.active} 个、已下架 ${summary.inactive} 个。`
      : `${hit}没有找到匹配的商品，可以换个关键词或 SKU 再试。`,
    ui: createCard(
      '商品搜索结果',
      keyword ? `关键词：${keyword}` : '按更新时间排序',
      [
        {
          type: 'metricGrid',
          props: {
            items: [
              { label: '命中商品', value: result.total, format: 'number' },
              { label: '在售', value: summary.active, format: 'number', tone: 'success' },
              { label: '已下架', value: summary.inactive, format: 'number' },
              { label: '展示条数', value: rows.length, format: 'number' },
            ],
          },
        },
        {
          type: 'table',
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
            rows,
            maxHeight: 240,
          },
        },
      ],
    ),
  }
}

export async function purchaseOrderQueryScenario(
  actor: Actor,
  text: string,
  agentTools: AgentToolsService,
): Promise<Scenario> {
  const keyword = keywordOf(text)
  const input = { keyword, limit: 8 }
  const result = await agentTools.run(
    actor,
    TOOL.LIST_PURCHASE_ORDERS,
    input,
  )
  const rows = result.rows || []
  const summary = result.summary

  return {
    plan: '我会按采购单号、供应商或门店检索采购单，汇总待审批、待验收与已入库数量。',
    tools: [tool(TOOL.LIST_PURCHASE_ORDERS, input, 720)],
    reply: rows.length
      ? `共 ${formatNumber(result.total)} 张采购单：${summary.pending} 张待审批、${summary.approved} 张待验收、${summary.received} 张已入库。`
      : '当前范围内没有匹配的采购单。',
    ui: createCard(
      '采购单查询结果',
      keyword ? `关键词：${keyword}` : '按创建时间倒序',
      [
        {
          type: 'metricGrid',
          props: {
            items: [
              { label: '采购单', value: result.total, format: 'number' },
              { label: '待审批', value: summary.pending, format: 'number', tone: 'accent' },
              { label: '待验收', value: summary.approved, format: 'number' },
              { label: '已入库', value: summary.received, format: 'number', tone: 'success' },
            ],
          },
        },
        {
          type: 'table',
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
            rows,
            maxHeight: 240,
          },
        },
      ],
    ),
  }
}

export async function salesOrderQueryScenario(
  actor: Actor,
  text: string,
  agentTools: AgentToolsService,
): Promise<Scenario> {
  const keyword = keywordOf(text)
  const input = { keyword, limit: 8 }
  const result = await agentTools.run(actor, TOOL.LIST_SALES_ORDERS, input)
  const rows = result.rows || []
  const summary = result.summary

  return {
    plan: '我会按订单号、会员或门店检索销售订单，统计支付状态与累计金额。',
    tools: [tool(TOOL.LIST_SALES_ORDERS, input, 660)],
    reply: rows.length
      ? `共 ${formatNumber(result.total)} 张销售订单，已支付 ${summary.paid} 张、已退款 ${summary.refunded} 张，累计 ${formatCurrency(summary.amount)}。`
      : '当前范围内没有匹配的销售订单。',
    ui: createCard(
      '销售订单查询结果',
      keyword ? `关键词：${keyword}` : '按创建时间倒序',
      [
        {
          type: 'metricGrid',
          props: {
            items: [
              { label: '订单数', value: result.total, format: 'number' },
              { label: '已支付', value: summary.paid, format: 'number', tone: 'success' },
              { label: '已退款', value: summary.refunded, format: 'number', tone: 'danger' },
              { label: '累计金额', value: summary.amount, format: 'currency' },
            ],
          },
        },
        {
          type: 'table',
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
            rows,
            maxHeight: 240,
          },
        },
      ],
    ),
  }
}
