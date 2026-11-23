/**
 * AG-UI 共享状态契约。
 * 会话线程、上下文、当前运行与待确认动作显式化，便于刷新恢复与 trace 串联。
 */
export const AGENT_STATE_VERSION = '1.0'

export function createThreadId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `thr_${Date.now().toString(36)}_${random}`
}

export function createTraceId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `trc_${Date.now().toString(36)}_${random}`
}

export function normalizeSharedState(input = {}) {
  return {
    version: AGENT_STATE_VERSION,
    threadId: String(input.threadId || ''),
    traceId: String(input.traceId || ''),
    context:
      input.context && typeof input.context === 'object'
        ? { ...input.context }
        : {},
    lastRunId: String(input.lastRunId || ''),
    status: String(input.status || 'idle'),
    pending: input.pending || null,
    updatedAt: String(input.updatedAt || ''),
  }
}
