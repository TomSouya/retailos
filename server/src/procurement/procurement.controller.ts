import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ProcurementService } from './procurement.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api/purchase-orders')
@UseGuards(JwtAuthGuard)
export class ProcurementController {
  constructor(
    private readonly procurementService: ProcurementService,
  ) {}

  @Get()
  async list(
    @Req() request: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return {
      orders: await this.procurementService.list(request.actor, {
        status,
        search,
      }),
    }
  }

  @Post()
  async create(@Req() request: any, @Body() body: any) {
    return this.procurementService.create(request.actor, body)
  }

  @Patch(':id')
  async update(@Req() request: any, @Param('id') id: string, @Body() body: any) {
    return this.procurementService.updateDraft(request.actor, id, body)
  }

  @Patch(':id/submit')
  async submit(@Req() request: any, @Param('id') id: string) {
    return this.procurementService.transition(
      request.actor,
      id,
      'submit',
    )
  }

  @Patch(':id/approve')
  async approve(@Req() request: any, @Param('id') id: string) {
    return this.procurementService.transition(
      request.actor,
      id,
      'approve',
    )
  }

  @Patch(':id/receive')
  async receive(@Req() request: any, @Param('id') id: string) {
    return this.procurementService.transition(
      request.actor,
      id,
      'receive',
    )
  }
}
