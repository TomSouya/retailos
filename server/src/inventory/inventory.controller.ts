import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { InventoryService } from './inventory.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('inventory')
  async list(
    @Req() request: any,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
  ) {
    return {
      items: await this.inventoryService.list(request.actor, {
        search,
        category,
        status,
        storeId,
      }),
    }
  }

  @Patch('inventory/:sku/adjust')
  async adjust(
    @Req() request: any,
    @Param('sku') sku: string,
    @Body() body: { storeId?: string; delta?: number; reason?: string },
  ) {
    return this.inventoryService.adjust(request.actor, sku, body)
  }

  @Get('stock-movements')
  async movements(
    @Req() request: any,
    @Query('storeId') storeId?: string,
    @Query('sku') sku?: string,
    @Query('limit') limit?: string,
  ) {
    return {
      movements: await this.inventoryService.movements(request.actor, {
        storeId,
        sku,
        limit: Number(limit) || 50,
      }),
    }
  }
}
