/**
 * Agent 运行时事件契约。
 * 与 AG-UI 的分层保持一致：传输层只负责事件，UI 层只消费事件。
 */
export const AGENT_EVENT = Object.freeze({
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_STATE: 'TOOL_CALL_STATE',
  TOOL_CALL_ARGS: 'TOOL_CALL_ARGS',
  TOOL_CALL_RESULT: 'TOOL_CALL_RESULT',
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  STATE_DELTA: 'STATE_DELTA',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  APPROVAL_RESOLVED: 'APPROVAL_RESOLVED',
})

export const AGENT_RUN_STATUS = Object.freeze({
  IDLE: 'idle',
  UNDERSTANDING: 'understanding',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  STREAMING: 'streaming',
  AWAITING_PERMISSION: 'awaiting_permission',
  RECONNECTING: 'reconnecting',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
})

export const AGENT_BUSY_STATUS = Object.freeze([
  AGENT_RUN_STATUS.UNDERSTANDING,
  AGENT_RUN_STATUS.PLANNING,
  AGENT_RUN_STATUS.EXECUTING,
  AGENT_RUN_STATUS.STREAMING,
  AGENT_RUN_STATUS.RECONNECTING,
])

export const AGENT_STATUS_LABELS = Object.freeze({
  [AGENT_RUN_STATUS.IDLE]: '待命',
  [AGENT_RUN_STATUS.UNDERSTANDING]: '正在理解',
  [AGENT_RUN_STATUS.PLANNING]: '正在规划',
  [AGENT_RUN_STATUS.EXECUTING]: '正在调用工具',
  [AGENT_RUN_STATUS.STREAMING]: '正在生成',
  [AGENT_RUN_STATUS.AWAITING_PERMISSION]: '等待确认',
  [AGENT_RUN_STATUS.RECONNECTING]: '连接中断，正在重连',
  [AGENT_RUN_STATUS.COMPLETED]: '已完成',
  [AGENT_RUN_STATUS.FAILED]: '失败',
  [AGENT_RUN_STATUS.CANCELLED]: '已取消',
})

/**
 * @typedef {Object} AgentEvent
 * @property {string} type
 * @property {string} [runId]
 * @property {string} [messageId]
 * @property {string} [toolCallId]
 * @property {string} [delta]
 * @property {string} [status]
 * @property {Object} [payload]
 */

/**
 * 创建一条符合契约的事件，避免手写字符串。
 * @param {string} type
 * @param {Object} [payload]
 * @returns {AgentEvent}
 */
export function createAgentEvent(type, payload = {}) {
  return { type, ...payload }
}
