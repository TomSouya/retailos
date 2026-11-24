import { Injectable } from '@nestjs/common'
import { STORES } from '../domain/data'
import { hasPermission } from '../domain/permissions'
import { executeTool, resolveTargetStore } from '../domain/rbac'
import { currentTraceId, safeTraceId } from '../common/request-context'
import {
  pickScenario,
  targetStoreFor,
} from '../domain/scenarios'
import { TOOL, TOOL_LABELS } from '../domain/tools'
import {
  Actor,
  AgentEvent,
  Approval,
  Confirmation,
  Risk,
  Scenario,
} from '../domain/types'
import { AgentToolsService } from './agent-tools.service'
import { LlmMessage, LlmService } from './llm.service'
import { buildLlmUi, LLM_TOOLS, systemPrompt } from './llm-tools'
import {
  productQueryScenario,
  purchaseOrderQueryScenario,
  salesOrderQueryScenario,
} from './query-scenarios'

const DATA_WORDS =
  /库存|采购|订单|商品|销售|门店|退款|审批|补货|SKU|供应商|营业/i

const DRAFT_TOOLS: string[] = [
  TOOL.CREATE_REPLENISHMENT_DRAFT,
  TOOL.CREATE_PURCHASE_ORDER_DRAFT,
]

function isSmallTalk(text: string) {
  if (text.length > 40 || DATA_WORDS.test(text)) return false
  return /你是谁|你叫什么|能做什么|能干什么|能做哪些|会做什么|怎么用|使用帮助|介绍.*你自己|你好|您好/i.test(
    text,
  )
}

let sequence = 0

function uid(prefix: string) {
  sequence += 1
  return `${prefix}_${Date.now()}_${sequence}`
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

@Injectable()
export class AgentService {
  constructor(
    private readonly agentTools: AgentToolsService,
    private readonly llm: LlmService,
  ) {}

  private async buildScenario(text: string, actor: Actor): Promise<Scenario> {
    const inventoryIntent = /补货|库存|缺货|安全库存/.test(text)
    if (inventoryIntent) {
      try {
        const target = targetStoreFor(text, actor)
        const result = await this.agentTools.run(
          actor,
          TOOL.GET_LOW_STOCK,
          { storeId: target?.id },
        )
        const items = Array.isArray(result?.items) ? result.items : []
        return pickScenario(text, actor, { lowStockItems: items })
      } catch {
        return pickScenario(text, actor)
      }
    }

    const purchaseOrderMatch = text.match(/PO-\d{8}-\d+/i)
    if (
      purchaseOrderMatch &&
      /采购单/.test(text) &&
      /提交|发起|审批/.test(text)
    ) {
      const action = /审批/.test(text) ? 'approve' : 'submit'
      const input = {
        orderId: purchaseOrderMatch[0].toUpperCase(),
        action,
      }
      const output = await this.agentTools.run(
        actor,
        TOOL.PREPARE_PURCHASE_ORDER_ACTION,
        input,
      )
      const verb = action === 'approve' ? '审批通过' : '提交'

      return {
        plan: `我会先校验 ${input.orderId} 的状态与你的权限，再生成${verb}确认卡片。`,
        tools: [
          {
            name: TOOL.PREPARE_PURCHASE_ORDER_ACTION,
            label: TOOL_LABELS[TOOL.PREPARE_PURCHASE_ORDER_ACTION],
            input,
            duration: 520,
          },
        ],
        reply: `${input.orderId} 已准备${verb}，请在确认卡片中确认后执行。`,
        ui: {
          type: 'card',
          props: {
            title:
              action === 'approve' ? '采购单审批确认' : '采购单提交确认',
            subtitle: `${input.orderId} · ${output.supplierName || ''}`,
          },
          children: [
            {
              type: 'metricGrid',
              props: {
                items: [
                  { label: '采购单', value: input.orderId },
                  { label: '门店', value: output.storeName || '—' },
                  {
                    label: '采购金额',
                    value: Number(output.totalAmount || 0),
                    format: 'currency',
                  },
                  {
                    label: '商品数',
                    value: Number(output.itemCount || 0),
                    format: 'number',
                  },
                ],
              },
            },
            {
              type: 'callout',
              props: {
                tone: 'info',
                title: '需要确认',
                text: '确认后才会真正提交或审批，取消不会修改任何数据。',
              },
            },
          ],
        },
        confirmation:
          this.buildPurchaseActionConfirmation(output) || undefined,
      }
    }

    const wantsSalesReport =
      /销售额|销售情况|销售数据|销售业绩|营业额|客单价|环比|趋势|排行|经营概览|毛利|周转|售罄/.test(
        text,
      )

    if (/采购|供应商|到货/.test(text)) {
      return purchaseOrderQueryScenario(actor, text, this.agentTools)
    }
    if (/订单/.test(text) && !wantsSalesReport) {
      return salesOrderQueryScenario(actor, text, this.agentTools)
    }
    if (/商品|产品|SKU/i.test(text)) {
      return productQueryScenario(actor, text, this.agentTools)
    }
    return pickScenario(text, actor)
  }

  private replySmallTalk(
    runId: string,
    emit: (event: AgentEvent) => void,
    finish: () => void,
  ) {
    const messageId = uid('msg')
    emit({ type: 'TEXT_MESSAGE_START', messageId, kind: 'result' })
    emit({
      type: 'TEXT_MESSAGE_CONTENT',
      messageId,
      delta:
        '我是 RetailOS 经营助手。可以帮你查询销售额、库存、商品、采购单和销售订单，并把结果整理成表格或图表。我可以生成补货申请、采购单草稿，提交或审批采购单，准备审批决定，也可以发起退款申请，但这些写操作都需要你在确认卡片中确认后才会执行。',
    })
    emit({ type: 'TEXT_MESSAGE_END', messageId })
    emit({ type: 'RUN_FINISHED', runId })
    finish()
  }

  private buildDraftApproval(
    actor: Actor,
    input: Record<string, any>,
    output: any,
  ): Approval | null {
    const items = output?.items || []
    if (!items.length) return null

    const storeId = String(input.storeId || '')
    const store = STORES.find((item) => item.id === storeId)
    const storeName = store?.name || '当前门店'
    const totalQuantity = items.reduce(
      (sum: number, item: any) => sum + Number(item.suggestQty || 0),
      0,
    )

    return {
      id: `AP-DRAFT-${Date.now()}`,
      type: 'replenishment',
      storeId,
      storeName,
      requester: actor.name,
      risk: items.some((item: any) => item.status === 'out')
        ? 'high'
        : 'medium',
      status: 'pending',
      createdAt: new Date().toISOString(),
      summary: `为${storeName}创建 ${items.length} 个 SKU 的补货申请`,
      items: items.map((item: any) => ({
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
  }

  private buildPurchaseConfirmation(output: any): Confirmation | null {
    if (output?.kind !== 'purchase_order_draft') return null
    const items = Array.isArray(output.items) ? output.items : []
    if (!items.length) return null

    const totalAmount = Number(output.totalAmount || 0)
    return {
      id: `CF-PO-${Date.now()}`,
      kind: 'purchase_order',
      status: 'pending',
      title: '创建采购单草稿',
      summary: `为${output.storeName}向${output.supplierName}创建 ${items.length} 个 SKU 的采购单草稿`,
      risk: totalAmount >= 50000 ? 'high' : 'medium',
      storeId: output.storeId,
      storeName: output.storeName,
      meta: [
        { label: '供应商', value: output.supplierName || '—' },
        { label: '门店', value: output.storeName || '—' },
        { label: '预计金额', value: `¥${totalAmount.toFixed(2)}` },
        { label: '明细', value: `${items.length} 项` },
      ],
      items: items.map((item: any) => ({
        sku: item.sku,
        name: item.name,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      })),
      payload: {
        supplierId: output.supplierId,
        storeId: output.storeId,
        note: output.note || '',
        items: items.map((item: any) => ({
          sku: item.sku,
          name: item.name,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
        })),
      },
      expiresAt: '今日 18:00',
    }
  }

  private buildDecisionConfirmation(output: any): Confirmation | null {
    if (output?.kind !== 'approval_decision') return null
    const approved = output.decision === 'approved'

    return {
      id: `CF-AP-${Date.now()}`,
      kind: 'approval_decision',
      status: 'pending',
      title: approved ? '通过审批' : '驳回审批',
      summary: `${approved ? '通过' : '驳回'}${output.typeLabel} ${output.approvalId}`,
      risk: (output.risk || 'medium') as Risk,
      storeId: output.storeId,
      storeName: output.storeName,
      meta: [
        { label: '申请编号', value: output.approvalId },
        { label: '类型', value: output.typeLabel },
        { label: '门店', value: output.storeName || '—' },
        { label: '申请人', value: output.requester || '—' },
      ],
      items: (output.items || []).map((item: any) => ({
        sku: item.sku,
        name: item.name,
        quantity: Number(item.quantity || 0),
      })),
      payload: {
        approvalId: output.approvalId,
        decision: output.decision,
      },
      expiresAt: output.expiresAt || '处理前有效',
    }
  }

  private buildPurchaseActionConfirmation(
    output: any,
  ): Confirmation | null {
    if (output?.kind !== 'purchase_order_action') return null

    const approved = output.action === 'approve'
    const totalAmount = Number(output.totalAmount || 0)
    return {
      id: `CF-POA-${Date.now()}`,
      kind: 'purchase_order_action',
      status: 'pending',
      title: approved ? '审批通过采购单' : '提交采购单',
      summary: `${output.orderId} · ${output.supplierName} · ¥${totalAmount.toFixed(2)}`,
      risk: totalAmount >= 50000 ? 'high' : 'medium',
      storeName: output.storeName,
      meta: [
        { label: '采购单号', value: output.orderId },
        { label: '供应商', value: output.supplierName || '—' },
        { label: '门店', value: output.storeName || '—' },
        {
          label: '采购金额',
          value: `¥${totalAmount.toFixed(2)}`,
        },
      ],
      items: (output.items || []).map((item: any) => ({
        sku: item.sku,
        name: item.name,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      })),
      payload: {
        orderId: output.orderId,
        action: output.action,
      },
      expiresAt: '今日 18:00',
    }
  }

  private buildRefundConfirmation(output: any): Confirmation | null {
    if (output?.kind !== 'refund_request') return null

    const amount = Number(output.amount || 0)
    const orderAmount = Number(output.orderAmount || 0)
    return {
      id: `CF-RF-${Date.now()}`,
      kind: 'refund_request',
      status: 'pending',
      title: '提交退款申请',
      summary: `订单 ${output.orderId} · ${output.memberName} · 退款 ¥${amount.toFixed(2)}`,
      risk:
        orderAmount > 0 && amount >= orderAmount * 0.8
          ? 'high'
          : 'medium',
      storeId: output.storeId,
      storeName: output.storeName,
      meta: [
        { label: '订单号', value: output.orderId },
        { label: '门店', value: output.storeName || '—' },
        { label: '会员', value: output.memberName || '—' },
        {
          label: '可退金额',
          value: `¥${Number(output.refundableAmount || 0).toFixed(2)}`,
        },
      ],
      items: [],
      payload: {
        orderId: output.orderId,
        amount,
        reason: output.reason,
      },
      expiresAt: '今日 18:00',
    }
  }

  private buildStoreConfirmation(output: any): Confirmation | null {
    if (output?.kind !== 'store_create') return null

    return {
      id: `CF-ST-${Date.now()}`,
      kind: 'store_create',
      status: 'pending',
      title: '新建门店',
      summary: `${output.region} · ${output.city} · ${output.name}`,
      risk: 'medium',
      storeName: output.name,
      meta: [
        { label: '门店名称', value: output.name },
        { label: '城市 / 区域', value: `${output.city} / ${output.region}` },
        { label: '店长', value: output.manager || '—' },
        { label: '联系电话', value: output.phone || '—' },
        { label: '开业时间', value: output.openedAt || '—' },
      ],
      items: [],
      payload: {
        name: output.name,
        city: output.city,
        region: output.region,
        manager: output.manager,
        phone: output.phone,
        openedAt: output.openedAt,
      },
      expiresAt: '今日 18:00',
    }
  }

  private buildMemberConfirmation(output: any): Confirmation | null {
    if (output?.kind !== 'member_create') return null

    const levelLabels: Record<string, string> = {
      diamond: '钻石',
      gold: '黄金',
      silver: '白银',
      basic: '普通',
    }
    return {
      id: `CF-MB-${Date.now()}`,
      kind: 'member_create',
      status: 'pending',
      title: '新建会员',
      summary: `${output.name} · ${output.phone} · ${output.storeName}`,
      risk: 'low',
      storeId: output.storeId,
      storeName: output.storeName,
      meta: [
        { label: '会员姓名', value: output.name },
        { label: '手机号', value: output.phone },
        {
          label: '所属门店',
          value: `${output.storeName}（${output.storeId}）`,
        },
        {
          label: '等级 / 积分',
          value: `${levelLabels[output.level] || output.level} · ${output.points} 分`,
        },
      ],
      items: [],
      payload: {
        name: output.name,
        phone: output.phone,
        level: output.level,
        points: output.points,
        storeId: output.storeId,
      },
      expiresAt: '今日 18:00',
    }
  }

  private buildProductConfirmation(output: any): Confirmation | null {
    if (output?.kind !== 'product_create') return null

    const price = Number(output.price || 0)
    const costPrice = Number(output.costPrice || 0)
    return {
      id: `CF-PD-${Date.now()}`,
      kind: 'product_create',
      status: 'pending',
      title: '新建商品',
      summary: `${output.name} · ${output.category} · ¥${price.toFixed(2)}`,
      risk: 'low',
      meta: [
        { label: 'SKU', value: output.id || '由系统生成' },
        { label: '商品名称', value: output.name },
        { label: '分类', value: output.category },
        { label: '单价 / 成本价', value: `¥${price.toFixed(2)} / ¥${costPrice.toFixed(2)}` },
        { label: '单位 / 安全库存', value: `${output.unit} / ${output.safetyStock}` },
      ],
      items: [],
      payload: {
        ...(output.id ? { id: output.id } : {}),
        name: output.name,
        category: output.category,
        price,
        costPrice,
        unit: output.unit,
        safetyStock: Number(output.safetyStock || 0),
      },
      expiresAt: '今日 18:00',
    }
  }

  private async streamWithLlm(
    text: string,
    actor: Actor,
    history: LlmMessage[],
    runId: string,
    emit: (event: AgentEvent) => void,
    finish: () => void,
    isCancelled: () => boolean,
  ) {
    const planId = uid('msg')
    emit({ type: 'TEXT_MESSAGE_START', messageId: planId, kind: 'plan' })
    emit({
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: planId,
      delta: '我会先理解你的问题，调用相应的经营工具查询最新数据，再给出结论。',
    })
    emit({ type: 'TEXT_MESSAGE_END', messageId: planId })

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt(actor) },
      ...history.slice(-8),
      { role: 'user', content: text },
    ]
    const results: Array<{ name: string; output: any }> = []
    let draftApproval: Approval | null = null
    let pendingConfirmation: Confirmation | null = null

    for (let step = 0; step < 4; step += 1) {
      if (isCancelled()) return finish()

      let resultId: string | null = null
      const reply = await this.llm.chatStream(
        messages,
        LLM_TOOLS,
        (delta) => {
          if (isCancelled() || !delta) return
          if (!resultId) {
            resultId = uid('msg')
            emit({
              type: 'TEXT_MESSAGE_START',
              messageId: resultId,
              kind: 'result',
            })
          }
          emit({
            type: 'TEXT_MESSAGE_CONTENT',
            messageId: resultId,
            delta,
          })
        },
      )

      if (reply.toolCalls.length) {
        if (resultId) {
          emit({ type: 'TEXT_MESSAGE_END', messageId: resultId })
        }
        messages.push({
          role: 'assistant',
          content: reply.content || '',
          tool_calls: reply.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments),
            },
          })),
        })

        for (const call of reply.toolCalls) {
          if (isCancelled()) return finish()

          const toolCallId = uid('tool')
          const input = { ...call.arguments }
          if (DRAFT_TOOLS.includes(call.name) && !input.storeId) {
            const target = resolveTargetStore(actor)
            if (target) input.storeId = target.id
          }

          emit({
            type: 'TOOL_CALL_START',
            toolCallId,
            name: call.name,
            label: TOOL_LABELS[call.name] || call.name,
            input,
          })
          emit({ type: 'TOOL_CALL_STATE', toolCallId, status: 'running' })

          const started = Date.now()
          try {
            const output = this.agentTools.supports(call.name)
              ? await this.agentTools.run(actor, call.name, input)
              : executeTool({ actor, tool: call.name, input })

            results.push({ name: call.name, output })
            if (call.name === TOOL.CREATE_REPLENISHMENT_DRAFT) {
              draftApproval = this.buildDraftApproval(actor, input, output)
            }
            if (call.name === TOOL.CREATE_PURCHASE_ORDER_DRAFT) {
              pendingConfirmation =
                this.buildPurchaseConfirmation(output) || pendingConfirmation
            }
            if (call.name === TOOL.PREPARE_APPROVAL_DECISION) {
              pendingConfirmation =
                this.buildDecisionConfirmation(output) || pendingConfirmation
            }
            if (call.name === TOOL.PREPARE_REFUND_REQUEST) {
              pendingConfirmation =
                this.buildRefundConfirmation(output) || pendingConfirmation
            }
            if (call.name === TOOL.PREPARE_PURCHASE_ORDER_ACTION) {
              pendingConfirmation =
                this.buildPurchaseActionConfirmation(output) ||
                pendingConfirmation
            }
            if (call.name === TOOL.PREPARE_STORE_CREATE) {
              pendingConfirmation =
                this.buildStoreConfirmation(output) || pendingConfirmation
            }
            if (call.name === TOOL.PREPARE_MEMBER_CREATE) {
              pendingConfirmation =
                this.buildMemberConfirmation(output) || pendingConfirmation
            }
            if (call.name === TOOL.PREPARE_PRODUCT_CREATE) {
              pendingConfirmation =
                this.buildProductConfirmation(output) || pendingConfirmation
            }

            emit({
              type: 'TOOL_CALL_RESULT',
              toolCallId,
              status: 'succeeded',
              output,
              durationMs: Date.now() - started,
            })
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(output),
            })
          } catch (error) {
            emit({
              type: 'TOOL_CALL_RESULT',
              toolCallId,
              status: 'failed',
              error: error.message,
              errorCode: error.code,
              durationMs: Date.now() - started,
            })
            emit({
              type: 'RUN_ERROR',
              message: error.message,
              code: error.code || 'TOOL_ERROR',
            })
            return finish()
          }
        }
        continue
      }

      const content = reply.content || '已完成查询，请查看下方结果。'
      if (!resultId) {
        resultId = uid('msg')
        emit({ type: 'TEXT_MESSAGE_START', messageId: resultId, kind: 'result' })
        emit({ type: 'TEXT_MESSAGE_CONTENT', messageId: resultId, delta: content })
      }
      emit({
        type: 'TEXT_MESSAGE_END',
        messageId: resultId,
        ui: buildLlmUi(results),
      })
      if (draftApproval) {
        emit({ type: 'APPROVAL_REQUIRED', approval: draftApproval })
      }
      if (pendingConfirmation) {
        emit({
          type: 'CONFIRMATION_REQUIRED',
          confirmation: pendingConfirmation,
        })
      }
      emit({ type: 'RUN_FINISHED', runId })
      return finish()
    }

    const resultId = uid('msg')
    emit({ type: 'TEXT_MESSAGE_START', messageId: resultId, kind: 'result' })
    emit({
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: resultId,
      delta: '查询步骤过多，已停止。请缩小门店或关键词范围后重试。',
    })
    emit({
      type: 'TEXT_MESSAGE_END',
      messageId: resultId,
      ui: buildLlmUi(results),
    })
    if (draftApproval) {
      emit({ type: 'APPROVAL_REQUIRED', approval: draftApproval })
    }
    if (pendingConfirmation) {
      emit({
        type: 'CONFIRMATION_REQUIRED',
        confirmation: pendingConfirmation,
      })
    }
    emit({ type: 'RUN_FINISHED', runId })
    finish()
  }

  async stream(
    body: {
      text?: string
      context?: any
      history?: Array<{ role: string; content: string }>
      state?: {
        version?: string
        threadId?: string
        traceId?: string
        context?: Record<string, any>
      }
      traceId?: string
    },
    actor: Actor,
    res: any,
  ) {
    const text = String(body?.text || '').trim()

    if (!text || !actor?.key) {
      res.status(400).json({
        message: '缺少 text 或登录状态',
      })
      return
    }
    if (!hasPermission(actor, 'dashboard.agent')) {
      res.status(403).json({ message: '当前角色无权使用经营助手' })
      return
    }

    const history: LlmMessage[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (item) =>
              item &&
              ['user', 'assistant'].includes(item.role) &&
              typeof item.content === 'string' &&
              item.content.trim(),
          )
          .slice(-8)
          .map((item) => ({
            role: item.role as 'user' | 'assistant',
            content: item.content.trim().slice(0, 800),
          }))
      : []

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    res.write(': connected\n\n')

    let cancelled = false
    const heartbeat = setInterval(() => {
      if (cancelled || res.writableEnded) return
      res.write(': ping\n\n')
    }, 15000)

    res.on('close', () => {
      cancelled = true
      clearInterval(heartbeat)
    })

    const runId = uid('run')
    // 客户端 traceId 只接受安全格式，否则回退到服务端链路 ID
    const traceId =
      safeTraceId(body?.state?.traceId || body?.traceId) ||
      currentTraceId() ||
      uid('trace')
    const threadId =
      String(body?.state?.threadId || '').trim() || uid('thread')
    const sharedContext = body?.state?.context || body?.context || {}
    let seq = 0
    let pendingConfirmationId = ''

    const emit = (event: AgentEvent) => {
      if (cancelled || res.writableEnded) return
      seq += 1
      const payload: AgentEvent = {
        ...event,
        runId,
        threadId,
        traceId,
        seq,
        ts: new Date().toISOString(),
      }
      if (event.type === 'RUN_STARTED') {
        payload.state = {
          version: '1.0',
          threadId,
          traceId,
          context: sharedContext,
          status: 'running',
          actor: { key: actor.key, scope: actor.scope },
        }
      }
      if (event.type === 'CONFIRMATION_REQUIRED') {
        pendingConfirmationId = event.confirmation?.id || ''
      }
      if (event.type === 'RUN_FINISHED') {
        payload.state = {
          version: '1.0',
          threadId,
          traceId,
          status: pendingConfirmationId
            ? 'awaiting_permission'
            : 'completed',
          pendingId: pendingConfirmationId || undefined,
        }
      }
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    const finish = () => {
      clearInterval(heartbeat)
      if (!res.writableEnded) res.end()
    }

    emit({ type: 'RUN_STARTED', runId })

    await delay(320)
    if (cancelled) return finish()

    if (isSmallTalk(text)) {
      this.replySmallTalk(runId, emit, finish)
      return
    }

    if (this.llm.enabled) {
      try {
        await this.streamWithLlm(
          text,
          actor,
          history,
          runId,
          emit,
          finish,
          () => cancelled,
        )
      } catch (error) {
        emit({
          type: 'RUN_ERROR',
          message: `模型调用失败：${error.message}`,
          code: error.code || 'LLM_ERROR',
        })
        finish()
      }
      return
    }

    const scenario = await this.buildScenario(text, actor).catch((error) => {
      emit({
        type: 'RUN_ERROR',
        message: error.message,
        code: error.code || 'TOOL_ERROR',
      })
      finish()
      return null
    })
    if (!scenario) return

    const planId = uid('msg')
    emit({ type: 'TEXT_MESSAGE_START', messageId: planId, kind: 'plan' })
    emit({
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: planId,
      delta: scenario.plan,
    })
    emit({ type: 'TEXT_MESSAGE_END', messageId: planId })

    await delay(280)
    if (cancelled) return finish()

    const tools = scenario.tools.map((tool) => ({
      ...tool,
      toolCallId: uid('tool'),
    }))

    for (const tool of tools) {
      emit({
        type: 'TOOL_CALL_START',
        toolCallId: tool.toolCallId,
        name: tool.name,
        label: tool.label,
        input: tool.input,
      })
    }

    for (const tool of tools) {
      if (cancelled) return finish()

      emit({
        type: 'TOOL_CALL_STATE',
        toolCallId: tool.toolCallId,
        status: 'running',
      })

      const started = Date.now()
      await delay(tool.duration || 600)

      if (cancelled) {
        emit({
          type: 'TOOL_CALL_RESULT',
          toolCallId: tool.toolCallId,
          status: 'cancelled',
          error: '用户已取消',
          durationMs: Date.now() - started,
        })
        return finish()
      }

      try {
        const output = this.agentTools.supports(tool.name)
          ? await this.agentTools.run(actor, tool.name, tool.input)
          : executeTool({
              actor,
              tool: tool.name,
              input: tool.input,
            })
        emit({
          type: 'TOOL_CALL_RESULT',
          toolCallId: tool.toolCallId,
          status: 'succeeded',
          output,
          durationMs: Date.now() - started,
        })
      } catch (error) {
        emit({
          type: 'TOOL_CALL_RESULT',
          toolCallId: tool.toolCallId,
          status: 'failed',
          error: error.message,
          errorCode: error.code,
          durationMs: Date.now() - started,
        })
        emit({
          type: 'RUN_ERROR',
          message: error.message,
          code: error.code || 'TOOL_ERROR',
        })
        return finish()
      }
    }

    await delay(260)
    if (cancelled) return finish()

    const resultId = uid('msg')
    emit({ type: 'TEXT_MESSAGE_START', messageId: resultId, kind: 'result' })
    emit({
      type: 'TEXT_MESSAGE_CONTENT',
      messageId: resultId,
      delta: scenario.reply,
    })
    emit({
      type: 'TEXT_MESSAGE_END',
      messageId: resultId,
      ui: scenario.ui,
    })

    if (scenario.approval) {
      emit({
        type: 'APPROVAL_REQUIRED',
        approval: scenario.approval,
      })
    }

    if (scenario.confirmation) {
      emit({
        type: 'CONFIRMATION_REQUIRED',
        confirmation: scenario.confirmation,
      })
    }

    emit({ type: 'RUN_FINISHED', runId })
    finish()
  }
}
