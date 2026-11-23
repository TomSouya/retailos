<script setup>
import { formatCurrency, formatDelta, formatNumber, statusLabel, statusTone } from '@/utils/format'

defineProps({
  title: { type: String, default: '' },
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  maxHeight: { type: Number, default: 240 },
})

function cellText(row, column) {
  const value = row[column.key]
  if (column.format === 'currency') return formatCurrency(value)
  if (column.format === 'currency1') return formatCurrency(value, 1)
  if (column.format === 'number') return formatNumber(value)
  return value
}

function deltaClass(value) {
  return Number(value) < 0 ? 'is-down' : 'is-up'
}
</script>

<template>
  <div class="table-renderer">
    <div v-if="title" class="table-title">{{ title }}</div>
    <el-table
      v-if="rows.length"
      :data="rows"
      size="small"
      :max-height="maxHeight"
      table-layout="fixed"
    >
      <el-table-column
        v-for="column in columns"
        :key="column.key"
        :prop="column.key"
        :label="column.label"
        :width="column.width"
        :min-width="column.minWidth"
        :align="column.align || 'left'"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span
            v-if="column.format === 'delta'"
            class="delta mono"
            :class="deltaClass(row[column.key])"
          >
            {{ formatDelta(row[column.key]) }}
          </span>
          <el-tag
            v-else-if="column.format === 'status'"
            size="small"
            effect="light"
            :type="statusTone(row[column.key])"
          >
            {{ statusLabel(row[column.key]) }}
          </el-tag>
          <span v-else class="tabular">{{ cellText(row, column) }}</span>
        </template>
      </el-table-column>
    </el-table>
    <div v-else class="table-empty">暂无数据</div>
  </div>
</template>

<style scoped>
.table-renderer {
  padding-top: 10px;
}

.table-title {
  margin-bottom: 4px;
  color: var(--text);
  font-size: 11.5px;
  font-weight: 650;
}

.delta {
  font-size: 10.5px;
  font-weight: 600;
}

.delta.is-up {
  color: var(--success);
}

.delta.is-down {
  color: var(--danger);
}

.table-empty {
  display: grid;
  height: 88px;
  place-items: center;
  color: var(--faint);
  font-size: 11px;
}

:deep(.el-table) {
  font-size: 11.5px;
}

:deep(.el-table th.el-table__cell) {
  padding: 7px 0;
  font-size: 9px;
}

:deep(.el-table td.el-table__cell) {
  padding: 8px 0;
}

:deep(.el-table .cell) {
  padding: 0 6px;
}
</style>
