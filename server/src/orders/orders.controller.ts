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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ordersService.page(request.actor, {
      status,
      search,
      storeId,
      page: Number(page),
      pageSize: Number(pageSize),
    })
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
