import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common'
import { AnalyticsService } from '../analytics/analytics.service'
import { AuditService } from '../audit/audit.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { InventoryService } from '../inventory/inventory.service'
import { MembersService } from '../members/members.service'
import { OrdersService } from '../orders/orders.service'

const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: '已支付',
  partially_refunded: '部分退款',
  refunded: '已退款',
  cancelled: '已取消',
}

const PAYMENT_LABELS: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  card: '银行卡',
  cash: '现金',
}

const INVENTORY_STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  low: '低库存',
  out: '缺货',
}

const RISK_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows: unknown[][]) {
  const body = rows
    .map((row) => row.map((cell) => csvCell(cell)).join(','))
    .join('\r\n')
  return `\uFEFF${body}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function stamp(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function sendCsv(res: any, filename: string, rows: unknown[][]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  )
  res.send(toCsv(rows))
}

@Controller('api/exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(
    private readonly auditService: AuditService,
    private readonly ordersService: OrdersService,
    private readonly inventoryService: InventoryService,
    private readonly analyticsService: AnalyticsService,
    private readonly membersService: MembersService,
  ) {}

  @Get('audit')
  async audit(@Req() request: any, @Res() res: any) {
    const records = await this.auditService.list(request.actor)
    sendCsv(res, `retailos-audit-${stamp()}.csv`, [
      ['时间', '操作人', '角色', '动作', '对象', '结果', '审批编号', 'Trace ID'],
      ...records.map((record) => [
        record.timestamp,
        record.actor,
        record.role,
        record.action,
        record.object,
        record.result,
        record.approvalId,
        record.traceId || '—',
      ]),
    ])
  }

  @Get('orders')
  async orders(
    @Req() request: any,
    @Res() res: any,
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const orders = await this.ordersService.list(request.actor, {
      storeId,
      status,
      search,
    })
    sendCsv(res, `retailos-orders-${stamp()}.csv`, [
      [
        '订单号',
        '门店',
        '会员',
        '商品数',
        '订单金额',
        '退款金额',
        '支付方式',
        '状态',
        '下单时间',
      ],
      ...orders.map((order) => [
        order.id,
        order.storeName,
        order.memberName,
        order.itemCount,
        order.amount,
        order.refundedAmount,
        PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod,
        ORDER_STATUS_LABELS[order.status] || order.status,
        order.createdAt,
      ]),
    ])
  }

  @Get('inventory')
  async inventory(
    @Req() request: any,
    @Res() res: any,
    @Query('storeId') storeId?: string,
    @Query('search') search?: string,
  ) {
    const items = await this.inventoryService.list(request.actor, {
      storeId,
      search,
    })
    sendCsv(res, `retailos-inventory-${stamp()}.csv`, [
      [
        'SKU',
        '商品',
        '分类',
        '门店',
        '当前库存',
        '安全库存',
        '单位',
        '单价',
        '状态',
        '更新时间',
      ],
      ...items.map((item) => [
        item.sku,
        item.name,
        item.category,
        item.storeId,
        item.stock,
        item.safetyStock,
        item.unit,
        item.price,
        INVENTORY_STATUS_LABELS[item.status] || item.status,
        item.updatedAt,
      ]),
    ])
  }

  @Get('members')
  async members(
    @Req() request: any,
    @Res() res: any,
    @Query('level') level?: string,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
    @Query('segment') segment?: string,
    @Query('inactiveDays') inactiveDays?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.membersService.list(request.actor, {
      level,
      status,
      storeId,
      segment,
      inactiveDays,
      search,
    })
    const segmentLabels: Record<string, string> = {
      high_value: '高价值',
      repeat: '复购',
      active: '活跃',
      dormant: '沉睡',
      new: '新会员',
    }
    sendCsv(res, `retailos-members-${stamp()}.csv`, [
      [
        '会员号',
        '姓名',
        '手机号',
        '等级',
        '归属门店',
        '积分',
        '订单数',
        '累计消费',
        '最近到店',
        '沉睡天数',
        '分层标签',
        '状态',
        '入会时间',
      ],
      ...data.members.map((member: any) => [
        member.id,
        member.name,
        member.phone,
        member.level,
        member.storeName,
        member.points,
        member.orderCount,
        member.totalSpent,
        member.lastVisitAt || '—',
        member.inactiveDays,
        (member.segments || [])
          .map((key: string) => segmentLabels[key] || key)
          .join(' / '),
        member.status === 'dormant' ? '沉睡' : '正常',
        member.joinedAt,
      ]),
    ])
  }

  @Get('dashboard')
  async dashboard(
    @Req() request: any,
    @Res() res: any,
    @Query('range') range?: string,
  ) {
    const data = await this.analyticsService.dashboard(request.actor, range)
    const rows: unknown[][] = [
      ['RetailOS 经营报表'],
      ['统计范围', data.rangeLabel],
      ['更新时间', data.updatedAt],
      [],
      ['指标', '数值'],
      ['销售额', data.kpis.sales],
      ['订单量', data.kpis.orders],
      ['客单价', data.kpis.aov],
      ['会员订单占比(%)', data.kpis.memberShare],
      ['毛利额', data.kpis.grossProfit],
      ['毛利率(%)', data.kpis.grossMargin],
      ['销售成本', data.kpis.cogs],
      ['销售额环比(%)', data.kpis.salesDelta ?? '—'],
      ['订单量环比(%)', data.kpis.ordersDelta ?? '—'],
      ['客单价环比(%)', data.kpis.aovDelta ?? '—'],
      [],
      ['经营效率', '数值'],
      ['库存成本', data.operations.inventoryValue],
      ['库存周转天数', data.operations.turnoverDays ?? '—'],
      ['售罄率(%)', data.operations.sellThrough],
      ['净销量(件)', data.operations.unitsSold],
      ['期末库存(件)', data.operations.unitsStock],
      [],
      ['趋势', '销售额'],
      ...data.trend.labels.map((label: string, index: number) => [
        label,
        data.trend.sales[index],
      ]),
      [],
      ['门店', '区域', '销售额', '订单量', '客单价', '毛利额', '毛利率(%)', '环比(%)', '状态'],
      ...data.ranking.map((store: any) => [
        store.name,
        store.region,
        store.sales,
        store.orders,
        store.aov,
        store.grossProfit,
        store.grossMargin,
        store.delta ?? '—',
        store.status,
      ]),
      [],
      ['商品', '分类', '销售额', '占比(%)'],
      ...data.topProducts.map((product: any) => [
        product.name,
        product.category,
        product.sales,
        product.share,
      ]),
      [],
      ['异常门店', '类型', '说明', '等级', '时间'],
      ...data.anomalies.map((item: any) => [
        item.store,
        item.type,
        item.detail,
        RISK_LABELS[item.severity] || item.severity,
        item.time,
      ]),
    ]
    sendCsv(
      res,
      `retailos-dashboard-${data.range}-${stamp()}.csv`,
      rows,
    )
  }
}
