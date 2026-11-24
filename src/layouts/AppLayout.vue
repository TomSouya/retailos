<script setup>
import { defineAsyncComponent, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  MagicStick,
  Menu,
} from '@element-plus/icons-vue'
import SidebarNav from './SidebarNav.vue'
const AgentPanel = defineAsyncComponent(
  () => import('@/features/agent/AgentPanel.vue'),
)
import { useAuthStore } from '@/stores/auth'
import { useAgentStore } from '@/stores/agent'

const auth = useAuthStore()
const agent = useAgentStore()
const route = useRoute()
const router = useRouter()

const mobileNavOpen = ref(false)

function handleAccount(command) {
  if (command !== 'logout') return
  auth.logout()
  agent.reset()
  router.push('/login')
}

function openAgent() {
  agent.open({ page: route.name })
}
</script>

<template>
  <div class="app-shell">
    <SidebarNav class="app-sidebar" />

    <el-drawer
      v-model="mobileNavOpen"
      direction="ltr"
      size="280px"
      :with-header="false"
      class="mobile-nav-drawer"
    >
      <SidebarNav @navigate="mobileNavOpen = false" />
    </el-drawer>

    <div class="app-main">
      <header class="topbar">
        <div class="topbar-left">
          <button
            class="icon-btn mobile-menu"
            type="button"
            aria-label="打开导航"
            @click="mobileNavOpen = true"
          >
            <el-icon><Menu /></el-icon>
          </button>

          <div class="crumb">
            <span>{{ route.meta.section || 'RetailOS' }}</span>
            <i>/</i>
            <strong>{{ route.meta.title }}</strong>
          </div>
        </div>

        <div class="topbar-right">
          <button class="ai-trigger" type="button" @click="openAgent">
            <el-icon><MagicStick /></el-icon>
            <span>经营助手</span>
          </button>

          <el-dropdown trigger="click" @command="handleAccount">
            <button class="account-trigger" type="button" aria-label="账户菜单">
              <span class="role-avatar">{{ auth.user?.initials }}</span>
              <span class="role-copy">
                <strong>{{ auth.user?.name }}</strong>
                <small>{{ auth.user?.label }}</small>
              </span>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  {{ auth.user?.scope }}
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <AgentPanel v-if="agent.panelOpen" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--paper);
}

.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  flex: none;
  align-self: flex-start;
}

.app-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  height: 64px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(14px);
}

.topbar-left {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.crumb {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.crumb i {
  color: var(--line-strong);
  font-style: normal;
}

.crumb strong {
  overflow: hidden;
  color: var(--ink);
  font-weight: 650;
  text-overflow: ellipsis;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 9px;
}

.search-box {
  display: none;
}

.ai-trigger {
  display: inline-flex;
  height: 34px;
  align-items: center;
  gap: 6px;
  padding: 0 13px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--accent);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.ai-trigger:hover {
  border-color: var(--accent-deep);
  background: var(--accent-deep);
  transform: translateY(-1px);
}

.ai-trigger .el-icon {
  color: #ffffff;
  font-size: 14px;
}

.account-trigger {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 3px 9px 3px 4px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
  text-align: left;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.account-trigger:hover {
  border-color: var(--line-strong);
  background: var(--surface-2);
}

.role-avatar {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 7px;
  background: var(--accent);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}

.role-copy {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.role-copy strong {
  font-size: 12px;
  font-weight: 650;
  line-height: 1.25;
}

.role-copy small {
  max-width: 132px;
  overflow: hidden;
  color: var(--faint);
  font-size: 10.5px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--muted);
  transition:
    color 0.16s ease,
    border-color 0.16s ease;
}

.icon-btn:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}

.mobile-menu {
  display: none;
}

.avatar-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-deep);
  font-size: 11px;
  font-weight: 700;
}

.app-content {
  flex: 1;
  min-width: 0;
}

:deep(.el-badge__content.is-dot) {
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border: 1px solid var(--surface);
  background: var(--danger);
}

@media (max-width: 1024px) {
  .app-sidebar {
    display: none;
  }

  .mobile-menu {
    display: grid;
  }

  .topbar {
    padding: 0 18px;
  }
}

@media (max-width: 860px) {
  .role-copy {
    display: none;
  }

  .account-trigger {
    padding-right: 6px;
  }
}

@media (max-width: 640px) {
  .topbar {
    height: 62px;
    gap: 8px;
    padding: 0 14px;
  }

  .topbar-right {
    min-width: 0;
    gap: 6px;
  }

  .crumb {
    min-width: 0;
  }

  .crumb span,
  .crumb i {
    display: none;
  }

  .crumb strong {
    max-width: 126px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .account-trigger,
  .topbar-right > .icon-btn {
    display: none;
  }

  .ai-trigger {
    width: 34px;
    padding: 0;
    justify-content: center;
  }

  .ai-trigger span {
    display: none;
  }

  .icon-btn,
  .avatar-btn {
    width: 32px;
    height: 32px;
  }
}
</style>
