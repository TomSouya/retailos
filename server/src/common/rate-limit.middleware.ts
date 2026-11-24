// 轻量固定窗口限流：按 IP + 方法计数，单实例内存实现。
// 多实例部署需替换为 Redis 等共享存储。
import type { NextFunction, Request, Response } from 'express'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let windowMs = 60_000
let maxRequests = 1200
let loaded = false

function loadConfig() {
  if (loaded) return
  loaded = true
  const windowValue = Number(process.env.RATE_LIMIT_WINDOW_MS)
  const maxValue = Number(process.env.RATE_LIMIT_MAX)
  if (Number.isFinite(windowValue) && windowValue >= 1000) {
    windowMs = windowValue
  }
  if (Number.isFinite(maxValue) && maxValue > 0) {
    maxRequests = maxValue
  }
}

function clientKey(req: Request) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  return `${ip}:${req.method}`
}

export function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  loadConfig()
  if (req.path === '/api/health' || req.path.startsWith('/api/health/')) {
    return next()
  }

  const now = Date.now()
  const key = clientKey(req)
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count += 1
  const remaining = Math.max(maxRequests - bucket.count, 0)
  res.setHeader('X-RateLimit-Limit', String(maxRequests))
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

  if (bucket.count > maxRequests) {
    res.setHeader(
      'Retry-After',
      String(Math.ceil((bucket.resetAt - now) / 1000)),
    )
    res.status(429).json({
      statusCode: 429,
      message: '请求过于频繁，请稍后重试',
    })
    return
  }

  next()
}

// 定期清理过期桶，避免内存随 IP 数增长。
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, 60_000).unref()
