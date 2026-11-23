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
import { MembersService } from './members.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api/members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  async list(
    @Req() request: any,
    @Query('search') search?: string,
    @Query('level') level?: string,
    @Query('status') status?: string,
    @Query('storeId') storeId?: string,
    @Query('segment') segment?: string,
    @Query('inactiveDays') inactiveDays?: string,
  ) {
    return this.membersService.list(request.actor, {
      search,
      level,
      status,
      storeId,
      segment,
      inactiveDays,
    })
  }

  @Post('points/recalculate')
  async recalculatePoints(@Req() request: any) {
    return this.membersService.recalculatePoints(request.actor)
  }

  @Post()
  async create(
    @Req() request: any,
    @Body()
    body: {
      name?: string
      phone?: string
      level?: string
      storeId?: string
      points?: number
    },
  ) {
    return this.membersService.create(request.actor, body)
  }

  @Get(':id')
  async detail(@Req() request: any, @Param('id') id: string) {
    return this.membersService.detail(request.actor, id)
  }

  @Patch(':id')
  async update(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: { level?: string; status?: string; points?: number },
  ) {
    return this.membersService.update(request.actor, id, body)
  }
}
