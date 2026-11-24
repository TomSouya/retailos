import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common'
import { normalizeClientError } from '../common/client-error'
import { logError } from '../common/logger'
import { recordClientError } from '../common/metrics'

@Controller('api/client-errors')
export class ClientErrorsController {
  // 公开端点：前端在登录前后都可能上报，依赖全局限流控制频率
  @Post()
  @HttpCode(202)
  report(@Body() body: unknown, @Req() request: any) {
    const event = normalizeClientError(body)
    if (!event) {
      throw new BadRequestException('错误信息不能为空')
    }

    recordClientError(event.source)
    logError('client_error', {
      ...event,
      requestId: request?.requestId,
      requestTraceId: request?.traceId,
    })
    return { ok: true }
  }
}
