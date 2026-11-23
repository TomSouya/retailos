import { ref } from 'vue'
import { defineStore } from 'pinia'
import { USE_REMOTE_API } from '@/api/config'
import {
  createSystemRole,
  createSystemUser,
  deleteSystemRole,
  fetchSystemRoles,
  fetchSystemUsers,
  resetSystemUserPassword,
  updateSystemRole,
  updateSystemUser,
} from '@/api/client'
import { ROLE_LIST, ROLE_PROFILES } from '@/stores/auth'

const isRemote = USE_REMOTE_API

function buildMockUsers() {
  return ROLE_LIST.map((role, index) => ({
    id: `mock-${role.key}`,
    username: {
      owner: 'owner',
      regional_manager: 'regional',
      store_manager: 'store',
      warehouse: 'warehouse',
    }[role.key],
    name: role.name,
    roleKey: role.key,
    roleName: role.label,
    region: role.region,
    storeId: role.storeId || '',
    scope: role.scope,
    status: 'active',
    lastLoginAt: '',
    createdAt: '2026-11-01 09:00',
    mockIndex: index,
  }))
}

export const useSystemStore = defineStore('system', () => {
  const users = ref(isRemote ? [] : buildMockUsers())
  const roles = ref(
    isRemote
      ? []
      : ROLE_LIST.map((role) => ({
          key: role.key,
          name: role.label,
          builtin: true,
          scopeType:
            role.key === 'owner'
              ? 'global'
              : role.key === 'store_manager'
                ? 'store'
                : 'region',
          description: role.description || '',
          permissions: [],
          userCount: 1,
        })),
  )
  const matrix = ref([])
  const scopeTypes = ref([])
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  async function loadRoles() {
    if (!isRemote) return roles.value
    const rolePayload = await fetchSystemRoles()
    roles.value = rolePayload.roles || []
    matrix.value = rolePayload.matrix || []
    scopeTypes.value = rolePayload.scopeTypes || []
    return roles.value
  }

  async function refresh() {
    if (!isRemote) return users.value
    loading.value = true
    error.value = ''
    try {
      const [nextUsers, rolePayload] = await Promise.all([
        fetchSystemUsers(),
        fetchSystemRoles(),
      ])
      users.value = nextUsers
      roles.value = rolePayload.roles || []
      matrix.value = rolePayload.matrix || []
      scopeTypes.value = rolePayload.scopeTypes || []
      return users.value
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  async function createRole(payload) {
    if (!isRemote) return null
    const record = await createSystemRole(payload)
    await loadRoles()
    return record
  }

  async function updateRole(key, payload) {
    if (!isRemote) return null
    const record = await updateSystemRole(key, payload)
    await loadRoles()
    return record
  }

  async function deleteRole(key) {
    if (!isRemote) return null
    const result = await deleteSystemRole(key)
    await loadRoles()
    return result
  }

  async function updateUser(id, payload) {
    if (isRemote) {
      const record = await updateSystemUser(id, payload)
      const index = users.value.findIndex((item) => item.id === id)
      if (index >= 0) users.value[index] = record
      return record
    }
    const target = users.value.find((item) => item.id === id)
    if (!target) return null
    if (payload.roleKey) {
      target.roleKey = payload.roleKey
      target.roleName = ROLE_PROFILES[payload.roleKey]?.label || payload.roleKey
    }
    if (payload.status) target.status = payload.status
    return target
  }

  async function createUser(payload) {
    if (isRemote) {
      const record = await createSystemUser(payload)
      users.value.push(record)
      return record
    }
    const role = ROLE_PROFILES[payload.roleKey]
    const record = {
      id: `mock-${Date.now()}`,
      username: payload.username,
      name: payload.name,
      roleKey: payload.roleKey,
      roleName: role?.label || payload.roleKey,
      region: payload.region || '全国',
      storeId: payload.storeId || '',
      scope: payload.region || '演示范围',
      status: 'active',
      lastLoginAt: '',
      createdAt: '刚刚',
    }
    users.value.push(record)
    return record
  }

  async function resetPassword(id, password) {
    if (isRemote) return resetSystemUserPassword(id, password)
    return { id, username: users.value.find((user) => user.id === id)?.username }
  }

  return {
    users,
    roles,
    matrix,
    scopeTypes,
    loading,
    error,
    remote,
    refresh,
    loadRoles,
    createRole,
    updateRole,
    deleteRole,
    updateUser,
    createUser,
    resetPassword,
  }
})
