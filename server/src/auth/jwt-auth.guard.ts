import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserEntity } from '../database/entities/user.entity'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const header = request.headers.authorization || ''
    const [type, token] = header.split(' ')

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('未登录')
    }

    let payload: any
    try {
      payload = await this.jwtService.verifyAsync(token)
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录')
    }

    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    })
    if (!user || user.status === 'disabled') {
      throw new UnauthorizedException('账号已被停用，请联系企业管理员')
    }
    if (Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) {
      throw new UnauthorizedException('登录状态已失效，请重新登录')
    }

    request.actor = payload.actor
    request.userId = payload.sub
    return true
  }
}
