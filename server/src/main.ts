import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { requestLogger } from './common/request-logger.middleware'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({
    origin: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Trace-Id',
    ],
    exposedHeaders: ['X-Request-Id', 'X-Trace-Id', 'Content-Disposition'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  })
  app.use(requestLogger)
  app.enableShutdownHooks()

  const port = Number(process.env.PORT || 3000)
  const host = process.env.HOST || '127.0.0.1'
  await app.listen(port, host)
  console.log(`RetailOS server listening on http://${host}:${port}`)
}

bootstrap()
