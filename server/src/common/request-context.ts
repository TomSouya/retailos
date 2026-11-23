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
