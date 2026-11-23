import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { username?: string; password?: string }) {
    if (!body?.username || !body?.password) {
      throw new BadRequestException('用户名和密码不能为空')
    }
    return this.authService.login(body.username, body.password)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: any) {
    return { user: request.actor }
  }
}
