<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import { Download, Search } from '@element-plus/icons-vue'
import { downloadCsv } from '@/api/client'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useAuditStore } from '@/stores/audit'
import { statusLabel, statusTone } from '@/utils/format'

const audit = useAuditStore()

const keyword = ref('')
const resultFilter = ref('all')
const exporting = ref(false)

onMounted(async () => {
  if (!audit.remote) return
  try {
    await audit.refresh()
  } catch (error) {
    ElMessage.error(`审计日志加载失败：${error.message}`)
  }
})

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return audit.records.filter((record) => {
    const matchesResult = resultFilter.value === 'all' || record.result === resultFilter.value
    if (!matchesResult) return false
    if (!text) return true
    return (
      record.actor.toLowerCase().includes(text) ||
      record.action.toLowerCase().includes(text) ||
      record.object.toLowerCase().includes(text) ||
      record.id.toLowerCase().includes(text) ||
      String(record.traceId || '').toLowerCase().includes(text)
    )
  })
})

const summary = computed(() => ({
  total: audit.records.length,
  approvals: audit.records.filter((record) => record.action.includes('审批')).length,
  today: audit.records.filter((record) => record.timestamp.startsWith('2026-11-21')).length,
}))

const {
  page,
  pageSize,
  paged: pagedRecords,
} = usePagination(filtered, {
  resetOn: [keyword, resultFilter],
})

function exportData() {
  if (!audit.remote) {
    ElMessage.warning('演示模式暂不支持服务端导出')
    return
  }
  exporting.value = true
  downloadCsv('/api/exports/audit', 'retailos-audit.csv')
    .then((filename) => ElMessage.success(`已导出 ${filename}`))
    .catch((error) => ElMessage.error(`导出失败：${error.message}`))
    .finally(() => {
      exporting.value = false
    })
}
</script>

<template>
  <div class="page audit-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">审计日志</h1>
        <p class="page-subtitle">
          关键操作、审批与工具调用的追加记录 · 只读
        </p>
      </div>
      <div class="page-head-actions">
        <span class="pill is-accent">只读</span>
        <el-button
          :icon="Download"
          :loading="exporting"
          @click="exportData"
        >
          导出
        </el-button>
      </div>
    </div>

    <div class="audit-summary">
      <div>
        <span>总记录</span>
        <strong class="tabular">{{ summary.total }}</strong>
      </div>
      <div>
        <span>审批相关</span>
        <strong class="tabular">{{ summary.approvals }}</strong>
      </div>
      <div>
        <span>今日新增</span>
        <strong class="tabular">{{ summary.today }}</strong>
      </div>
      <div class="audit-note">
        <span class="dot is-success"></span>
        关键操作记录操作人、时间与结果
      </div>
    </div>

    <section class="card audit-card" v-loading="audit.loading">
      <div class="filter-row">
        <el-input
          v-model="keyword"
          class="audit-search"
          placeholder="搜索操作人、动作、对象、编号或 Trace ID"
          :prefix-icon="Search"
          clearable
        />
        <el-select v-model="resultFilter" class="result-select">
          <el-option label="全部结果" value="all" />
          <el-option label="成功 / 通过" value="approved" />
          <el-option label="已提交" value="submitted" />
          <el-option label="失败 / 驳回" value="rejected" />
        </el-select>
      </div>

      <el-table v-if="filtered.length" :data="pagedRecords" size="default">
        <el-table-column prop="timestamp" label="时间" width="168" />
        <el-table-column prop="actor" label="操作人" width="92" />
        <el-table-column prop="role" label="角色" width="104" />
        <el-table-column prop="action" label="动作" min-width="168" />
        <el-table-column
          prop="object"
          label="对象"
          min-width="176"
          show-overflow-tooltip
        />
        <el-table-column label="结果" width="104">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="statusTone(row.result)">
              {{ statusLabel(row.result) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="approvalId" label="审批编号" width="176" />
        <el-table-column label="Trace" width="150">
          <template #default="{ row }">
            <span class="mono muted trace-text" :title="row.traceId || ''">
              {{ row.traceId || '—' }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else description="没有匹配的审计记录" :image-size="72" />

      <TablePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filtered.length"
      />
    </section>
  </div>
</template>

<style scoped>
.audit-page {
  animation: rise-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.audit-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 132px)) minmax(260px, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}

.audit-summary > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 13px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.audit-summary span {
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 600;
}

.audit-summary strong {
  color: var(--ink);
  font-family: var(--display);
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.audit-summary .audit-note {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
}

.audit-note .dot {
  box-shadow: none;
}

.trace-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-card {
  padding: 14px 18px 18px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.audit-search {
  width: 320px;
}

.result-select {
  width: 148px;
}

@media (max-width: 900px) {
  .audit-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .audit-summary .audit-note {
    grid-column: 1 / -1;
  }

  .audit-search {
    width: 100%;
  }

  .filter-row {
    align-items: stretch;
    flex-direction: column;
  }

  .result-select {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .audit-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
