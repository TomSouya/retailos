import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { JwtService } from '@nestjs/jwt'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { RoleEntity } from '../database/entities/role.entity'
import { UserEntity } from '../database/entities/user.entity'
import {
  effectivePermissions,
  scopeTypeOf,
} from '../domain/permissions'
import { Actor, RoleKey } from '../domain/types'
import { PermissionService } from './permission.service'

const DEMO_PASSWORD = 'retailos123'
const MAX_LOGIN_ATTEMPTS = 5
const LOCK_MINUTES = 15

const ROLE_SEED = [
  {
    key: 'owner',
    name: '企业老板',
    builtin: 1,
    scopeType: 'global',
    description: '全局经营数据、跨区域对比与关键审批',
  },
  {
    key: 'regional_manager',
    name: '区域经理',
    builtin: 1,
    scopeType: 'region',
    description: '区域经营、门店异常与补货审批',
  },
  {
    key: 'store_manager',
    name: '店长',
    builtin: 1,
    scopeType: 'store',
    description: '本店经营、库存预警与补货发起',
  },
  {
    key: 'warehouse',
    name: '仓库管理员',
    builtin: 1,
    scopeType: 'region',
    description: '库存、出入库与采购到货验收',
  },
]

const USER_SEED = [
  {
    username: 'owner',
    name: '陈星',
    roleKey: 'owner',
    region: '全国',
    storeId: null,
    scope: '全国 50 家门店',
  },
  {
    username: 'regional',
    name: '林悦',
    roleKey: 'regional_manager',
    region: '华东',
    storeId: null,
    scope: '华东区 · 12 家门店',
  },
  {
    username: 'store',
    name: '周然',
    roleKey: 'store_manager',
    region: '华东',
    storeId: 'S001',
    scope: '星辰生活 · 静安店',
  },
  {
    username: 'warehouse',
    name: '顾岩',
    roleKey: 'warehouse',
    region: '华东',
    storeId: null,
    scope: '华东中心仓',
  },
]

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    private readonly jwtService: JwtService,
    private readonly permissionService: PermissionService,
  ) {}

  async onModuleInit() {
    const roleCount = await this.rolesRepository.count()
    if (roleCount === 0) {
      await this.rolesRepository.save(
        ROLE_SEED.map((role) => this.rolesRepository.create(role)),
      )
    }

    const userCount = await this.usersRepository.count()
    if (userCount === 0) {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
      await this.usersRepository.save(
        USER_SEED.map((user) =>
          this.usersRepository.create({
            id: randomUUID(),
            username: user.username,
            passwordHash,
            name: user.name,
            roleKey: user.roleKey,
            region: user.region,
            storeId: user.storeId,
            scope: user.scope,
            status: 'active',
            tokenVersion: 0,
            lastLoginAt: null,
            createdAt: new Date(),
          }),
        ),
      )
    }

    await this.permissionService.reload()
  }

  async login(username: string, password: string) {
    if (!username || !password) {
      throw new BadRequestException('用户名和密码不能为空')
    }

    const user = await this.usersRepository.findOne({
      where: { username },
    })
    if (!user) throw new UnauthorizedException('用户名或密码错误')

    if (user.status === 'disabled') {
      throw new ForbiddenException('账号已被停用，请联系企业管理员')
    }

    const now = Date.now()
    const lockedUntil = user.lockedUntil
      ? new Date(user.lockedUntil).getTime()
      : 0
    if (lockedUntil > now) {
      const minutes = Math.max(
        1,
        Math.ceil((lockedUntil - now) / 60000),
      )
      throw new ForbiddenException(
        `登录失败次数过多，账号已锁定，请 ${minutes} 分钟后重试`,
      )
    }
    if (lockedUntil && lockedUntil <= now) {
      user.failedLoginAttempts = 0
      user.lockedUntil = null
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      const attempts = Number(user.failedLoginAttempts || 0) + 1
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        user.failedLoginAttempts = 0
        user.lockedUntil = new Date(
          Date.now() + LOCK_MINUTES * 60000,
        )
        await this.usersRepository.save(user)
        throw new ForbiddenException(
          `登录失败次数过多，账号已锁定 ${LOCK_MINUTES} 分钟`,
        )
      }
      user.failedLoginAttempts = attempts
      await this.usersRepository.save(user)
      throw new UnauthorizedException(
        `用户名或密码错误，还可尝试 ${MAX_LOGIN_ATTEMPTS - attempts} 次`,
      )
    }

    user.lastLoginAt = new Date()
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    await this.usersRepository.save(user)

    const role = await this.rolesRepository.findOne({
      where: { key: user.roleKey },
    })

    const actor: Actor = {
      key: user.roleKey as RoleKey,
      label: role?.name || user.roleKey,
      name: user.name,
      region: user.region,
      storeId: user.storeId,
      scope: user.scope,
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      ver: user.tokenVersion || 0,
      actor,
    })

    return {
      token,
      user: {
        ...actor,
        username: user.username,
        scopeType: scopeTypeOf(user.roleKey),
        permissions: effectivePermissions(user.roleKey),
      },
    }
  }
}
