import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import {
  AGENT_BUSY_STATUS,
  AGENT_EVENT,
  AGENT_RUN_STATUS,
  AGENT_STATUS_LABELS,
} from '@/contracts/agentEvents'
import { APPROVAL_STATUS } from '@/contracts/approval'
import {
  createMember,
  createProduct,
  createPurchaseOrder,
  createStore,
  decideApproval,
  refundSalesOrder,
  setCurrentTraceId,
  transitionPurchaseOrder,
} from '@/api/client'
import {
  createThreadId,
  createTraceId,
  normalizeSharedState,
} from '@/contracts/agentState'
import { createAgentStream } from '@/features/agent/transport'
import { useApprovalStore } from './approval'
import { useAuthStore } from './auth'

let sequence = 0
const STORAGE_KEY = 'retailos.agent.session'
const MAX_RECONNECT = 2

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableStreamError(error) {
  if (!error) return true
  const status = Number(error.status)
  if (status) return status === 429 || status >= 500
  return error.name !== 'AbortError'
}

function uid(prefix) {
  sequence += 1
  return `${prefix}_${Date.now()}_${sequence}`
}

function clock() {
  return dayjs().format('HH:mm')
}

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved || !Array.isArray(saved.messages)) {
      return {
        messages: [],
        toolCalls: [],
        sharedState: normalizeSharedState(),
      }
    }
    return {
      messages: saved.messages,
      toolCalls: Array.isArray(saved.toolCalls) ? saved.toolCalls : [],
      sharedState: normalizeSharedState(saved.sharedState),
    }
  } catch {
    return {
      messages: [],
      toolCalls: [],
      sharedState: normalizeSharedState(),
    }
  }
}

export const useAgentStore = defineStore('agent', () => {
  const savedSession = loadSession()
  const panelOpen = ref(false)
  const status = ref(
    savedSession.messages.length
      ? AGENT_RUN_STATUS.COMPLETED
      : AGENT_RUN_STATUS.IDLE,
  )
  const messages = ref(savedSession.messages)
  const toolCalls = ref(savedSession.toolCalls)
  const context = ref({ page: 'dashboard' })
  const sharedState = ref(savedSession.sharedState)
  if (!sharedState.value.threadId) {
    sharedState.value.threadId = createThreadId()
  }

  // 刷新后若还有待确认卡片，恢复为「待授权」而不是「已完成」
  const restoredPending = messages.value
    .slice()
    .reverse()
    .flatMap((message) => [message.confirmation, message.approval])
    .find((item) => item && item.status === 'pending')
  if (restoredPending && !AGENT_BUSY_STATUS.includes(status.value)) {
    status.value = AGENT_RUN_STATUS.AWAITING_PERMISSION
    sharedState.value.pending =
      sharedState.value.pending || {
        kind: restoredPending.kind || 'approval',
        id: restoredPending.id || '',
        summary: restoredPending.summary || '',
      }
  }

  watch(
    [messages, toolCalls, sharedState],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            messages: messages.value.slice(-80),
            toolCalls: toolCalls.value.slice(-60),
            sharedState: sharedState.value,
          }),
        )
      } catch {
        // 本地存储不可用时忽略持久化
      }
    },
    { deep: true },
  )

  let activeStream = null
  let runToken = 0
  let currentToolMessage = null
  let currentResultMessage = null
  let pendingApproval = null
  let pendingConfirmation = null

  const isBusy = computed(() => AGENT_BUSY_STATUS.includes(status.value))
  const statusLabel = computed(
    () => AGENT_STATUS_LABELS[status.value] || status.value,
  )

  function open(nextContext = {}) {
    context.value = { ...context.value, ...nextContext }
    panelOpen.value = true
  }

  function close() {
    panelOpen.value = false
  }

  function toggle() {
    panelOpen.value = !panelOpen.value
  }

  function getTool(id) {
    return toolCalls.value.find((tool) => tool.id === id) || null
  }

  function resetRunPointers() {
    currentToolMessage = null
    currentResultMessage = null
    pendingApproval = null
    pendingConfirmation = null
  }

  function updateSharedState(patch = {}) {
    sharedState.value = normalizeSharedState({
      ...sharedState.value,
      ...patch,
      context: context.value,
      updatedAt: new Date().toISOString(),
    })
  }

  function handleEvent(event) {
    switch (event.type) {
      case AGENT_EVENT.RUN_STARTED:
        status.value = AGENT_RUN_STATUS.UNDERSTANDING
        updateSharedState({
          threadId: event.threadId || sharedState.value.threadId,
          traceId: event.traceId || sharedState.value.traceId,
          lastRunId: event.runId || sharedState.value.lastRunId,
          status: 'running',
          pending: null,
        })
        break

      case AGENT_EVENT.TEXT_MESSAGE_START: {
        const message = reactive({
          id: event.messageId,
          role: 'assistant',
          kind: event.kind || 'text',
          text: '',
          time: clock(),
          traceId: sharedState.value.traceId,
          toolIds: [],
          ui: null,
          approval: null,
        })
        messages.value.push(message)

        if (event.kind === 'plan') status.value = AGENT_RUN_STATUS.PLANNING
        if (event.kind === 'result') {
          status.value = AGENT_RUN_STATUS.STREAMING
          currentResultMessage = message
        }
        break
      }

      case AGENT_EVENT.TEXT_MESSAGE_CONTENT: {
        const message = messages.value.find(
          (item) => item.id === event.messageId,
        )
        if (message) message.text += event.delta || ''
        break
      }

      case AGENT_EVENT.TEXT_MESSAGE_END: {
        const message = messages.value.find(
          (item) => item.id === event.messageId,
        )
        if (message && event.ui) message.ui = event.ui
        break
      }

      case AGENT_EVENT.TOOL_CALL_START: {
        status.value = AGENT_RUN_STATUS.EXECUTING
        const tool = reactive({
          id: event.toolCallId,
          name: event.name,
          label: event.label,
          status: 'queued',
          input: event.input || {},
          output: null,
          startedAt: null,
          durationMs: 0,
          error: null,
        })
        toolCalls.value.push(tool)

        if (!currentToolMessage) {
          currentToolMessage = reactive({
            id: uid('msg'),
            role: 'assistant',
            kind: 'tools',
            text: '',
            time: clock(),
            toolIds: [],
          })
          messages.value.push(currentToolMessage)
        }
        currentToolMessage.toolIds.push(tool.id)
        break
      }

      case AGENT_EVENT.TOOL_CALL_STATE: {
        const tool = getTool(event.toolCallId)
        if (!tool) break
        tool.status = event.status
        if (event.status === 'running') tool.startedAt = Date.now()
        break
      }

      case AGENT_EVENT.TOOL_CALL_RESULT: {
        const tool = getTool(event.toolCallId)
        if (!tool) break
        tool.status = event.status
        tool.output = event.output || null
        tool.durationMs = event.durationMs || 0
        tool.error = event.error || null
        break
      }

      case AGENT_EVENT.APPROVAL_REQUIRED: {
        pendingApproval = reactive(event.approval)
        if (currentResultMessage) {
          currentResultMessage.approval = pendingApproval
        }
        status.value = AGENT_RUN_STATUS.AWAITING_PERMISSION
        updateSharedState({
          status: 'awaiting_permission',
          pending: {
            kind: 'approval',
            id: pendingApproval.id || '',
            summary: pendingApproval.summary || '',
          },
        })
        break
      }

      case AGENT_EVENT.CONFIRMATION_REQUIRED: {
        pendingConfirmation = reactive(event.confirmation)
        if (currentResultMessage) {
          currentResultMessage.confirmation = pendingConfirmation
        }
        status.value = AGENT_RUN_STATUS.AWAITING_PERMISSION
        updateSharedState({
          status: 'awaiting_permission',
          pending: {
            kind: pendingConfirmation.kind || 'confirmation',
            id: pendingConfirmation.id || '',
            summary: pendingConfirmation.summary || '',
          },
        })
        break
      }

      case AGENT_EVENT.RUN_FINISHED:
        if (!pendingApproval && !pendingConfirmation) {
          status.value = AGENT_RUN_STATUS.COMPLETED
          updateSharedState({ status: 'completed', pending: null })
        }
        break

      case AGENT_EVENT.RUN_ERROR: {
        status.value = AGENT_RUN_STATUS.FAILED
        updateSharedState({ status: 'failed' })
        toolCalls.value.forEach((tool) => {
          if (tool.status === 'queued') tool.status = 'cancelled'
        })
        messages.value.push({
          id: uid('msg'),
          role: 'assistant',
          kind: 'text',
          text: `运行失败：${event.message || '未知错误'}`,
          time: clock(),
        })
        break
      }

      default:
        break
    }
  }

  async function send(text) {
    const content = String(text || '').trim()
    if (!content || isBusy.value) return

    const auth = useAuthStore()
    const token = ++runToken
    resetRunPointers()

    const history = messages.value
      .filter(
        (message) =>
          message.role === 'user' ||
          (message.role === 'assistant' &&
            message.text &&
            message.kind !== 'plan'),
      )
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.text,
      }))

    const traceId = createTraceId()
    sharedState.value = normalizeSharedState({
      ...sharedState.value,
      traceId,
      context: context.value,
      status: 'running',
      pending: null,
      updatedAt: new Date().toISOString(),
    })
    setCurrentTraceId(traceId)
    const agentState = {
      version: sharedState.value.version,
      threadId: sharedState.value.threadId,
      traceId,
      context: { ...context.value },
    }

    messages.value.push({
      id: uid('msg'),
      role: 'user',
      kind: 'text',
      text: content,
      time: clock(),
      traceId,
    })

    const body = {
      text: content,
      actor: auth.user,
      context: context.value,
      history,
      state: agentState,
      traceId,
    }
    const messageBaseline = messages.value.length
    const toolBaseline = toolCalls.value.length
    let finished = false

    status.value = AGENT_RUN_STATUS.UNDERSTANDING

    for (let attempt = 0; attempt <= MAX_RECONNECT; attempt += 1) {
      if (token !== runToken) return

      if (attempt > 0) {
        // 丢弃上一次中断残留在界面上的消息与工具卡片，重新接收完整结果
        messages.value.splice(messageBaseline)
        toolCalls.value.splice(toolBaseline)
        resetRunPointers()
        status.value = AGENT_RUN_STATUS.RECONNECTING
        await sleep(600 * attempt)
        if (token !== runToken) return
      }

      const stream = createAgentStream()
      activeStream = stream

      try {
        for await (const event of stream.send(body)) {
          if (token !== runToken) return
          if (event.type === AGENT_EVENT.RUN_FINISHED) finished = true
          handleEvent(event)
        }
        if (token !== runToken) return
        if (finished || status.value === AGENT_RUN_STATUS.FAILED) return
        if (attempt === MAX_RECONNECT) {
          throw new Error(`连接中断，已重试 ${MAX_RECONNECT} 次`)
        }
      } catch (error) {
        if (token !== runToken) return
        if (!isRetryableStreamError(error) || attempt === MAX_RECONNECT) {
          status.value = AGENT_RUN_STATUS.FAILED
          updateSharedState({ status: 'failed' })
          messages.value.push({
            id: uid('msg'),
            role: 'assistant',
            kind: 'text',
            text: `运行失败：${error.message}`,
            time: clock(),
          })
          return
        }
      } finally {
        if (token === runToken) activeStream = null
      }
    }
  }

  async function submitApproval(approval) {
    if (!approval || approval.status !== APPROVAL_STATUS.PENDING) return

    const approvalStore = useApprovalStore()
    const auth = useAuthStore()

    try {
      const record = await approvalStore.submit({
        type: 'replenishment',
        storeId: approval.storeId,
        storeName: approval.storeName,
        requester: auth.user?.name || '店长',
        risk: approval.risk,
        items: approval.items,
        summary: approval.summary,
        params: approval.params,
        expiresAt: approval.expiresAt,
      })

      approval.id = record.id
      approval.status = APPROVAL_STATUS.SUBMITTED
      pendingApproval = null
      updateSharedState({ status: 'completed', pending: null })

      messages.value.push({
        id: uid('msg'),
        role: 'assistant',
        kind: 'text',
        text: `已提交补货申请 ${record.id}，区域经理可在「库存管理 → 待审批」处理。`,
        time: clock(),
      })
      status.value = AGENT_RUN_STATUS.COMPLETED

      if (approvalStore.remote) {
        try {
          await approvalStore.refresh()
        } catch {
          // 提交已成功；列表刷新失败不影响本次审批
        }
      }
    } catch (error) {
      status.value = AGENT_RUN_STATUS.FAILED
      messages.value.push({
        id: uid('msg'),
        role: 'assistant',
        kind: 'text',
        text: `提交审批失败：${error.message}`,
        time: clock(),
      })
    }
  }

  function cancelApproval(approval) {
    if (!approval || approval.status !== APPROVAL_STATUS.PENDING) return
    approval.status = APPROVAL_STATUS.CANCELLED
    pendingApproval = null
    updateSharedState({ status: 'completed', pending: null })
    messages.value.push({
      id: uid('msg'),
      role: 'assistant',
      kind: 'text',
      text: '已取消。本次没有写入任何变更。',
      time: clock(),
    })
    status.value = AGENT_RUN_STATUS.COMPLETED
  }

  async function confirmAction(confirmation) {
    if (!confirmation || confirmation.status !== 'pending') return
    if (!confirmation.payload) return

    status.value = AGENT_RUN_STATUS.EXECUTING

    try {
      let text = ''

      if (confirmation.kind === 'purchase_order') {
        const record = await createPurchaseOrder(confirmation.payload)
        confirmation.status = 'done'
        confirmation.doneText = `已创建采购单草稿 ${record.id}`
        text = `已创建采购单草稿 ${record.id}，可在「采购管理」补充明细并提交审批。`
      } else if (confirmation.kind === 'approval_decision') {
        const updated = await decideApproval(
          confirmation.payload.approvalId,
          confirmation.payload.decision,
        )
        const approved = updated.status === APPROVAL_STATUS.APPROVED
        const purchaseOrderId = updated.params?.purchaseOrderId
        confirmation.status = 'done'
        confirmation.doneText = approved
          ? purchaseOrderId
            ? `已通过并生成采购单草稿 ${purchaseOrderId}`
            : '已通过该申请'
          : '已驳回该申请'
        text = approved
          ? `已通过申请 ${updated.id}${purchaseOrderId ? `，并生成采购单草稿 ${purchaseOrderId}，可在「采购管理」补充价格后提交` : ''}，结果已写入审计日志。`
          : `已驳回申请 ${updated.id}，结果已写入审计日志。`

        const approvalStore = useApprovalStore()
        if (approvalStore.remote) {
          try {
            await approvalStore.refresh()
          } catch {
            // 决策已成功；列表刷新失败不影响本次结果
          }
        }
      } else if (confirmation.kind === 'purchase_order_action') {
        const record = await transitionPurchaseOrder(
          confirmation.payload.orderId,
          confirmation.payload.action,
        )
        const approved = confirmation.payload.action === 'approve'
        confirmation.status = 'done'
        confirmation.doneText = approved
          ? `已审批通过 ${record.id}`
          : `已提交 ${record.id}`
        text = approved
          ? `采购单 ${record.id} 已审批通过，等待仓库验收。`
          : `采购单 ${record.id} 已提交，等待审批。`
      } else if (confirmation.kind === 'refund_request') {
        const record = await refundSalesOrder(
          confirmation.payload.orderId,
          {
            amount: confirmation.payload.amount,
            reason: confirmation.payload.reason,
          },
        )
        confirmation.status = 'done'
        confirmation.doneText = `已提交退款申请 ${record.id}`
        text = `已提交退款申请 ${record.id}，等待区域经理或企业老板审批。`

        const approvalStore = useApprovalStore()
        if (approvalStore.remote) {
          try {
            await approvalStore.refresh()
          } catch {
            // 提交已成功；列表刷新失败不影响本次结果
          }
        }
      } else if (confirmation.kind === 'store_create') {
        const record = await createStore(confirmation.payload)
        confirmation.status = 'done'
        confirmation.doneText = `已创建门店 ${record.id}`
        text = `门店「${record.name}」（${record.id}）已创建，可在「门店管理」查看。`
      } else if (confirmation.kind === 'member_create') {
        const record = await createMember(confirmation.payload)
        confirmation.status = 'done'
        confirmation.doneText = `已创建会员 ${record.id}`
        text = `会员「${record.name}」已建档（${record.id}），可在「会员管理」查看。`
      } else if (confirmation.kind === 'product_create') {
        const record = await createProduct(confirmation.payload)
        confirmation.status = 'done'
        confirmation.doneText = `已创建商品 ${record.id}`
        text = `商品「${record.name}」已创建（${record.id}），可在「商品管理」补充信息。`
      } else {
        throw new Error('未知的确认类型')
      }

      pendingConfirmation = null
      updateSharedState({ status: 'completed', pending: null })
      messages.value.push({
        id: uid('msg'),
        role: 'assistant',
        kind: 'text',
        text,
        time: clock(),
      })
      status.value = AGENT_RUN_STATUS.COMPLETED
    } catch (error) {
      confirmation.status = 'failed'
      confirmation.doneText = `执行失败：${error.message}`
      updateSharedState({ status: 'failed' })
      messages.value.push({
        id: uid('msg'),
        role: 'assistant',
        kind: 'text',
        text: `确认操作失败：${error.message}`,
        time: clock(),
      })
      status.value = AGENT_RUN_STATUS.FAILED
    }
  }

  function cancelAction(confirmation) {
    if (!confirmation || confirmation.status !== 'pending') return
    confirmation.status = 'cancelled'
    confirmation.doneText = '已取消，本次没有写入任何变更。'
    pendingConfirmation = null
    updateSharedState({ status: 'completed', pending: null })
    const text =
      confirmation.kind === 'purchase_order'
        ? '已取消，本次没有创建采购单，也没有修改审批状态。'
        : confirmation.kind === 'refund_request'
          ? '已取消，本次没有提交退款申请，也没有修改审批状态。'
          : confirmation.kind === 'store_create'
            ? '已取消，本次没有创建门店。'
            : confirmation.kind === 'member_create'
              ? '已取消，本次没有创建会员档案。'
              : confirmation.kind === 'product_create'
                ? '已取消，本次没有创建商品。'
                : '已取消，本次没有修改审批状态。'
    messages.value.push({
      id: uid('msg'),
      role: 'assistant',
      kind: 'text',
      text,
      time: clock(),
    })
    status.value = AGENT_RUN_STATUS.COMPLETED
  }

  function cancelRun() {
    if (!isBusy.value) return
    runToken += 1
    activeStream?.cancel()
    activeStream = null

    toolCalls.value.forEach((tool) => {
      if (tool.status === 'running' || tool.status === 'queued') {
        tool.status = 'cancelled'
      }
    })

    messages.value.push({
      id: uid('msg'),
      role: 'assistant',
      kind: 'text',
      text: '已停止本次运行。',
      time: clock(),
    })
    status.value = AGENT_RUN_STATUS.CANCELLED
    updateSharedState({ status: 'cancelled', pending: null })
  }

  function reset() {
    runToken += 1
    activeStream?.cancel()
    activeStream = null
    messages.value = []
    toolCalls.value = []
    status.value = AGENT_RUN_STATUS.IDLE
    sharedState.value = normalizeSharedState({ threadId: createThreadId() })
    resetRunPointers()
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 忽略存储清理失败
    }
  }

  return {
    panelOpen,
    status,
    messages,
    toolCalls,
    context,
    sharedState,
    isBusy,
    statusLabel,
    open,
    close,
    toggle,
    getTool,
    send,
    submitApproval,
    cancelApproval,
    confirmAction,
    cancelAction,
    cancelRun,
    reset,
  }
})
