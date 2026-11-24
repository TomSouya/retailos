import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestContext {
  traceId: string
  requestId: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return storage.run(context, callback)
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

export function currentTraceId(): string {
  return storage.getStore()?.traceId || ''
}

// 仅接受安全字符与长度范围内的链路 ID，避免客户端伪造或注入超长内容
const TRACE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/

export function safeTraceId(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim()
  return TRACE_ID_PATTERN.test(text) ? text : fallback
}
