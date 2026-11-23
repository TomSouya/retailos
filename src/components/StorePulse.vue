<script setup>
import { computed } from 'vue'
import { formatCurrency, statusLabel } from '@/utils/format'

const props = defineProps({
  items: { type: Array, default: () => [] },
  embedded: { type: Boolean, default: false },
})

const counts = computed(() => ({
  total: props.items.length,
  normal: props.items.filter((item) => item.status === 'normal').length,
  warning: props.items.filter((item) => item.status === 'warning').length,
  danger: props.items.filter((item) => item.status === 'danger').length,
}))

const ariaLabel = computed(
  () =>
    `门店脉搏：共 ${counts.value.total} 家，正常 ${counts.value.normal} 家，预警 ${counts.value.warning} 家，高风险 ${counts.value.danger} 家`,
)

function opacity(item) {
  return 0.45 + ((Number(item.sales) || 0) % 55) / 100
}
</script>

<template>
  <section class="pulse" :class="{ 'is-embedded': embedded }" aria-label="门店脉搏">
    <div class="pulse-head">
      <div class="pulse-title-wrap">
        <span class="section-label">门店脉搏</span>
        <span class="pulse-summary">
          {{ counts.total }} 家门店 · {{ counts.normal }} 正常 · {{ counts.warning }} 预警
        </span>
      </div>
      <div class="pulse-legend" aria-hidden="true">
        <span><i class="dot is-success"></i>正常</span>
        <span><i class="dot is-warning"></i>预警</span>
        <span><i class="dot is-danger"></i>高风险</span>
        <span><i class="dot"></i>离线</span>
      </div>
    </div>

    <div class="pulse-grid" role="img" :aria-label="ariaLabel">
      <span
        v-for="item in items"
        :key="item.id"
        class="pulse-tick"
        :class="`is-${item.status}`"
        :style="{ opacity: opacity(item) }"
        :title="`${item.name} · ${statusLabel(item.status)} · ${formatCurrency(item.sales)}`"
      ></span>
    </div>
  </section>
</template>

<style scoped>
.pulse {
  padding: 16px 18px 15px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.pulse.is-embedded {
  border: 0;
  border-radius: 0;
  background: transparent;
}

.pulse.is-embedded .pulse-grid {
  gap: 4px;
}

.pulse-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.pulse-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

.pulse-summary {
  color: var(--muted);
  font-size: 11.5px;
  white-space: nowrap;
}

.pulse-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  font-size: 10.5px;
  white-space: nowrap;
}

.pulse-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.pulse-legend .dot {
  width: 6px;
  height: 6px;
  box-shadow: none;
}

.pulse-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.pulse-tick {
  width: 8px;
  height: 24px;
  border-radius: 2px;
  background: var(--line-strong);
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}

.pulse-tick:hover {
  transform: scaleY(1.16);
  opacity: 1 !important;
}

.pulse-tick.is-success {
  background: var(--success);
}

.pulse-tick.is-warning {
  background: var(--warning);
}

.pulse-tick.is-danger {
  background: var(--danger);
}

.pulse-tick.is-offline {
  background: var(--faint);
}

@media (max-width: 768px) {
  .pulse-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .pulse-legend {
    flex-wrap: wrap;
    gap: 8px;
  }

  .pulse-tick {
    width: 6px;
    height: 22px;
  }
}
</style>
