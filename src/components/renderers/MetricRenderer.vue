<script setup>
import { formatCurrency, formatNumber } from '@/utils/format'

defineProps({
  items: { type: Array, default: () => [] },
})

function display(item) {
  if (item.format === 'currency') return formatCurrency(item.value)
  if (item.format === 'currency1') return formatCurrency(item.value, 1)
  if (item.format === 'number') return formatNumber(item.value)
  return item.value
}

function deltaClass(item) {
  if (!item.delta) return ''
  if (item.deltaTone === 'good') return 'is-up'
  if (item.deltaTone === 'bad') return 'is-down'
  return String(item.delta).trim().startsWith('-') ? 'is-down' : 'is-up'
}
</script>

<template>
  <div class="metric-grid">
    <div
      v-for="item in items"
      :key="item.label"
      class="metric"
      :class="`tone-${item.tone || 'default'}`"
    >
      <span class="metric-label">{{ item.label }}</span>
      <strong class="metric-value tabular">{{ display(item) }}</strong>
      <span v-if="item.delta" class="metric-delta mono" :class="deltaClass(item)">
        {{ item.delta }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.metric {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 11px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
}

.metric::before {
  position: absolute;
  top: 0;
  left: 11px;
  width: 18px;
  height: 2px;
  background: var(--line-strong);
  content: '';
}

.metric.tone-accent::before {
  background: var(--accent);
}

.metric.tone-success::before {
  background: var(--success);
}

.metric.tone-danger::before {
  background: var(--danger);
}

.metric-label {
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 600;
}

.metric-value {
  color: var(--ink);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.metric-delta {
  font-size: 10px;
  font-weight: 600;
}

.metric-delta.is-up {
  color: var(--success);
}

.metric-delta.is-down {
  color: var(--danger);
}
</style>
