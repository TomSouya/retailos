import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { USE_REMOTE_API } from '@/api/config'
import { loginRequest, setAuthToken } from '@/api/client'

const ROLE_STORAGE_KEY = 'retailos.auth.role'
const SESSION_STORAGE_KEY = 'retailos.auth.session'

export const DEMO_PASSWORD = 'retailos123'

const DEMO_USERNAMES = {
  owner: 'owner',
  regional_manager: 'regional',
  store_manager: 'store',
  warehouse: 'warehouse',
}

export const ROLE_PROFILES = {
  owner: {
    key: 'owner',
    label: '企业老板',
    shortLabel: '老板',
    name: '陈星',
    initials: '陈',
    scope: '全国 50 家门店',
    region: '全国',
    storeId: null,
    description: '全局经营数据、跨区域对比与关键审批',
  },
  regional_manager: {
    key: 'regional_manager',
    label: '区域经理',
    shortLabel: '区域',
    name: '林悦',
    initials: '林',
    scope: '华东区 · 12 家门店',
    region: '华东',
    storeId: null,
    description: '区域经营、门店异常与补货审批',
  },
  store_manager: {
    key: 'store_manager',
    label: '店长',
    shortLabel: '店长',
    name: '周然',
    initials: '周',
    scope: '星辰生活 · 静安店',
    region: '华东',
    storeId: 'S001',
    description: '本店经营、库存预警与补货发起',
  },
  warehouse: {
    key: 'warehouse',
    label: '仓库管理员',
    shortLabel: '仓库',
    name: '顾岩',
    initials: '顾',
    scope: '华东中心仓',
    region: '华东',
    storeId: null,
    description: '库存、出入库与采购到货验收',
  },
}

export const ROLE_LIST = Object.values(ROLE_PROFILES)

export const ROLE_ACCESS = {
  owner: [
    '/dashboard',
    '/inventory',
    '/orders',
    '/products',
    '/procurement',
    '/stores',
    '/members',
    '/system',
    '/audit',
  ],
  regional_manager: [
    '/dashboard',
    '/inventory',
    '/orders',
    '/products',
    '/procurement',
    '/stores',
    '/members',
  ],
  store_manager: ['/dashboard', '/inventory', '/orders', '/products', '/members'],
  warehouse: ['/inventory', '/procurement'],
}

export const ROUTE_PERMISSIONS = {
  '/dashboard': 'dashboard.read',
  '/inventory': 'inventory.read',
  '/orders': 'orders.read',
  '/products': 'products.read',
  '/procurement': 'procurement.read',
  '/stores': 'stores.read',
  '/members': 'members.read',
  '/system': 'system.accounts',
  '/audit': 'system.audit',
}

const HOME_ORDER = [
  '/dashboard',
  '/inventory',
  '/orders',
  '/products',
  '/procurement',
  '/stores',
  '/members',
  '/system',
  '/audit',
]

function permissionsFromAccess(roleKey) {
  return (ROLE_ACCESS[roleKey] || [])
    .map((path) => ROUTE_PERMISSIONS[path])
    .filter(Boolean)
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = loadSession()
  const savedRole = localStorage.getItem(ROLE_STORAGE_KEY)
  const savedRoleKey = session?.user?.key || savedRole || ''

  const roleKey = ref(savedRoleKey || '')
  const token = ref(session?.token || '')
  const remoteUser = ref(session?.user || null)

  if (token.value) {
    setAuthToken(token.value)
  }

  const user = computed(() => {
    if (remoteUser.value) {
      const profile = ROLE_PROFILES[remoteUser.value.key]
      return {
        ...profile,
        ...remoteUser.value,
        label: remoteUser.value.label || profile?.label || remoteUser.value.key,
        initials:
          remoteUser.value.initials ||
          remoteUser.value.name?.slice(0, 1) ||
          '?',
        shortLabel:
          profile?.shortLabel ||
          remoteUser.value.shortLabel ||
          remoteUser.value.label ||
          remoteUser.value.key,
        description: profile?.description || remoteUser.value.description || '',
      }
    }
    return ROLE_PROFILES[roleKey.value] || null
  })

  const permissions = computed(() => {
    if (remoteUser.value?.permissions?.length) {
      return remoteUser.value.permissions
    }
    if (remoteUser.value && roleKey.value === 'owner') {
      return Object.values(ROUTE_PERMISSIONS)
    }
    return permissionsFromAccess(roleKey.value)
  })

  function can(permission) {
    if (!permission) return true
    if (roleKey.value === 'owner') return true
    return permissions.value.includes(permission)
  }

  function canRoute(path) {
    return can(ROUTE_PERMISSIONS[path])
  }

  const homePath = computed(
    () => HOME_ORDER.find((path) => canRoute(path)) || '/login',
  )

  const isAuthenticated = computed(() =>
    USE_REMOTE_API
      ? Boolean(token.value && remoteUser.value)
      : Boolean(user.value),
  )

  function applySession(data) {
    token.value = data.token
    remoteUser.value = data.user
    roleKey.value = data.user.key
    setAuthToken(data.token)
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: data.token, user: data.user }),
    )
    localStorage.setItem(ROLE_STORAGE_KEY, roleKey.value)
  }

  async function login(nextRole) {
    const profile = ROLE_PROFILES[nextRole]
    if (!profile) return false

    if (USE_REMOTE_API) {
      applySession(
        await loginRequest(DEMO_USERNAMES[nextRole], DEMO_PASSWORD),
      )
    } else {
      roleKey.value = nextRole
      token.value = ''
      remoteUser.value = null
      setAuthToken('')
      localStorage.removeItem(SESSION_STORAGE_KEY)
    }

    localStorage.setItem(ROLE_STORAGE_KEY, roleKey.value)
    return true
  }

  async function loginWithCredentials(username, password) {
    const nextUsername = String(username || '').trim()
    if (!nextUsername || !password) return false
    applySession(await loginRequest(nextUsername, password))
    return true
  }

  function logout() {
    roleKey.value = ''
    token.value = ''
    remoteUser.value = null
    setAuthToken('')
    localStorage.removeItem(ROLE_STORAGE_KEY)
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }

  return {
    roleKey,
    token,
    user,
    permissions,
    homePath,
    can,
    canRoute,
    isAuthenticated,
    login,
    loginWithCredentials,
    logout,
  }
})
