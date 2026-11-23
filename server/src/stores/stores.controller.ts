import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { StoresService } from './stores.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api/stores')
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  async list(@Req() request: any) {
    return { stores: await this.storesService.list(request.actor) }
  }

  @Post()
  async create(
    @Req() request: any,
    @Body()
    body: {
      name?: string
      city?: string
      region?: string
      manager?: string
      phone?: string
      openedAt?: string
    },
  ) {
    return this.storesService.create(request.actor, body)
  }

  @Get(':id')
  async detail(@Req() request: any, @Param('id') id: string) {
    return this.storesService.detail(request.actor, id)
  }

  @Patch(':id')
  async update(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: { manager?: string; phone?: string; status?: string },
  ) {
    return this.storesService.update(request.actor, id, body)
  }
}
