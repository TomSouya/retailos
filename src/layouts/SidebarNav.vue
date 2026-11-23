<script setup>
import { computed, markRaw, onMounted, onUnmounted, ref } from 'vue'
import {
  Box,
  DataLine,
  Document,
  Goods,
  Setting,
  Shop,
  ShoppingCart,
  Tickets,
  User,
} from '@element-plus/icons-vue'
import AppLogo from '@/components/AppLogo.vue'
import { fetchHealth } from '@/api/client'
import { USE_REMOTE_API } from '@/api/config'
import { useAuthStore } from '@/stores/auth'

defineEmits(['navigate'])

const auth = useAuthStore()

const healthState = ref(USE_REMOTE_API ? 'checking' : 'local')
const databaseState = ref('')
let healthTimer = null

const statusLabel = computed(
  () =>
    ({
      checking: '正在检查服务',
      ok: '服务正常',
      error: '服务异常',
      local: '本地演示数据',
    })[healthState.value],
)

const statusDetail = computed(() => {
  if (healthState.value === 'local') return '未连接后端'
  if (healthState.value === 'checking') return '正在读取健康状态'
  return databaseState.value
})

const statusDotClass = computed(() => {
  if (healthState.value === 'ok') return 'is-success'
  if (healthState.value === 'error') return 'is-danger'
  return ''
})

async function checkHealth() {
  if (!USE_REMOTE_API) {
    healthState.value = 'local'
    return
  }
  try {
    const health = await fetchHealth()
    healthState.value =
      health.ok && health.db === 'up' ? 'ok' : 'error'
    databaseState.value =
      health.db === 'up' ? '数据库正常' : '数据库连接异常'
  } catch {
    healthState.value = 'error'
    databaseState.value = '无法连接后端服务'
  }
}

onMounted(() => {
  checkHealth()
  healthTimer = window.setInterval(checkHealth, 60000)
})

onUnmounted(() => {
  if (healthTimer) window.clearInterval(healthTimer)
})

const navGroups = [
  {
    section: '经营',
    items: [
      { path: '/dashboard', label: '经营驾驶舱', icon: markRaw(DataLine) },
      { path: '/inventory', label: '库存管理', icon: markRaw(Box) },
      { path: '/orders', label: '订单管理', icon: markRaw(Tickets) },
    ],
  },
  {
    section: '商品与供应链',
    items: [
      { path: '/products', label: '商品管理', icon: markRaw(Goods) },
      { path: '/procurement', label: '采购管理', icon: markRaw(ShoppingCart) },
      { path: '/stores', label: '门店管理', icon: markRaw(Shop) },
    ],
  },
  {
    section: '客户与系统',
    items: [
      { path: '/members', label: '会员管理', icon: markRaw(User) },
      { path: '/system', label: '系统管理', icon: markRaw(Setting) },
      { path: '/audit', label: '审计日志', icon: markRaw(Document) },
    ],
  },
]

const visibleGroups = computed(() =>
  navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => auth.canRoute(item.path)),
    }))
    .filter((group) => group.items.length > 0),
)
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <AppLogo tone="light" />
    </div>

    <nav class="sidebar-nav">
      <div v-for="group in visibleGroups" :key="group.section" class="nav-group">
        <div class="nav-section">{{ group.section }}</div>
        <router-link
          v-for="item in group.items"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          @click="$emit('navigate')"
        >
          <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

    <div class="sidebar-foot">
      <div class="sidebar-note" aria-live="polite">
        <span class="dot" :class="statusDotClass"></span>
        <div>
          <strong>{{ statusLabel }}</strong>
          <span>{{ statusDetail }}</span>
        </div>
      </div>
      <div class="sidebar-scope">
        数据范围 · {{ auth.user?.scope }}
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 236px;
  height: 100vh;
  min-height: 100vh;
  padding: 18px 12px 14px;
  overflow: hidden;
  background: var(--graphite);
  color: #f5f7fa;
}

.sidebar-brand {
  padding: 2px 8px 20px;
}

.sidebar-nav {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-section {
  padding: 0 10px 6px;
  color: rgba(245, 247, 250, 0.46);
  font-family: var(--sans);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 10px;
  border-radius: 8px;
  color: rgba(245, 247, 250, 0.66);
  font-size: 13px;
  font-weight: 500;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.nav-item.router-link-active {
  background: rgba(43, 78, 219, 0.18);
  color: #ffffff;
}

.nav-item.router-link-active::before {
  position: absolute;
  top: 9px;
  bottom: 9px;
  left: 0;
  width: 2px;
  border-radius: 2px;
  background: #6e8aff;
  content: '';
}

.nav-icon {
  color: rgba(245, 247, 250, 0.4);
  font-size: 15px;
}

.nav-item.router-link-active .nav-icon,
.nav-item:hover .nav-icon {
  color: #8ea4ff;
}

.nav-label {
  line-height: 1;
}

.sidebar-foot {
  margin-top: 16px;
  padding: 12px 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.sidebar-note .dot {
  margin-top: 5px;
  box-shadow: none;
}

.sidebar-note div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-note strong {
  color: rgba(245, 247, 250, 0.78);
  font-size: 10.5px;
  font-weight: 600;
}

.sidebar-note span {
  color: rgba(245, 247, 250, 0.46);
  font-size: 10px;
}

.sidebar-scope {
  margin-top: 10px;
  overflow: hidden;
  color: rgba(245, 247, 250, 0.4);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
