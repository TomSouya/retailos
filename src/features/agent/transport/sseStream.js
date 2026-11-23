import { getAuthToken } from '@/api/client'

/**
 * SSE 传输层：对接真实后端时使用。
 * 后端按 AgentEvent 契约逐条返回：
 *   data: {"type":"RUN_STARTED","runId":"..."}\n\n
 *   data: {"type":"TOOL_CALL_START",...}\n\n
 *   ...
 *   data: {"type":"RUN_FINISHED",...}\n\n
 */
export function createSseAgentStream({ url }) {
  let controller = null

  return {
    cancel() {
      controller?.abort()
      controller = null
    },

    async *send({ text, context, history = [], state, traceId }) {
      if (!url) {
        throw new Error('未配置 VITE_AGENT_API_URL，无法使用 SSE 传输')
      }

      const token = getAuthToken()
      if (!token) {
        throw new Error('未登录，无法连接 Agent 服务')
      }

      controller = new AbortController()
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(traceId ? { 'X-Trace-Id': traceId } : {}),
        },
        body: JSON.stringify({ text, context, history, state, traceId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = new Error(`Agent 服务返回 ${response.status}`)
        error.status = response.status
        throw error
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('当前浏览器不支持流式响应')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''

        for (const block of blocks) {
          const dataLines = block
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('')

          if (!dataLines || dataLines === '[DONE]') continue
          yield JSON.parse(dataLines)
        }
      }
    },
  }
}
