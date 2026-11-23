import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApprovalsService } from './approvals.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api/approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  async list(@Req() request: any) {
    return { approvals: await this.approvalsService.list(request.actor) }
  }

  @Post()
  async create(
    @Req() request: any,
    @Body()
    body: {
      storeId: string
      storeName?: string
      risk?: 'low' | 'medium' | 'high'
      items: Array<{ sku: string; name: string; quantity: number }>
      summary?: string
      params?: Record<string, any>
      expiresAt?: string
    },
  ) {
    return this.approvalsService.create({
      ...body,
      actor: request.actor,
    })
  }

  @Patch(':id')
  async decide(
    @Param('id') id: string,
    @Req() request: any,
    @Body()
    body: {
      decision: 'approved' | 'rejected'
    },
  ) {
    if (!['approved', 'rejected'].includes(body.decision)) {
      throw new BadRequestException('decision 必须是 approved 或 rejected')
    }
    return this.approvalsService.decide(
      id,
      body.decision,
      request.actor,
    )
  }
}
