import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { AgentService } from './agent.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('stream')
  @UseGuards(JwtAuthGuard)
  async stream(
    @Body()
    body: {
      text?: string
      context?: Record<string, any>
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
      state?: {
        version?: string
        threadId?: string
        traceId?: string
        context?: Record<string, any>
      }
      traceId?: string
    },
    @Req() request: any,
    @Res() res: any,
  ) {
    await this.agentService.stream(
      { ...body, traceId: body.traceId || request.traceId },
      request.actor,
      res,
    )
  }
}
