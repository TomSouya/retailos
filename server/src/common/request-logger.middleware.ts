import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { log, type LogLevel } from './logger'
import { recordHttpRequest } from './metrics'
import { runWithRequestContext, safeTraceId } from './request-context'

const SLOW_REQUEST_MS = 800
const HEALTH_PATHS = new Set([
  '/api/health',
  '/api/health/live',
  '/api/health/ready',
  '/api/metrics',
])

function pickHeader(req: Request, name: string): string {
  const header = req.headers[name]
  const value = Array.isArray(header) ? header[0] : header
  return value?.trim() || ''
}

/**
 * 为每个请求生成/透传 X-Request-Id 与 X-Trace-Id，响应结束后输出一行 JSON 访问日志。
 * traceId 会进入异步上下文，供审计与 Agent 链路复用。
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = pickHeader(req, 'x-request-id') || randomUUID()
  const traceId =
    safeTraceId(pickHeader(req, 'x-trace-id')) || requestId
  res.setHeader('X-Request-Id', requestId)
  res.setHeader('X-Trace-Id', traceId)
  ;(req as any).requestId = requestId
  ;(req as any).traceId = traceId

  const startedAt = Date.now()
  const path = req.originalUrl?.split('?')[0] || req.url

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt
    if (HEALTH_PATHS.has(path)) return

    recordHttpRequest(req.method, res.statusCode, durationMs)

    const actor = (req as any).actor
    const level: LogLevel =
      res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400
          ? 'warn'
          : 'info'
    log(level, 'http_request', {
      requestId,
      traceId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs,
      actor: actor ? `${actor.name}(${actor.key})` : undefined,
      slow: durationMs >= SLOW_REQUEST_MS || undefined,
    })
  })

  runWithRequestContext({ traceId, requestId }, next)
}
