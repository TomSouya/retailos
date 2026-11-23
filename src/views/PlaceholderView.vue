<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const meta = computed(() => route.meta || {})
const icon = computed(() => meta.value.icon || 'Grid')
</script>

<template>
  <div class="page placeholder-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ meta.title }}</h1>
        <p class="page-subtitle">{{ meta.description }}</p>
      </div>
      <div class="page-head-actions">
        <span class="pill is-accent">规划中</span>
        <el-button :icon="ArrowLeft" @click="router.push('/dashboard')">返回驾驶舱</el-button>
      </div>
    </div>

    <section class="card placeholder-card">
      <div class="placeholder-main">
        <div class="placeholder-icon">
          <el-icon><component :is="icon" /></el-icon>
        </div>
        <div>
          <h2>该模块在 {{ meta.phase || 'Phase 2' }} 开放</h2>
          <p>
            Phase 1 先打通「经营驾驶舱 → 库存预警 → 补货审批 → 审计日志」这条垂直链路。
            该模块的接口与页面会复用同一套设计 Token、RBAC 与 Agent 工具层。
          </p>
        </div>
      </div>

      <div class="placeholder-features">
        <div class="section-label">计划中的能力</div>
        <div class="feature-grid">
          <div v-for="(feature, index) in meta.features || []" :key="feature" class="feature">
            <span class="feature-index mono">{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ feature }}</span>
          </div>
        </div>
      </div>

      <div class="placeholder-foot">
        <span class="faint">当前阶段优先验证：组件复用率、Token 遵守率、审批可追溯性。</span>
        <el-button text type="primary" @click="router.push('/inventory')">
          查看库存链路
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.placeholder-page {
  animation: rise-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.placeholder-card {
  padding: 28px;
  overflow: hidden;
}

.placeholder-main {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.placeholder-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--accent);
  color: #ffffff;
  font-size: 21px;
}

.placeholder-main h2 {
  color: var(--ink);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.03em;
}

.placeholder-main p {
  max-width: 640px;
  margin-top: 7px;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.75;
}

.placeholder-features {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
  margin-top: 12px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 12px;
}

.feature-index {
  color: var(--accent-deep);
  font-size: 9.5px;
}

.placeholder-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.placeholder-foot span {
  font-size: 10.5px;
}

@media (max-width: 900px) {
  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .placeholder-foot {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 560px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }

  .placeholder-card {
    padding: 20px;
  }
}
</style>
