import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { assertSecureConfig } from './common/config-check'
import { rateLimit } from './common/rate-limit.middleware'
import { requestLogger } from './common/request-logger.middleware'

const DEFAULT_CORS_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:4174',
  'http://localhost:4174',
  'http://127.0.0.1:4175',
  'http://localhost:4175',
  'http://127.0.0.1:8080',
  'http://localhost:8080',
]

function corsOrigins() {
  const configured = String(process.env.CORS_ORIGINS || '').trim()
  if (!configured) return DEFAULT_CORS_ORIGINS
  return configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

async function bootstrap() {
  assertSecureConfig()
  const app = await NestFactory.create(AppModule)

  // 安全响应头：API 不返回 HTML，关闭 CSP 避免误伤
  app.use(helmet({ contentSecurityPolicy: false }))

  const http = app.getHttpAdapter().getInstance()
  const trustProxy = String(process.env.TRUST_PROXY || '').trim()
  if (trustProxy) {
    http.set(
      'trust proxy',
      trustProxy === 'true' ? 1 : Number(trustProxy) || trustProxy,
    )
  }

  const origins = corsOrigins()
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origins.includes('*') || origins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Trace-Id',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'X-Trace-Id',
      'Content-Disposition',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  })
  app.use(requestLogger)
  app.use(rateLimit)
  app.enableShutdownHooks()

  const port = Number(process.env.PORT || 3000)
  const host = process.env.HOST || '127.0.0.1'
  await app.listen(port, host)
  console.log(`RetailOS server listening on http://${host}:${port}`)
}

bootstrap()
