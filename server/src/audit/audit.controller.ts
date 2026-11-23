import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { AuditService } from './audit.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('api/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async list(@Req() request: any) {
    return {
      records: await this.auditService.list(request.actor),
    }
  }
}
