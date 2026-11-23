<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus/es/components/message/index'
import AppLogo from '@/components/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { company, storePulse } from '@/mocks/data'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const loggingIn = ref(false)
const pulsePreview = storePulse.slice(0, 30)

const accountForm = reactive({ username: '', password: '' })

onMounted(() => {
  if (auth.isAuthenticated) {
    router.replace(auth.homePath)
  }
})

async function submitLogin() {
  if (loggingIn.value) return
  const username = accountForm.username.trim()
  if (!username || !accountForm.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loggingIn.value = true
  try {
    await auth.loginWithCredentials(username, accountForm.password)
    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.replace(redirect || auth.homePath)
  } catch (error) {
    ElMessage.error(`登录失败：${error.message}`)
  } finally {
    loggingIn.value = false
  }
}
</script>

<template>
  <div class="login-shell">
    <section class="login-brand">
      <div class="brand-top">
        <AppLogo tone="light" :size="38" />
      </div>

      <div class="brand-main">
        <h1>把 50 家门店，<br />装进一张经营桌面。</h1>
        <p>
          从总部驾驶舱到门店补货，把分散的销售、库存与审批收拢到同一条数据链路上。
        </p>

        <div class="brand-pulse" aria-hidden="true">
          <span
            v-for="item in pulsePreview"
            :key="item.id"
            class="brand-tick"
            :class="`is-${item.status}`"
            :style="{ opacity: 0.4 + ((item.sales % 55) / 100) }"
          ></span>
        </div>
      </div>

      <div class="brand-stats">
        <div>
          <strong>{{ company.stores }}</strong>
          <span>家门店</span>
        </div>
        <div>
          <strong>{{ company.modules }}</strong>
          <span>个业务模块</span>
        </div>
        <div>
          <strong>20</strong>
          <span>个 Agent 工具</span>
        </div>
      </div>

      <div class="brand-foot">
        <span class="dot is-success"></span>
        数据接入正常 · 最近同步 10:42
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div class="login-head">
          <h2>登录工作台</h2>
          <p>使用企业账号登录，系统会按角色返回对应的数据范围与操作权限。</p>
        </div>

        <el-form class="login-form" label-position="top" @submit.prevent>
          <el-form-item label="用户名">
            <el-input
              v-model="accountForm.username"
              class="login-username"
              size="large"
              placeholder="请输入用户名"
              autocomplete="username"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="accountForm.password"
              class="login-password"
              size="large"
              type="password"
              show-password
              placeholder="请输入密码"
              autocomplete="current-password"
              @keyup.enter="submitLogin"
            />
          </el-form-item>
          <el-button
            type="primary"
            class="login-submit enter-btn"
            size="large"
            :loading="loggingIn"
            @click="submitLogin"
          >
            登录
          </el-button>
        </el-form>

        <p class="login-note">
          账号由企业管理员在「系统管理」中创建并分配角色
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
  background: var(--paper);
}

.login-brand {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  padding: 36px 48px 32px;
  overflow: hidden;
  background:
    radial-gradient(circle at 84% 12%, rgba(43, 78, 219, 0.28), transparent 36%),
    radial-gradient(circle at 8% 88%, rgba(43, 78, 219, 0.12), transparent 32%),
    var(--graphite);
  color: #f5f7fa;
}

.login-brand::before {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.75), transparent 78%);
  content: '';
}

.login-brand::after {
  position: absolute;
  right: -90px;
  bottom: -120px;
  width: 380px;
  height: 380px;
  border: 1px solid rgba(110, 138, 255, 0.2);
  border-radius: 50%;
  content: '';
}

.brand-top,
.brand-main,
.brand-stats,
.brand-foot {
  position: relative;
  z-index: 1;
}

.brand-main h1 {
  max-width: 620px;
  font-size: clamp(34px, 4vw, 52px);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.12;
}

.brand-main p {
  max-width: 430px;
  margin-top: 18px;
  color: rgba(245, 247, 250, 0.56);
  font-size: 14px;
  line-height: 1.85;
}

.brand-pulse {
  display: flex;
  max-width: 470px;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 34px;
}

.brand-tick {
  width: 7px;
  height: 24px;
  border-radius: 2px;
  background: rgba(245, 247, 250, 0.18);
}

.brand-tick.is-success {
  background: #2bbf8a;
}

.brand-tick.is-warning {
  background: #e0a33a;
}

.brand-tick.is-danger {
  background: #e0684f;
}

.brand-tick.is-offline {
  background: rgba(245, 247, 250, 0.24);
}

.brand-stats {
  display: flex;
  gap: 44px;
  padding-top: 26px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.brand-stats div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-stats strong {
  font-family: var(--display);
  font-size: 30px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1;
}

.brand-stats span {
  color: rgba(245, 247, 250, 0.42);
  font-size: 10.5px;
}

.brand-foot {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 24px;
  color: rgba(245, 247, 250, 0.4);
  font-size: 10.5px;
}

.brand-foot .dot {
  box-shadow: none;
}

.login-panel {
  display: grid;
  min-height: 100vh;
  padding: 40px;
  background: var(--surface);
  place-items: center;
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.login-head h2 {
  color: var(--ink);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.login-head p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 26px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.login-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 600;
}

.login-submit {
  width: 100%;
  height: 44px;
  margin-top: 4px;
}

.enter-btn {
  width: 100%;
  margin-top: 16px;
  height: 42px;
}

.login-note {
  margin-top: 13px;
  color: var(--faint);
  font-size: 10px;
  text-align: center;
}

@media (max-width: 980px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-brand {
    min-height: auto;
    padding: 28px 24px 30px;
  }

  .brand-main h1 {
    font-size: 38px;
  }

  .brand-main p {
    margin-top: 14px;
  }

  .brand-pulse {
    margin-top: 22px;
  }

  .brand-stats {
    margin-top: 26px;
    padding-top: 20px;
  }

  .brand-foot {
    display: none;
  }

  .login-panel {
    min-height: auto;
    padding: 30px 20px 46px;
  }
}

@media (max-width: 560px) {
  .brand-stats {
    gap: 28px;
  }

  .brand-stats strong {
    font-size: 23px;
  }
}
</style>
