import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { OrdersService } from './orders.service'
import { ApprovalsService } from '../approvals/approvals.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  @Get()
  async list(
    @Req() request: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('storeId') storeId?: string,
  ) {
    return {
      orders: await this.ordersService.list(request.actor, {
        status,
        search,
        storeId,
      }),
    }
  }

  @Get(':id')
  async detail(@Req() request: any, @Param('id') id: string) {
    return this.ordersService.detail(request.actor, id)
  }

  @Post(':id/refund')
  async refund(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: { amount?: number; reason?: string },
  ) {
    return this.approvalsService.requestRefund(request.actor, id, body || {})
  }
}
