import { Injectable, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RoleEntity } from '../database/entities/role.entity'
import {
  RoleConfig,
  ScopeType,
  setRoleConfig,
} from '../domain/permissions'

function parsePermissions(value: string | null): string[] | null {
  if (!value) return null
  try {
    const list = JSON.parse(value)
    return Array.isArray(list) ? list.map((item) => String(item)) : null
  } catch {
    return null
  }
}

@Injectable()
export class PermissionService implements OnModuleInit {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
  ) {}

  async onModuleInit() {
    await this.reload()
  }

  async reload() {
    const roles = await this.rolesRepository.find()
    if (!roles.length) return
    setRoleConfig(
      roles.map(
        (role): RoleConfig => ({
          key: role.key,
          name: role.name,
          builtin: Number(role.builtin) === 1,
          scopeType: (role.scopeType || 'region') as ScopeType,
          permissions: parsePermissions(role.permissions),
        }),
      ),
    )
  }
}
