/**
 * Agent 可调用工具的白名单。
 * 前后端必须使用同一份名称，避免字符串漂移。
 */
export const AGENT_TOOL = Object.freeze({
  GET_SALES_SUMMARY: 'get_sales_summary',
  GET_SALES_TREND: 'get_sales_trend',
  GET_STORE_RANKING: 'get_store_ranking',
  GET_ORDER_COUNT: 'get_order_count',
  SCAN_ANOMALIES: 'scan_anomalies',
  GET_INVENTORY: 'get_inventory',
  GET_LOW_STOCK: 'get_low_stock',
  CREATE_REPLENISHMENT_DRAFT: 'create_replenishment_draft',
  CREATE_REPLENISHMENT: 'create_replenishment',
  SEARCH_PRODUCTS: 'search_products',
  LIST_PURCHASE_ORDERS: 'list_purchase_orders',
  LIST_SALES_ORDERS: 'list_sales_orders',
  LIST_PENDING_APPROVALS: 'list_pending_approvals',
})

export const AGENT_TOOL_LABELS = Object.freeze({
  [AGENT_TOOL.GET_SALES_SUMMARY]: '查询销售额',
  [AGENT_TOOL.GET_SALES_TREND]: '读取销售趋势',
  [AGENT_TOOL.GET_STORE_RANKING]: '计算门店排行',
  [AGENT_TOOL.GET_ORDER_COUNT]: '查询订单量',
  [AGENT_TOOL.SCAN_ANOMALIES]: '扫描经营异常',
  [AGENT_TOOL.GET_INVENTORY]: '查询门店库存',
  [AGENT_TOOL.GET_LOW_STOCK]: '筛选低库存',
  [AGENT_TOOL.CREATE_REPLENISHMENT_DRAFT]: '生成补货草稿',
  [AGENT_TOOL.CREATE_REPLENISHMENT]: '创建补货申请',
  [AGENT_TOOL.SEARCH_PRODUCTS]: '搜索商品',
  [AGENT_TOOL.LIST_PURCHASE_ORDERS]: '查询采购单',
  [AGENT_TOOL.LIST_SALES_ORDERS]: '查询销售订单',
  [AGENT_TOOL.LIST_PENDING_APPROVALS]: '查询待审批',
})
