import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { AuditService } from '../audit/audit.service'
import { PermissionService } from '../auth/permission.service'
import { RoleEntity } from '../database/entities/role.entity'
import { StoreEntity } from '../database/entities/store.entity'
import { UserEntity } from '../database/entities/user.entity'
import {
  effectivePermissions,
  isKnownPermission,
  PERMISSION_MATRIX,
  scopeTypeOf,
} from '../domain/permissions'
import { Actor } from '../domain/types'

const ROLE_ORDER = ['owner', 'regional_manager', 'store_manager', 'warehouse']
const USER_STATUSES = ['active', 'disabled']
const SCOPE_TYPES = ['global', 'region', 'store']

function roleRank(key: string) {
  const index = ROLE_ORDER.indexOf(key)
  return index === -1 ? ROLE_ORDER.length : index
}

function normalizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return [
    ...new Set(
      input
        .map((item) => String(item))
        .filter((item) => isKnownPermission(item)),
    ),
  ]
}

function ensurePasswordPolicy(password: string) {
  if (password.length < 8 || password.length > 32) {
    throw new BadRequestException('密码需为 8-32 位')
  }
  if (/\s/.test(password)) {
    throw new BadRequestException('密码不能包含空格')
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new BadRequestException('密码需同时包含字母和数字')
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date?: Date | null) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ensureOwner(actor: Actor) {
  if (actor?.key !== 'owner') {
    throw new ForbiddenException('只有企业老板可以管理系统账号')
  }
}

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    @InjectRepository(StoreEntity)
    private readonly storesRepository: Repository<StoreEntity>,
    private readonly auditService: AuditService,
    private readonly permissionService: PermissionService,
  ) {}

  private async roleNames() {
    const roles = await this.rolesRepository.find()
    return new Map(roles.map((role) => [role.key, role.name]))
  }

  private toUserDto(user: UserEntity, names: Map<string, string>) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      roleKey: user.roleKey,
      roleName: names.get(user.roleKey) || user.roleKey,
      region: user.region,
      storeId: user.storeId || '',
      scope: user.scope,
      status: user.status || 'active',
      lastLoginAt: formatDateTime(user.lastLoginAt),
      createdAt: formatDateTime(user.createdAt),
    }
  }

  async listUsers(actor: Actor) {
    ensureOwner(actor)
    const [users, names] = await Promise.all([
      this.usersRepository.find({ order: { createdAt: 'ASC' } }),
      this.roleNames(),
    ])
    return users
      .slice()
      .sort((a, b) => roleRank(a.roleKey) - roleRank(b.roleKey))
      .map((user) => this.toUserDto(user, names))
  }

  async listRoles(actor: Actor) {
    ensureOwner(actor)
    const [roles, users] = await Promise.all([
      this.rolesRepository.find(),
      this.usersRepository.find(),
    ])

    return {
      roles: roles
        .slice()
        .sort((a, b) => roleRank(a.key) - roleRank(b.key))
        .map((role) => ({
          key: role.key,
          name: role.name,
          builtin: Number(role.builtin) === 1,
          scopeType: role.scopeType || scopeTypeOf(role.key),
          description: role.description || '',
          permissions: effectivePermissions(role.key),
          customized: Boolean(role.permissions),
          userCount: users.filter((user) => user.roleKey === role.key).length,
        })),
      matrix: PERMISSION_MATRIX,
      scopeTypes: [
        { key: 'global', label: '全国' },
        { key: 'region', label: '区域' },
        { key: 'store', label: '门店' },
      ],
    }
  }

  async createRole(
    actor: Actor,
    body: {
      key?: string
      name?: string
      scopeType?: string
      description?: string
      permissions?: string[]
    },
  ) {
    ensureOwner(actor)

    const key = String(body.key || '').trim().toLowerCase()
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(key)) {
      throw new BadRequestException('角色编号需为 2-32 位小写字母、数字或下划线')
    }
    if (ROLE_ORDER.includes(key)) {
      throw new BadRequestException('角色编号与系统内置角色冲突')
    }
    const name = String(body.name || '').trim()
    if (!name) throw new BadRequestException('角色名称不能为空')

    const scopeType = SCOPE_TYPES.includes(String(body.scopeType))
      ? String(body.scopeType)
      : 'region'
    const permissions = normalizePermissions(body.permissions)
    if (!permissions.length) {
      throw new BadRequestException('请至少选择一项权限')
    }

    const exists = await this.rolesRepository.findOne({ where: { key } })
    if (exists) throw new BadRequestException('角色编号已存在')

    const entity = this.rolesRepository.create({
      key,
      name,
      builtin: 0,
      scopeType,
      description: String(body.description || '').trim().slice(0, 160),
      permissions: JSON.stringify(permissions),
    })
    await this.rolesRepository.save(entity)
    await this.permissionService.reload()

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '新增角色',
      object: entity.key,
      result: 'success',
      approvalId: '—',
    })

    const roles = await this.listRoles(actor)
    return roles.roles.find((role) => role.key === entity.key) || null
  }

  async updateRole(
    actor: Actor,
    key: string,
    body: {
      name?: string
      scopeType?: string
      description?: string
      permissions?: string[]
      resetDefaults?: boolean
    },
  ) {
    ensureOwner(actor)
    if (key === 'owner') {
      throw new BadRequestException('企业老板角色固定为超级管理员，不可修改')
    }

    const role = await this.rolesRepository.findOne({ where: { key } })
    if (!role) throw new NotFoundException('角色不存在')

    const changes: string[] = []
    if (body.name !== undefined && body.name.trim() !== role.name) {
      if (!body.name.trim()) throw new BadRequestException('角色名称不能为空')
      role.name = body.name.trim()
      changes.push('角色名称')
    }
    if (body.description !== undefined) {
      role.description = String(body.description).trim().slice(0, 160)
      changes.push('角色描述')
    }
    if (body.scopeType !== undefined && !Number(role.builtin)) {
      if (!SCOPE_TYPES.includes(body.scopeType)) {
        throw new BadRequestException('数据范围不合法')
      }
      role.scopeType = body.scopeType
      changes.push('数据范围')
    }
    if (body.resetDefaults) {
      role.permissions = null
      changes.push('恢复默认权限')
    } else if (body.permissions !== undefined) {
      const permissions = normalizePermissions(body.permissions)
      if (!permissions.length) {
        throw new BadRequestException('请至少选择一项权限')
      }
      role.permissions = JSON.stringify(permissions)
      changes.push('权限配置')
    }

    if (!changes.length) {
      throw new BadRequestException('没有需要更新的内容')
    }

    await this.rolesRepository.save(role)
    await this.permissionService.reload()

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: `更新角色（${changes.join('、')}）`,
      object: role.key,
      result: 'success',
      approvalId: '—',
    })

    const roles = await this.listRoles(actor)
    return roles.roles.find((item) => item.key === role.key) || null
  }

  async deleteRole(actor: Actor, key: string) {
    ensureOwner(actor)
    if (ROLE_ORDER.includes(key)) {
      throw new BadRequestException('系统内置角色不能删除')
    }
    const role = await this.rolesRepository.findOne({ where: { key } })
    if (!role) throw new NotFoundException('角色不存在')

    const userCount = await this.usersRepository.count({
      where: { roleKey: key },
    })
    if (userCount > 0) {
      throw new BadRequestException('该角色下仍有账号，请先调整账号角色')
    }

    await this.rolesRepository.remove(role)
    await this.permissionService.reload()

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '删除角色',
      object: key,
      result: 'success',
      approvalId: '—',
    })

    return { key }
  }

  async createUser(
    actor: Actor,
    body: {
      username?: string
      name?: string
      password?: string
      roleKey?: string
      region?: string
      storeId?: string
    },
  ) {
    ensureOwner(actor)

    const username = String(body.username || '').trim()
    const name = String(body.name || '').trim()
    const password = String(body.password || '')
    const roleKey = String(body.roleKey || '').trim()

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      throw new BadRequestException('用户名需为 3-32 位字母、数字或下划线')
    }
    if (!name) throw new BadRequestException('姓名不能为空')
    ensurePasswordPolicy(password)

    const role = await this.rolesRepository.findOne({
      where: { key: roleKey },
    })
    if (!role) throw new BadRequestException('角色不存在')

    const exists = await this.usersRepository.findOne({
      where: { username },
    })
    if (exists) throw new BadRequestException('用户名已存在')

    let region = String(body.region || '').trim()
    let storeId: string | null = null
    let scope = ''
    const scopeType = role.scopeType || scopeTypeOf(roleKey)

    if (scopeType === 'global') {
      region = '全国'
      scope = '全国门店'
    } else if (scopeType === 'store') {
      const store = await this.storesRepository.findOne({
        where: { id: String(body.storeId || '') },
      })
      if (!store) throw new BadRequestException('该角色必须绑定门店')
      storeId = store.id
      if (!region) region = store.region
      scope = `${store.city} · ${store.name}`
    } else {
      if (!region) throw new BadRequestException('请填写所属区域')
      scope =
        roleKey === 'warehouse'
          ? `${region} · 中心仓`
          : `${region} · ${role.name}`
    }

    const entity = this.usersRepository.create({
      id: randomUUID(),
      username,
      passwordHash: await bcrypt.hash(password, 10),
      name,
      roleKey,
      region,
      storeId,
      scope,
      status: 'active',
      tokenVersion: 0,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date(),
    })
    await this.usersRepository.save(entity)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '新增账号',
      object: entity.username,
      result: 'success',
      approvalId: '—',
    })

    const names = await this.roleNames()
    return this.toUserDto(entity, names)
  }

  async resetPassword(
    actor: Actor,
    id: string,
    passwordInput: string,
  ) {
    ensureOwner(actor)

    const password = String(passwordInput || '')
    ensurePasswordPolicy(password)

    const user = await this.usersRepository.findOne({ where: { id } })
    if (!user) throw new NotFoundException('账号不存在')

    user.passwordHash = await bcrypt.hash(password, 10)
    user.tokenVersion = (user.tokenVersion || 0) + 1
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    await this.usersRepository.save(user)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: '重置密码',
      object: user.username,
      result: 'success',
      approvalId: '—',
    })

    return { id: user.id, username: user.username }
  }

  async updateUser(
    actor: Actor,
    actorId: string,
    id: string,
    body: { status?: string; roleKey?: string; storeId?: string },
  ) {
    ensureOwner(actor)
    if (body.status === undefined && body.roleKey === undefined) {
      throw new BadRequestException('没有需要更新的内容')
    }

    const user = await this.usersRepository.findOne({ where: { id } })
    if (!user) throw new NotFoundException('账号不存在')

    const actions: string[] = []
    let nextStatus = user.status || 'active'
    let nextRoleKey = user.roleKey
    let nextStoreId = user.storeId
    let nextScope = user.scope

    if (body.status !== undefined) {
      if (!USER_STATUSES.includes(body.status)) {
        throw new BadRequestException('账号状态不合法')
      }
      if (body.status === 'disabled') {
        if (id === actorId) {
          throw new BadRequestException('不能停用自己的账号')
        }
        if (user.roleKey === 'owner') {
          const activeOwners = await this.usersRepository.count({
            where: { roleKey: 'owner', status: 'active' },
          })
          if (activeOwners <= 1) {
            throw new BadRequestException('至少保留一名启用的企业老板')
          }
        }
      }
      nextStatus = body.status
      actions.push(body.status === 'disabled' ? '停用账号' : '启用账号')
    }

    if (body.roleKey !== undefined && body.roleKey !== user.roleKey) {
      if (id === actorId) {
        throw new BadRequestException('不能修改自己的角色')
      }
      const role = await this.rolesRepository.findOne({
        where: { key: body.roleKey },
      })
      if (!role) throw new BadRequestException('角色不存在')

      if (body.roleKey === 'store_manager') {
        const storeId = body.storeId || user.storeId
        if (!storeId) {
          throw new BadRequestException('连锁角色必须绑定门店')
        }
        const store = await this.storesRepository.findOne({
          where: { id: storeId },
        })
        if (!store) throw new BadRequestException('门店不存在')
        nextStoreId = store.id
        nextScope = `${store.city} · ${store.name}`
      } else {
        const scopeType = role.scopeType || scopeTypeOf(body.roleKey)
        if (scopeType === 'store') {
          const storeId = body.storeId || user.storeId
          if (!storeId) {
            throw new BadRequestException('该角色必须绑定门店')
          }
          const store = await this.storesRepository.findOne({
            where: { id: storeId },
          })
          if (!store) throw new BadRequestException('门店不存在')
          nextStoreId = store.id
          nextScope = `${store.city} · ${store.name}`
        } else if (scopeType === 'global') {
          nextStoreId = null
          nextScope = '全国门店'
        } else {
          nextStoreId = null
          nextScope =
            body.roleKey === 'warehouse'
              ? `${user.region} · 中心仓`
              : `${user.region} · ${role.name}`
        }
      }
      nextRoleKey = body.roleKey
      actions.push('调整角色')
    } else if (
      body.storeId !== undefined &&
      (body.roleKey || user.roleKey) === 'store_manager'
    ) {
      const store = await this.storesRepository.findOne({
        where: { id: body.storeId },
      })
      if (!store) throw new BadRequestException('门店不存在')
      nextStoreId = store.id
      nextScope = `${store.city} · ${store.name}`
      actions.push('调整所属门店')
    }

    if (!actions.length) {
      throw new BadRequestException('没有需要更新的内容')
    }

    user.roleKey = nextRoleKey
    user.storeId = nextStoreId || null
    user.scope = nextScope
    user.status = nextStatus
    user.tokenVersion = (user.tokenVersion || 0) + 1
    await this.usersRepository.save(user)

    await this.auditService.record({
      actor: actor.name,
      role: actor.label,
      action: actions.join(' / '),
      object: user.username,
      result: 'success',
      approvalId: '—',
    })

    const names = await this.roleNames()
    return this.toUserDto(user, names)
  }
}
