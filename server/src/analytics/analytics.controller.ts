import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AnalyticsService } from './analytics.service'

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  async dashboard(
    @Req() request: any,
    @Query('range') range?: string,
  ) {
    return this.analytics.dashboard(request.actor, range)
  }
}
