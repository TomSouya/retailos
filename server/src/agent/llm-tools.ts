import { TOOL } from '../domain/tools'
import { Actor, UiNode } from '../domain/types'
import { sanitizeUiPayload } from './ui-schema'

function table(
  title: string,
  columns: any[],
  rows: any[],
  maxHeight = 240,
): UiNode {
  return { type: 'table', props: { title, columns, rows, maxHeight } }
}

function metrics(items: any[]): UiNode {
  return { type: 'metricGrid', props: { items } }
}

export const LLM_TOOLS = [
  {
    type: 'function',
    function: {
      name: TOOL.GET_SALES_SUMMARY,
      description: '查询指定门店或当前权限范围的销售额、订单量、客单价、毛利与环比',
      parameters: {
        type: 'object',
        properties: {
          storeId: { type: 'string', description: '门店编号，例如 S001' },
          range: {
            type: 'string',
            enum: ['today', 'week', 'month'],
            description: '统计周期，默认 week',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.GET_SALES_TREND,
      description: '查询销售趋势，可按今日、本周或本月聚合',
      parameters: {
        type: 'object',
        properties: {
          storeId: { type: 'string', description: '门店编号' },
          range: {
            type: 'string',
            enum: ['today', 'week', 'month'],
            description: '统计周期，默认 week',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.GET_STORE_RANKING,
      description: '按销售额计算门店排行，仅区域经理与企业老板可用',
      parameters: {
        type: 'object',
        properties: {
          top: { type: 'number', description: '返回前几名，默认 6' },
          range: {
            type: 'string',
            enum: ['today', 'week', 'month'],
            description: '统计周期，默认 week',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.GET_INVENTORY,
      description: '查询门店库存明细，可按门店过滤',
      parameters: {
        type: 'object',
        properties: {
          storeId: { type: 'string', description: '门店编号' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.GET_LOW_STOCK,
      description: '筛选低于安全库存或已缺货的商品',
      parameters: {
        type: 'object',
        properties: {
          storeId: { type: 'string', description: '门店编号' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.SCAN_ANOMALIES,
      description: '扫描经营异常门店，返回风险等级与说明',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.SEARCH_PRODUCTS,
      description: '按名称或 SKU 搜索商品，返回价格、安全库存与上下架状态',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '商品名称或 SKU 关键词' },
          limit: { type: 'number', description: '返回条数，默认 8' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.LIST_PURCHASE_ORDERS,
      description: '查询采购单，支持按单号、供应商、门店关键词与状态过滤',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '采购单号、供应商或门店关键词' },
          status: {
            type: 'string',
            enum: ['draft', 'pending', 'approved', 'received'],
            description: '采购单状态',
          },
          limit: { type: 'number', description: '返回条数，默认 8' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.LIST_SALES_ORDERS,
      description: '查询销售订单，支持按订单号、会员、门店与状态过滤',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '订单号、会员或门店关键词' },
          storeId: { type: 'string', description: '门店编号' },
          status: {
            type: 'string',
            enum: ['paid', 'partially_refunded', 'refunded'],
            description: '订单状态',
          },
          limit: { type: 'number', description: '返回条数，默认 8' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.LIST_PENDING_APPROVALS,
      description: '查询当前待审批的补货申请与退款申请',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.CREATE_REPLENISHMENT_DRAFT,
      description:
        '为门店生成补货申请草稿。不会直接写入数据库，用户需在确认卡片中提交。',
      parameters: {
        type: 'object',
        properties: {
          storeId: { type: 'string', description: '门店编号，例如 S001' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.CREATE_PURCHASE_ORDER_DRAFT,
      description:
        '为门店生成采购单草稿（默认按低库存商品补货）。不会直接写入数据库，用户需在确认卡片中创建。',
      parameters: {
        type: 'object',
        properties: {
          storeId: { type: 'string', description: '门店编号，例如 S001' },
          supplierId: {
            type: 'string',
            description: '供应商编号，不填则使用默认启用供应商',
          },
          items: {
            type: 'array',
            description: '采购明细；不填则按该门店低库存商品自动生成',
            items: {
              type: 'object',
              properties: {
                sku: { type: 'string', description: '商品 SKU' },
                quantity: { type: 'number', description: '采购数量' },
              },
              required: ['sku', 'quantity'],
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.PREPARE_APPROVAL_DECISION,
      description:
        '准备对一条待审批申请的决定（通过或驳回）。不会直接执行，用户需在确认卡片中确认。',
      parameters: {
        type: 'object',
        properties: {
          approvalId: {
            type: 'string',
            description: '申请编号，例如 AP-20261121-123456',
          },
          decision: {
            type: 'string',
            enum: ['approved', 'rejected'],
            description: 'approved 表示通过，rejected 表示驳回',
          },
        },
        required: ['approvalId', 'decision'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.PREPARE_REFUND_REQUEST,
      description:
        '为已支付订单准备退款申请。不会立即退款，用户需在确认卡片中提交审批。',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: '销售订单号，例如 SO-20261121-1001',
          },
          amount: {
            type: 'number',
            description: '退款金额，不填则退可退金额',
          },
          reason: {
            type: 'string',
            description: '退款原因，必填，最多 200 字',
          },
        },
        required: ['orderId', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.PREPARE_PURCHASE_ORDER_ACTION,
      description:
        '准备提交或审批采购单。不会直接执行，用户需在确认卡片中确认。',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: '采购单号，例如 PO-20261121-1234',
          },
          action: {
            type: 'string',
            enum: ['submit', 'approve'],
            description: 'submit 提交草稿，approve 审批通过待审批采购单',
          },
        },
        required: ['orderId', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.PREPARE_STORE_CREATE,
      description:
        '准备新建门店。不会直接写入数据库，用户需在确认卡片中确认。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '门店名称，例如 徐汇滨江店' },
          city: { type: 'string', description: '所在城市，例如 上海' },
          region: { type: 'string', description: '所属区域，例如 华东' },
          manager: { type: 'string', description: '店长姓名' },
          phone: { type: 'string', description: '联系电话' },
          openedAt: {
            type: 'string',
            description: '开业日期 YYYY-MM-DD，不填默认今天',
          },
        },
        required: ['name', 'city', 'region', 'manager', 'phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.PREPARE_MEMBER_CREATE,
      description:
        '准备新建会员档案。不会直接写入数据库，用户需在确认卡片中确认。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '会员姓名' },
          phone: { type: 'string', description: '11 位手机号' },
          level: {
            type: 'string',
            enum: ['diamond', 'gold', 'silver', 'basic'],
            description: '会员等级，默认 basic',
          },
          storeId: { type: 'string', description: '所属门店编号，例如 S001' },
          points: { type: 'number', description: '初始积分，默认 0' },
        },
        required: ['name', 'phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.PREPARE_PRODUCT_CREATE,
      description:
        '准备新建商品档案。不会直接写入数据库，用户需在确认卡片中确认。',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'SKU 编号，不填则由系统生成',
          },
          name: { type: 'string', description: '商品名称' },
          category: { type: 'string', description: '商品分类名称，需已存在' },
          price: { type: 'number', description: '销售单价' },
          costPrice: { type: 'number', description: '成本价，默认 0' },
          unit: { type: 'string', description: '单位，默认 件' },
          safetyStock: { type: 'number', description: '安全库存，默认 0' },
        },
        required: ['name', 'category', 'price'],
      },
    },
  },
]

export function systemPrompt(actor: Actor) {
  return [
    '你是 RetailOS 的经营助手，服务连锁零售门店的管理者。',
    `当前用户：${actor.name}（${actor.label}），数据范围：${actor.scope}。`,
    '规则：',
    '1. 涉及销售、毛利、毛利率、库存、库存周转、售罄率、商品、采购单、订单等事实数据时，必须先调用工具，禁止编造数字。',
    '2. 工具返回为空时如实说明，并给出可执行的下一步建议。',
    '3. 用简洁中文回答，先给结论，再给关键数字；不要输出 JSON。',
    '4. 用户要求补货时调用 create_replenishment_draft；要求下采购单时调用 create_purchase_order_draft。两者都只生成草稿，必须由用户在确认卡片中确认，不要声称已提交。',
    '5. 用户询问审批进度时，调用 list_pending_approvals 查询；用户要求通过或驳回某条申请时，先确认申请编号，再调用 prepare_approval_decision 生成确认卡片，不要声称已处理。',
    '6. 用户要求给订单退款时，先确认订单号、退款金额与原因，再调用 prepare_refund_request 生成确认卡片；退款需要审批，不要声称已退款。',
    '7. 用户要求提交或审批采购单时，先确认采购单号，调用 prepare_purchase_order_action 生成确认卡片；不要声称已提交或已审批。',
    '8. 所有写操作都必须先产出确认卡片，只有用户在卡片上确认后才会真正执行。',
    '9. 用户要求新建门店、会员或商品时，先确认必填信息，分别调用 prepare_store_create / prepare_member_create / prepare_product_create 生成确认卡片；不要直接创建，也不要编造编号。',
    '10. 自我介绍类问题直接回答，不要调用工具。',
  ].join('\n')
}

export function buildLlmUi(
  results: Array<{ name: string; output: any }>,
): UiNode | undefined {
  const children: UiNode[] = []

  for (const { name, output } of results) {
    if (!output) continue

    if (name === TOOL.SEARCH_PRODUCTS) {
      children.push(
        metrics([
          { label: '命中商品', value: output.total, format: 'number' },
          {
            label: '在售',
            value: output.summary?.active || 0,
            format: 'number',
            tone: 'success',
          },
          {
            label: '已下架',
            value: output.summary?.inactive || 0,
            format: 'number',
          },
          { label: '展示条数', value: output.rows?.length || 0, format: 'number' },
        ]),
        table(
          '商品搜索结果',
          [
            { key: 'id', label: 'SKU', width: '86px' },
            { key: 'name', label: '商品', minWidth: '120px' },
            { key: 'category', label: '分类', width: '64px' },
            { key: 'price', label: '单价', align: 'right', format: 'currency1' },
            {
              key: 'safetyStock',
              label: '安全',
              align: 'right',
              format: 'number',
              width: '48px',
            },
            { key: 'status', label: '状态', format: 'status', width: '70px' },
          ],
          output.rows || [],
        ),
      )
      continue
    }

    if (name === TOOL.LIST_PURCHASE_ORDERS) {
      children.push(
        metrics([
          { label: '采购单', value: output.total, format: 'number' },
          {
            label: '待审批',
            value: output.summary?.pending || 0,
            format: 'number',
            tone: 'accent',
          },
          {
            label: '待验收',
            value: output.summary?.approved || 0,
            format: 'number',
          },
          {
            label: '已入库',
            value: output.summary?.received || 0,
            format: 'number',
            tone: 'success',
          },
        ]),
        table(
          '采购单查询结果',
          [
            { key: 'id', label: '采购单号', width: '118px' },
            { key: 'supplierName', label: '供应商', minWidth: '96px' },
            { key: 'storeName', label: '门店', width: '64px' },
            {
              key: 'totalAmount',
              label: '金额',
              align: 'right',
              format: 'currency',
            },
            { key: 'status', label: '状态', format: 'status', width: '70px' },
            { key: 'createdAt', label: '创建时间', width: '112px' },
          ],
          output.rows || [],
        ),
      )
      continue
    }

    if (name === TOOL.LIST_SALES_ORDERS) {
      children.push(
        metrics([
          { label: '订单数', value: output.total, format: 'number' },
          {
            label: '已支付',
            value: output.summary?.paid || 0,
            format: 'number',
            tone: 'success',
          },
          {
            label: '已退款',
            value: output.summary?.refunded || 0,
            format: 'number',
            tone: 'danger',
          },
          {
            label: '累计金额',
            value: output.summary?.amount || 0,
            format: 'currency',
          },
        ]),
        table(
          '销售订单查询结果',
          [
            { key: 'id', label: '订单号', width: '118px' },
            { key: 'storeName', label: '门店', width: '64px' },
            { key: 'memberName', label: '会员', minWidth: '64px' },
            { key: 'amount', label: '金额', align: 'right', format: 'currency' },
            { key: 'status', label: '状态', format: 'status', width: '70px' },
            { key: 'createdAt', label: '时间', width: '112px' },
          ],
          output.rows || [],
        ),
      )
      continue
    }

    if (name === TOOL.LIST_PENDING_APPROVALS) {
      children.push(
        metrics([
          { label: '待审批', value: output.total, format: 'number', tone: 'accent' },
          {
            label: '补货申请',
            value: output.summary?.replenishment || 0,
            format: 'number',
          },
          {
            label: '退款申请',
            value: output.summary?.refund || 0,
            format: 'number',
          },
          {
            label: '高风险',
            value: output.summary?.highRisk || 0,
            format: 'number',
            tone: 'danger',
          },
        ]),
        table(
          '待审批列表',
          [
            { key: 'id', label: '申请编号', width: '112px' },
            { key: 'typeLabel', label: '类型', width: '56px' },
            { key: 'storeName', label: '门店', width: '64px' },
            { key: 'requester', label: '申请人', width: '64px' },
            { key: 'summary', label: '摘要', minWidth: '140px' },
            { key: 'risk', label: '风险', format: 'status', width: '58px' },
            { key: 'createdAt', label: '时间', width: '112px' },
          ],
          output.rows || [],
        ),
      )
      continue
    }

    if (name === TOOL.GET_INVENTORY) {
      const items = output.items || []
      children.push(
        metrics([
          { label: 'SKU 数', value: items.length, format: 'number' },
          {
            label: '低库存',
            value: items.filter((item: any) => item.status === 'low').length,
            format: 'number',
            tone: 'accent',
          },
          {
            label: '已缺货',
            value: items.filter((item: any) => item.status === 'out').length,
            format: 'number',
            tone: 'danger',
          },
        ]),
        table(
          '库存明细',
          [
            { key: 'id', label: 'SKU', width: '86px' },
            { key: 'name', label: '商品', minWidth: '120px' },
            { key: 'storeName', label: '门店', width: '64px' },
            {
              key: 'stock',
              label: '当前',
              align: 'right',
              format: 'number',
              width: '56px',
            },
            {
              key: 'safetyStock',
              label: '安全',
              align: 'right',
              format: 'number',
              width: '56px',
            },
            { key: 'status', label: '状态', format: 'status', width: '76px' },
          ],
          items,
        ),
      )
      continue
    }

    if (name === TOOL.GET_LOW_STOCK) {
      children.push(
        table(
          '低库存清单',
          [
            { key: 'id', label: 'SKU', width: '86px' },
            { key: 'name', label: '商品', minWidth: '120px' },
            { key: 'storeName', label: '门店', width: '64px' },
            {
              key: 'stock',
              label: '当前',
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
          ],
          output.items || [],
        ),
      )
      continue
    }

    if (name === TOOL.GET_SALES_SUMMARY) {
      children.push(
        metrics([
          {
            label: '销售额',
            value: output.sales,
            format: 'currency',
            delta: `${Number(output.delta) >= 0 ? '+' : ''}${Number(output.delta).toFixed(1)}%`,
            tone: 'accent',
          },
          { label: '订单量', value: output.orders, format: 'number' },
          { label: '客单价', value: output.aov, format: 'currency1', tone: 'success' },
          {
            label: '毛利额',
            value: output.grossProfit ?? 0,
            format: 'currency',
            tone: 'success',
          },
          {
            label: '毛利率',
            value: `${Number(output.grossMargin ?? 0).toFixed(1)}%`,
          },
          { label: '门店数', value: output.stores, format: 'number' },
        ]),
      )
      continue
    }

    if (name === TOOL.GET_SALES_TREND) {
      children.push({
        type: 'chart',
        props: {
          title: '销售趋势',
          kind: 'line',
          x: output.labels || [],
          series: [{ name: '销售额', data: output.sales || [] }],
          height: '180px',
        },
      })
      continue
    }

    if (name === TOOL.GET_STORE_RANKING) {
      children.push(
        table(
          '门店排行',
          [
            { key: 'rank', label: '#', width: '42px' },
            { key: 'name', label: '门店', minWidth: '96px' },
            { key: 'region', label: '区域', width: '64px' },
            { key: 'sales', label: '销售额', align: 'right', format: 'currency' },
            { key: 'delta', label: '环比', align: 'right', format: 'delta' },
          ],
          output.stores || [],
        ),
      )
      continue
    }

    if (name === TOOL.SCAN_ANOMALIES) {
      children.push(
        table(
          '异常清单',
          [
            { key: 'store', label: '门店', minWidth: '72px' },
            { key: 'type', label: '异常', minWidth: '80px' },
            { key: 'severity', label: '等级', format: 'status', width: '64px' },
            { key: 'time', label: '时间', align: 'right', width: '58px' },
          ],
          output.anomalies || [],
        ),
      )
    }
  }

  if (!children.length) return undefined
  return sanitizeUiPayload({
    type: 'card',
    props: { title: '经营查询结果', subtitle: '由经营助手实时查询' },
    children,
  })
}
