import { Injectable } from '@nestjs/common'
import { AnalyticsService } from '../analytics/analytics.service'
import { CatalogService } from '../catalog/catalog.service'
import { InventoryService } from '../inventory/inventory.service'
import { ProcurementService } from '../procurement/procurement.service'
import { OrdersService } from '../orders/orders.service'
import { ApprovalsService } from '../approvals/approvals.service'
import {
  authorizeTool,
  AgentToolError,
  resolveTargetStore,
  scopedStores,
} from '../domain/rbac'
import {
  ensurePermission,
  hasPermission,
  scopeTypeOf,
} from '../domain/permissions'
import { TOOL } from '../domain/tools'
import { Actor } from '../domain/types'

const DB_TOOLS: string[] = [
  TOOL.GET_SALES_SUMMARY,
  TOOL.GET_SALES_TREND,
  TOOL.GET_STORE_RANKING,
  TOOL.GET_INVENTORY,
  TOOL.GET_LOW_STOCK,
  TOOL.SEARCH_PRODUCTS,
  TOOL.LIST_PURCHASE_ORDERS,
  TOOL.LIST_SALES_ORDERS,
  TOOL.LIST_PENDING_APPROVALS,
  TOOL.CREATE_PURCHASE_ORDER_DRAFT,
  TOOL.PREPARE_APPROVAL_DECISION,
  TOOL.PREPARE_REFUND_REQUEST,
  TOOL.PREPARE_PURCHASE_ORDER_ACTION,
  TOOL.PREPARE_STORE_CREATE,
  TOOL.PREPARE_MEMBER_CREATE,
  TOOL.PREPARE_PRODUCT_CREATE,
]

/**
 * 经营助手的 Phase 2 工具：直接查询 MySQL，复用业务服务的角色裁剪逻辑。
 */
@Injectable()
export class AgentToolsService {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly catalog: CatalogService,
    private readonly inventory: InventoryService,
    private readonly procurement: ProcurementService,
    private readonly orders: OrdersService,
    private readonly approvals: ApprovalsService,
  ) {}

  supports(tool: string) {
    return DB_TOOLS.includes(tool)
  }

  async run(
    actor: Actor,
    tool: string,
    input: Record<string, any> = {},
  ): Promise<any> {
    const auth = authorizeTool({ actor, tool, input })
    if (!auth.allowed) {
      throw new AgentToolError('FORBIDDEN', auth.reason || '无权调用该工具')
    }

    const limit = Math.min(Number(input.limit) || 8, 20)
    const keyword = String(input.keyword || '').trim()

    switch (tool) {
      case TOOL.GET_SALES_SUMMARY:
        return this.analytics.summary(actor, {
          storeId: input.storeId,
          range: input.range,
        })
      case TOOL.GET_SALES_TREND:
        return this.analytics.trend(actor, {
          storeId: input.storeId,
          range: input.range,
        })
      case TOOL.GET_STORE_RANKING:
        return {
          stores: await this.analytics.ranking(actor, {
            range: input.range,
          }),
        }
      case TOOL.PREPARE_REFUND_REQUEST: {
        const orderId = String(input.orderId || '').trim()
        if (!orderId) {
          throw new AgentToolError('ORDER_REQUIRED', '请提供销售订单号')
        }

        const order = await this.orders.detail(actor, orderId)
        if (!['paid', 'partially_refunded'].includes(order.status)) {
          throw new AgentToolError(
            'ORDER_NOT_REFUNDABLE',
            '该订单当前不可退款',
          )
        }

        const refundable = Number(order.refundableAmount)
        const rawAmount = input.amount
        const amount =
          rawAmount === undefined || rawAmount === null || rawAmount === ''
            ? refundable
            : Number(rawAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new AgentToolError(
            'REFUND_AMOUNT_INVALID',
            '退款金额不合法',
          )
        }
        if (amount > refundable + 0.001) {
          throw new AgentToolError(
            'REFUND_AMOUNT_EXCEEDED',
            `退款金额不能超过可退金额 ¥${refundable}`,
          )
        }

        const reason = String(input.reason || '').trim()
        if (!reason) {
          throw new AgentToolError(
            'REFUND_REASON_REQUIRED',
            '请填写退款原因',
          )
        }
        if (reason.length > 200) {
          throw new AgentToolError(
            'REFUND_REASON_TOO_LONG',
            '退款原因不能超过 200 字',
          )
        }

        return {
          kind: 'refund_request',
          orderId: order.id,
          storeId: order.storeId,
          storeName: order.storeName,
          memberName: order.memberName,
          orderAmount: Number(order.amount),
          refundableAmount: refundable,
          amount: Math.round(amount * 100) / 100,
          reason,
        }
      }
      case TOOL.PREPARE_PURCHASE_ORDER_ACTION: {
        const orderId = String(input.orderId || '').trim()
        const action = input.action === 'approve' ? 'approve' : 'submit'
        if (!orderId) {
          throw new AgentToolError('ORDER_REQUIRED', '请提供采购单号')
        }
        if (
          action === 'approve' &&
          !hasPermission(actor, 'procurement.approve')
        ) {
          throw new AgentToolError(
            'FORBIDDEN',
            '当前角色不能审批采购单',
          )
        }

        const orders = await this.procurement.list(actor, {
          search: orderId,
        })
        const order = orders.find((item) => item.id === orderId)
        if (!order) {
          throw new AgentToolError(
            'ORDER_NOT_FOUND',
            '未找到该采购单，或它不在你的权限范围内',
          )
        }
        if (action === 'submit' && order.status !== 'draft') {
          throw new AgentToolError(
            'ORDER_NOT_DRAFT',
            '只有草稿采购单可以提交',
          )
        }
        if (action === 'approve' && order.status !== 'pending') {
          throw new AgentToolError(
            'ORDER_NOT_PENDING',
            '只有待审批采购单可以审批',
          )
        }

        return {
          kind: 'purchase_order_action',
          orderId: order.id,
          action,
          status: order.status,
          supplierName: order.supplierName,
          storeName: order.storeName,
          totalAmount: Number(order.totalAmount),
          itemCount: order.itemCount,
          items: (order.items || []).slice(0, 8).map((item: any) => ({
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }
      }
      case TOOL.GET_INVENTORY: {
        const items = await this.inventory.list(actor, {
          storeId: input.storeId,
          search: keyword,
          status: input.status,
        })
        return {
          kind: 'inventory',
          total: items.length,
          items: items.slice(0, limit),
        }
      }
      case TOOL.GET_LOW_STOCK: {
        const items = await this.inventory.list(actor, {
          storeId: input.storeId,
          search: keyword,
        })
        const lowStock = items
          .filter((item) => item.status !== 'normal')
          .map((item) => ({
            ...item,
            suggestQty: Math.max(item.safetyStock - item.stock, 12),
          }))
        return {
          kind: 'low_stock',
          total: lowStock.length,
          items: lowStock.slice(0, limit),
        }
      }
      case TOOL.SEARCH_PRODUCTS: {
        const products = await this.catalog.listProducts(actor, {
          search: keyword,
          category: input.category,
          status: input.status,
        })
        return {
          kind: 'products',
          total: products.length,
          summary: {
            active: products.filter((item) => item.status === 'active').length,
            inactive: products.filter((item) => item.status === 'inactive').length,
          },
          rows: products.slice(0, limit),
        }
      }
      case TOOL.LIST_PURCHASE_ORDERS: {
        const orders = await this.procurement.list(actor, {
          search: keyword,
          status: input.status,
        })
        const countBy = (status: string) =>
          orders.filter((item) => item.status === status).length
        return {
          kind: 'purchase_orders',
          total: orders.length,
          summary: {
            draft: countBy('draft'),
            pending: countBy('pending'),
            approved: countBy('approved'),
            received: countBy('received'),
          },
          rows: orders.slice(0, limit),
        }
      }
      case TOOL.LIST_SALES_ORDERS: {
        const orders = await this.orders.list(actor, {
          search: keyword,
          status: input.status,
          storeId: input.storeId,
        })
        return {
          kind: 'sales_orders',
          total: orders.length,
          summary: {
            paid: orders.filter((item) => item.status === 'paid').length,
            refunded: orders.filter((item) => item.status === 'refunded').length,
            amount: orders.reduce((sum, item) => sum + Number(item.amount), 0),
          },
          rows: orders.slice(0, limit),
        }
      }
      case TOOL.LIST_PENDING_APPROVALS: {
        const approvals = await this.approvals.list(actor)
        const pending = approvals.filter((item) => item.status === 'pending')
        return {
          kind: 'approvals',
          total: pending.length,
          summary: {
            replenishment: pending.filter(
              (item) => item.type === 'replenishment',
            ).length,
            refund: pending.filter((item) => item.type === 'refund').length,
            highRisk: pending.filter((item) => item.risk === 'high').length,
          },
          rows: pending.slice(0, limit).map((item) => ({
            ...item,
            typeLabel: item.type === 'refund' ? '退款' : '补货',
          })),
        }
      }
      case TOOL.CREATE_PURCHASE_ORDER_DRAFT: {
        const store = resolveTargetStore(actor, input.storeId)
        if (!store) {
          throw new AgentToolError(
            'STORE_REQUIRED',
            '未找到可操作门店，请指定门店编号',
          )
        }

        const inventory = await this.inventory.list(actor, {
          storeId: store.id,
        })
        const bySku = new Map(inventory.map((item) => [item.sku, item]))

        const rawItems = Array.isArray(input.items) ? input.items : []
        const lines = rawItems.length
          ? rawItems.slice(0, 10).map((item: any) => {
              const sku = String(item.sku || '').trim()
              const record = bySku.get(sku)
              if (!record) {
                throw new AgentToolError(
                  'SKU_NOT_FOUND',
                  `${store.name}没有 ${sku || '该商品'} 的库存记录`,
                )
              }
              return {
                sku: record.sku,
                name: record.name,
                quantity: Math.max(Math.round(Number(item.quantity) || 0), 1),
                unitPrice: Number(record.price),
              }
            })
          : inventory
              .filter((item) => item.stock < item.safetyStock)
              .slice(0, 8)
              .map((item) => ({
                sku: item.sku,
                name: item.name,
                quantity: Math.max(item.safetyStock - item.stock, 12),
                unitPrice: Number(item.price),
              }))

        if (!lines.length) {
          throw new AgentToolError(
            'NO_LOW_STOCK',
            `${store.name}当前没有低于安全库存的商品，也没有指定采购明细`,
          )
        }

        const suppliers = await this.catalog.listSuppliers(actor)
        const supplier = input.supplierId
          ? suppliers.find((item) => item.id === input.supplierId)
          : suppliers.find((item) => item.status === 'active') || suppliers[0]
        if (!supplier) {
          throw new AgentToolError('SUPPLIER_REQUIRED', '没有可用供应商')
        }

        const totalAmount = lines.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        )

        return {
          kind: 'purchase_order_draft',
          storeId: store.id,
          storeName: store.name,
          supplierId: supplier.id,
          supplierName: supplier.name,
          note: '由经营助手生成，待确认',
          items: lines,
          totalAmount: Math.round(totalAmount * 100) / 100,
        }
      }
      case TOOL.PREPARE_APPROVAL_DECISION: {
        const approvalId = String(input.approvalId || '').trim()
        if (!approvalId) {
          throw new AgentToolError('APPROVAL_REQUIRED', '请提供申请编号')
        }
        if (!hasPermission(actor, 'procurement.approve')) {
          throw new AgentToolError('FORBIDDEN', '当前角色不能审批申请')
        }

        const approvals = await this.approvals.list(actor)
        const approval = approvals.find((item) => item.id === approvalId)
        if (!approval) {
          throw new AgentToolError(
            'APPROVAL_NOT_FOUND',
            '未找到该申请，或它不在你的审批范围内',
          )
        }
        if (approval.status !== 'pending') {
          throw new AgentToolError('APPROVAL_DECIDED', '该申请已处理')
        }

        return {
          kind: 'approval_decision',
          approvalId: approval.id,
          decision: input.decision === 'rejected' ? 'rejected' : 'approved',
          type: approval.type,
          typeLabel: approval.type === 'refund' ? '退款申请' : '补货申请',
          storeId: approval.storeId,
          storeName: approval.storeName,
          requester: approval.requester,
          risk: approval.risk,
          summary: approval.summary || '',
          items: approval.items,
          expiresAt: '处理前有效',
        }
      }
      case TOOL.PREPARE_STORE_CREATE: {
        ensurePermission(actor, 'stores.write', '新增门店')

        const name = String(input.name || '').trim()
        const city = String(input.city || '').trim()
        const region = String(input.region || '').trim()
        const manager = String(input.manager || '').trim()
        const phone = String(input.phone || '').trim()
        const openedAt = String(
          input.openedAt || new Date().toISOString().slice(0, 10),
        ).trim()

        if (!name || !city || !region || !manager || !phone) {
          throw new AgentToolError(
            'STORE_FIELDS_REQUIRED',
            '门店名称、城市、区域、店长和电话不能为空',
          )
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(openedAt)) {
          throw new AgentToolError(
            'STORE_DATE_INVALID',
            '开业时间格式应为 YYYY-MM-DD',
          )
        }
        if (scopeTypeOf(actor.key) !== 'global' && region !== actor.region) {
          throw new AgentToolError(
            'FORBIDDEN',
            `当前角色只能在${actor.region}区域新增门店`,
          )
        }

        return {
          kind: 'store_create',
          name,
          city,
          region,
          manager,
          phone,
          openedAt,
        }
      }
      case TOOL.PREPARE_MEMBER_CREATE: {
        ensurePermission(actor, 'members.write', '新增会员')

        const name = String(input.name || '').trim()
        const phone = String(input.phone || '').trim()
        const level = String(input.level || 'basic').trim()
        const points =
          input.points === undefined || input.points === null
            ? 0
            : Number(input.points)
        let storeId = String(input.storeId || '').trim()
        if (!storeId && scopeTypeOf(actor.key) === 'store') {
          storeId = actor.storeId || ''
        }

        if (!name || !phone) {
          throw new AgentToolError(
            'MEMBER_FIELDS_REQUIRED',
            '会员姓名和手机号不能为空',
          )
        }
        if (!/^1\d{10}$/.test(phone)) {
          throw new AgentToolError(
            'MEMBER_PHONE_INVALID',
            '请输入 11 位手机号',
          )
        }
        if (!['diamond', 'gold', 'silver', 'basic'].includes(level)) {
          throw new AgentToolError('MEMBER_LEVEL_INVALID', '会员等级不合法')
        }
        if (!Number.isInteger(points) || points < 0) {
          throw new AgentToolError(
            'MEMBER_POINTS_INVALID',
            '积分必须为非负整数',
          )
        }

        const store = scopedStores(actor).find((item) => item.id === storeId)
        if (!store) {
          throw new AgentToolError(
            'STORE_REQUIRED',
            '请指定会员所属门店编号，且它需要在你的权限范围内',
          )
        }

        return {
          kind: 'member_create',
          name,
          phone,
          level,
          points,
          storeId: store.id,
          storeName: store.name,
        }
      }
      case TOOL.PREPARE_PRODUCT_CREATE: {
        ensurePermission(actor, 'products.write', '新增商品')

        const name = String(input.name || '').trim()
        const category = String(input.category || '').trim()
        const price = Number(input.price)
        const costPrice =
          input.costPrice === undefined || input.costPrice === null
            ? 0
            : Number(input.costPrice)
        const unit = String(input.unit || '件').trim()
        const safetyStock = Number(input.safetyStock) || 0
        const id = String(input.id || '').trim()

        if (!name || !category) {
          throw new AgentToolError(
            'PRODUCT_FIELDS_REQUIRED',
            '商品名称和分类不能为空',
          )
        }
        if (!Number.isFinite(price) || price < 0) {
          throw new AgentToolError('PRODUCT_PRICE_INVALID', '商品价格不合法')
        }
        if (!Number.isFinite(costPrice) || costPrice < 0) {
          throw new AgentToolError(
            'PRODUCT_COST_INVALID',
            '商品成本价不合法',
          )
        }

        const categories = await this.catalog.listCategories(actor)
        if (!categories.some((item) => item.name === category)) {
          throw new AgentToolError(
            'PRODUCT_CATEGORY_INVALID',
            `分类「${category}」不存在，请先在商品管理中创建`,
          )
        }
        if (id) {
          const products = await this.catalog.listProducts(actor, {
            search: id,
          })
          if (products.some((item) => item.id === id)) {
            throw new AgentToolError('PRODUCT_EXISTS', 'SKU 已存在')
          }
        }

        return {
          kind: 'product_create',
          id,
          name,
          category,
          price,
          costPrice,
          unit,
          safetyStock,
        }
      }
      default:
        throw new AgentToolError('UNKNOWN_TOOL', `未知工具：${tool}`)
    }
  }
}
