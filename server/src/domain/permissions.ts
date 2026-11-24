import { ForbiddenException } from '@nestjs/common'
import { RoleKey } from './types'

export interface PermissionAction {
  key: string
  label: string
  roles: RoleKey[]
}

export interface PermissionModule {
  key: string
  label: string
  actions: PermissionAction[]
}

export type ScopeType = 'global' | 'region' | 'store'

export interface RoleConfig {
  key: string
  name: string
  builtin: boolean
  scopeType: ScopeType
  permissions: string[] | null
}

/**
 * 权限矩阵是默认权限配置：内置角色未做覆盖时按这里生效，
 * 自定义角色的权限以 roles.permissions 为准。
 */
export const PERMISSION_MATRIX: PermissionModule[] = [
  {
    key: 'dashboard',
    label: '经营驾驶舱',
    actions: [
      {
        key: 'read',
        label: '查看经营指标',
        roles: ['owner', 'regional_manager', 'store_manager'],
      },
      {
        key: 'agent',
        label: '使用经营助手',
        roles: [
          'owner',
          'regional_manager',
          'store_manager',
          'warehouse',
        ],
      },
    ],
  },
  {
    key: 'inventory',
    label: '库存管理',
    actions: [
      {
        key: 'read',
        label: '查看库存与流水',
        roles: [
          'owner',
          'regional_manager',
          'store_manager',
          'warehouse',
        ],
      },
      {
        key: 'adjust',
        label: '库存调整',
        roles: ['owner', 'regional_manager', 'warehouse'],
      },
      {
        key: 'replenish',
        label: '发起补货申请',
        roles: ['owner', 'store_manager'],
      },
    ],
  },
  {
    key: 'orders',
    label: '订单管理',
    actions: [
      {
        key: 'read',
        label: '查看销售订单',
        roles: ['owner', 'regional_manager', 'store_manager'],
      },
      {
        key: 'refund',
        label: '处理退款',
        roles: ['owner', 'regional_manager'],
      },
      {
        key: 'refund_request',
        label: '发起退款申请',
        roles: ['owner', 'regional_manager', 'store_manager'],
      },
    ],
  },
  {
    key: 'products',
    label: '商品与供应商',
    actions: [
      {
        key: 'read',
        label: '查看商品 / 供应商',
        roles: [
          'owner',
          'regional_manager',
          'store_manager',
          'warehouse',
        ],
      },
      {
        key: 'write',
        label: '新增与编辑',
        roles: ['owner', 'regional_manager'],
      },
      {
        key: 'pii',
        label: '查看供应商联系方式',
        roles: ['owner', 'regional_manager', 'warehouse'],
      },
    ],
  },
  {
    key: 'procurement',
    label: '采购管理',
    actions: [
      {
        key: 'read',
        label: '查看采购单',
        roles: ['owner', 'regional_manager', 'warehouse'],
      },
      {
        key: 'create',
        label: '创建采购单',
        roles: ['owner', 'regional_manager', 'warehouse'],
      },
      {
        key: 'approve',
        label: '审批采购单',
        roles: ['owner', 'regional_manager'],
      },
      {
        key: 'receive',
        label: '到货验收',
        roles: ['owner', 'warehouse'],
      },
    ],
  },
  {
    key: 'stores',
    label: '门店管理',
    actions: [
      {
        key: 'read',
        label: '查看门店',
        roles: ['owner', 'regional_manager'],
      },
      {
        key: 'write',
        label: '编辑门店',
        roles: ['owner', 'regional_manager'],
      },
    ],
  },
  {
    key: 'members',
    label: '会员管理',
    actions: [
      {
        key: 'read',
        label: '查看会员',
        roles: ['owner', 'regional_manager', 'store_manager'],
      },
      {
        key: 'pii',
        label: '查看完整手机号',
        roles: ['owner', 'regional_manager'],
      },
      {
        key: 'write',
        label: '编辑会员',
        roles: ['owner', 'regional_manager'],
      },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    actions: [
      {
        key: 'accounts',
        label: '账号与角色管理',
        roles: ['owner'],
      },
      {
        key: 'audit',
        label: '查看审计日志',
        roles: ['owner'],
      },
    ],
  },
]

export const ALL_PERMISSIONS: string[] = PERMISSION_MATRIX.flatMap(
  (module) => module.actions.map((action) => `${module.key}.${action.key}`),
)

const PERMISSION_LABELS = new Map<string, string>(
  PERMISSION_MATRIX.flatMap((module) =>
    module.actions.map((action) => [
      `${module.key}.${action.key}`,
      `${module.label}·${action.label}`,
    ]),
  ),
)

const BUILTIN_SCOPE: Record<string, ScopeType> = {
  owner: 'global',
  regional_manager: 'region',
  store_manager: 'store',
  warehouse: 'region',
}

const roleConfig = new Map<string, RoleConfig>()

export function setRoleConfig(roles: RoleConfig[]) {
  roleConfig.clear()
  for (const role of roles) {
    roleConfig.set(role.key, {
      ...role,
      permissions: role.permissions ? [...role.permissions] : null,
    })
  }
}

export function roleConfigOf(key: string): RoleConfig | undefined {
  return roleConfig.get(key)
}

export function listRoleConfigs(): RoleConfig[] {
  return [...roleConfig.values()]
}

export function scopeTypeOf(roleKey: string): ScopeType {
  const config = roleConfig.get(roleKey)
  if (config?.scopeType) return config.scopeType
  return BUILTIN_SCOPE[roleKey] || 'region'
}

export function permissionLabel(permission: string) {
  return PERMISSION_LABELS.get(permission) || permission
}

export function defaultPermissions(roleKey: string): string[] {
  return PERMISSION_MATRIX.flatMap((module) =>
    module.actions
      .filter((action) => action.roles.includes(roleKey as RoleKey))
      .map((action) => `${module.key}.${action.key}`),
  )
}

export function effectivePermissions(roleKey: string): string[] {
  if (roleKey === 'owner') return [...ALL_PERMISSIONS]
  const config = roleConfig.get(roleKey)
  if (config?.permissions?.length) return [...config.permissions]
  return defaultPermissions(roleKey)
}

export function hasPermission(
  actor: { key: string } | null | undefined,
  permission: string,
): boolean {
  if (!actor?.key) return false
  if (actor.key === 'owner') return true
  return effectivePermissions(actor.key).includes(permission)
}

export function ensurePermission(
  actor: { key: string; label?: string } | null | undefined,
  permission: string,
  action: string,
) {
  if (!hasPermission(actor, permission)) {
    throw new ForbiddenException(`当前角色无权${action}`)
  }
}

export function isKnownPermission(permission: string) {
  return PERMISSION_LABELS.has(permission)
}
