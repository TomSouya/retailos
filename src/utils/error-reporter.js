import { API_BASE_URL } from '@/api/config'
import { getCurrentTraceId } from '@/api/client'

const MAX_PER_SESSION = 20
const DEDUPE_WINDOW_MS = 60_000
const MAX_MESSAGE = 500
const MAX_STACK = 4000

const seen = new Map()
let sent = 0
let installed = false

function currentRoute(router) {
  try {
    return router?.currentRoute?.value?.fullPath || ''
  } catch {
    return ''
  }
}

function errorInfo(error) {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack || '' }
  }
  if (typeof error === 'string') {
    return { message: error, stack: '' }
  }
  // 不序列化任意对象，避免把请求数据等敏感内容带进日志
  return {
    message: Object.prototype.toString.call(error),
    stack: '',
  }
}

function send(payload) {
  fetch(`${API_BASE_URL}/api/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // 上报失败不影响页面
  })
}

/**
 * 前端全局错误上报：同一页面 60 秒内相同错误只报一次，每次会话最多 20 条。
 * 载荷只包含错误信息、页面路径与 traceId，不包含本地存储或请求体。
 */
export function reportClientError(error, source = 'window', router) {
  if (error === undefined || error === null) return
  const info = errorInfo(error)
  if (!info.message) return

  const route = currentRoute(router)
  const key = `${source}|${info.message}|${route}`
  const now = Date.now()
  const last = seen.get(key)
  if (last && now - last < DEDUPE_WINDOW_MS) return

  if (seen.size > 100) {
    for (const [item, timestamp] of seen) {
      if (now - timestamp > DEDUPE_WINDOW_MS) seen.delete(item)
    }
  }
  seen.set(key, now)

  if (sent >= MAX_PER_SESSION) return
  sent += 1

  send({
    source,
    message: info.message.slice(0, MAX_MESSAGE),
    stack: info.stack.slice(0, MAX_STACK),
    url: window.location.href.slice(0, 500),
    route,
    userAgent: navigator.userAgent.slice(0, 300),
    traceId: getCurrentTraceId(),
    happenedAt: new Date().toISOString(),
  })
}

export function installErrorReporting(app, router) {
  if (installed) return
  installed = true

  app.config.errorHandler = (error, _instance, info) => {
    reportClientError(error, 'vue', router)
    console.error(error)
  }

  window.addEventListener('error', (event) => {
    // 资源加载失败没有 error 对象，忽略以避免噪声
    if (!event.error) return
    reportClientError(event.error, 'window', router)
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'unhandledrejection', router)
  })
}
