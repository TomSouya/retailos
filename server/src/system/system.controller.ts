import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { SystemService } from './system.service'

@Controller('api/system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('users')
  async users(@Req() request: any) {
    return { users: await this.systemService.listUsers(request.actor) }
  }

  @Get('roles')
  async roles(@Req() request: any) {
    return this.systemService.listRoles(request.actor)
  }

  @Post('roles')
  async createRole(
    @Req() request: any,
    @Body()
    body: {
      key?: string
      name?: string
      scopeType?: string
      description?: string
      permissions?: string[]
    },
  ) {
    return this.systemService.createRole(request.actor, body)
  }

  @Patch('roles/:key')
  async updateRole(
    @Req() request: any,
    @Param('key') key: string,
    @Body()
    body: {
      name?: string
      scopeType?: string
      description?: string
      permissions?: string[]
      resetDefaults?: boolean
    },
  ) {
    return this.systemService.updateRole(request.actor, key, body)
  }

  @Delete('roles/:key')
  async deleteRole(@Req() request: any, @Param('key') key: string) {
    return this.systemService.deleteRole(request.actor, key)
  }

  @Post('users')
  async createUser(
    @Req() request: any,
    @Body()
    body: {
      username?: string
      name?: string
      password?: string
      roleKey?: string
      region?: string
      storeId?: string
    },
  ) {
    return this.systemService.createUser(request.actor, body)
  }

  @Patch('users/:id/password')
  async resetPassword(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: { password?: string },
  ) {
    return this.systemService.resetPassword(
      request.actor,
      id,
      body.password || '',
    )
  }

  @Patch('users/:id')
  async updateUser(
    @Req() request: any,
    @Param('id') id: string,
    @Body() body: { status?: string; roleKey?: string; storeId?: string },
  ) {
    return this.systemService.updateUser(
      request.actor,
      request.userId,
      id,
      body,
    )
  }
}
