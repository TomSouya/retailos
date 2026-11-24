import { safeTraceId } from './request-context'

export const CLIENT_ERROR_SOURCES = new Set([
  'vue',
  'window',
  'unhandledrejection',
  'unknown',
])

export interface ClientErrorEvent {
  source: string
  message: string
  stack?: string
  url?: string
  route?: string
  userAgent?: string
  traceId?: string
  context?: string
  happenedAt: string
}

function toText(value: unknown, max: number, multiline = false) {
  let text = String(value ?? '')
  if (multiline) {
    text = text
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
  } else {
    text = text.replace(/[\u0000-\u001f\u007f]+/g, ' ')
  }
  return text.replace(/[ \t]+/g, ' ').trim().slice(0, max)
}

/**
 * 校验并裁剪前端上报内容，避免超长文本、伪造来源或日志注入。
 * 返回 null 表示缺少有效错误信息。
 */
export function normalizeClientError(input: unknown): ClientErrorEvent | null {
  if (!input || typeof input !== 'object') return null
  const body = input as Record<string, unknown>

  const message = toText(body.message, 500)
  if (!message) return null

  const rawSource = toText(body.source, 40)
  const source = CLIENT_ERROR_SOURCES.has(rawSource) ? rawSource : 'unknown'

  const happened = new Date(String(body.happenedAt || ''))
  const happenedAt = Number.isNaN(happened.getTime())
    ? new Date().toISOString()
    : happened.toISOString()

  return {
    source,
    message,
    stack: toText(body.stack, 4000, true) || undefined,
    url: toText(body.url, 500) || undefined,
    route: toText(body.route, 200) || undefined,
    userAgent: toText(body.userAgent, 300) || undefined,
    traceId: safeTraceId(body.traceId) || undefined,
    context: toText(body.context, 120) || undefined,
    happenedAt,
  }
}
