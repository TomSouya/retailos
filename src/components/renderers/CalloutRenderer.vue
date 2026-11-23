<script setup>
import { computed } from 'vue'
import { CircleCheck, InfoFilled, WarningFilled } from '@element-plus/icons-vue'

const props = defineProps({
  tone: { type: String, default: 'info' },
  title: { type: String, default: '' },
  text: { type: String, default: '' },
})

const icon = computed(() => {
  if (props.tone === 'warning' || props.tone === 'danger') return WarningFilled
  if (props.tone === 'success') return CircleCheck
  return InfoFilled
})
</script>

<template>
  <div class="callout" :class="`is-${tone}`">
    <el-icon class="callout-icon"><component :is="icon" /></el-icon>
    <div>
      <div v-if="title" class="callout-title">{{ title }}</div>
      <p class="callout-text">{{ text }}</p>
    </div>
  </div>
</template>

<style scoped>
.callout {
  display: flex;
  gap: 9px;
  margin-top: 10px;
  padding: 10px 11px;
  border-left: 2px solid var(--info);
  border-radius: 0 9px 9px 0;
  background: var(--info-soft);
}

.callout.is-warning {
  border-left-color: var(--warning);
  background: var(--warning-soft);
}

.callout.is-danger {
  border-left-color: var(--danger);
  background: var(--danger-soft);
}

.callout.is-success {
  border-left-color: var(--success);
  background: var(--success-soft);
}

.callout-icon {
  margin-top: 1px;
  color: var(--info);
  font-size: 13px;
  flex: none;
}

.is-warning .callout-icon {
  color: var(--warning);
}

.is-danger .callout-icon {
  color: var(--danger);
}

.is-success .callout-icon {
  color: var(--success);
}

.callout-title {
  color: var(--text);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.45;
}

.callout-text {
  margin-top: 2px;
  color: var(--text-soft);
  font-size: 10.5px;
  line-height: 1.65;
}
</style>
