<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index'
import {
  ArrowRight,
  Download,
  MagicStick,
  Refresh,
} from '@element-plus/icons-vue'
import StorePulse from '@/components/StorePulse.vue'

const BaseChart = defineAsyncComponent(
  () => import('@/components/BaseChart.vue'),
)
import { downloadCsv } from '@/api/client'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import {
  formatCompact,
  formatCurrency,
  formatDateTime,
  formatDelta,
  formatNumber,
  formatPercent,
  statusLabel,
  statusTone,
} from '@/utils/format'

const auth = useAuthStore()
const agent = useAgentStore()
const dashboard = useDashboardStore()

const ranges = [
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]

const range = ref('week')
const lastUpdated = ref(new Date())
const exporting = ref(false)

const kpis = computed(() => dashboard.data?.kpis || {})
const trend = computed(
  () => dashboard.data?.trend || { labels: [], sales: [] },
)
const ranking = computed(() => dashboard.data?.ranking || [])
const anomalies = computed(() => dashboard.data?.anomalies || [])
const topProducts = computed(() => dashboard.data?.topProducts || [])
const operations = computed(() => dashboard.data?.operations || {})
const efficiency = computed(() => {
  const current = operations.value
  const turnover = current.turnoverDays
  return [
    {
      label: '毛利额',
      value: formatCurrency(current.grossProfit ?? 0),
      hint: `毛利率 ${formatPercent(kpis.value.grossMargin ?? 0)}`,
      tone: 'accent',
    },
    {
      label: '库存成本',
      value: formatCurrency(current.inventoryValue ?? 0),
      hint: '按成本价估值',
      tone: 'default',
    },
    {
      label: '库存周转',
      value:
        turnover === null || turnover === undefined
          ? '—'
          : `${formatNumber(turnover, 1)} 天`,
      hint: `${rangeLabel.value}销售成本口径`,
      tone: 'default',
    },
    {
      label: '售罄率',
      value: formatPercent(current.sellThrough ?? 0),
      hint: `净销量 ${formatNumber(current.unitsSold)} · 期末库存 ${formatNumber(current.unitsStock)}`,
      tone: 'success',
    },
  ]
})
const storePulseItems = computed(() => dashboard.data?.storePulse || [])
const rangeLabel = computed(
  () => ranges.find((item) => item.value === range.value)?.label || '本周',
)
const lastUpdatedText = computed(
  () =>
    dashboard.data?.updatedAt || formatDateTime(lastUpdated.value),
)
const scopeLabel = computed(() =>
  auth.user?.key === 'owner' ? '全国' : auth.user?.scope || '当前范围',
)
const insight = computed(() => {
  const first = anomalies.value[0]
  if (first) {
    return `${first.store}：${first.detail}。建议先处理高风险门店，再决定补货。`
  }
  const top = ranking.value[0]
  if (top) {
    return `${top.name}${rangeLabel.value}销售额 ${formatCurrency(top.sales)}，当前排名第一。`
  }
  return '当前范围暂无异常，经营指标平稳。'
})

async function loadDashboard() {
  try {
    await dashboard.load(range.value)
  } catch (error) {
    ElMessage.error(`经营数据加载失败：${error.message}`)
  }
}

onMounted(loadDashboard)
watch(range, loadDashboard)

const kpiCards = computed(() => {
  const current = kpis.value
  return [
    {
      label: '销售额',
      value: formatCurrency(current.sales),
      delta: formatDelta(current.salesDelta),
      hint: '较上一周期',
      tone: 'accent',
      spark: trend.value.sales,
    },
    {
      label: '订单量',
      value: formatNumber(current.orders),
      delta: formatDelta(current.ordersDelta),
      hint: '支付订单',
      tone: 'default',
      spark: trend.value.sales,
    },
    {
      label: '客单价',
      value: formatCurrency(current.aov, 1),
      delta: formatDelta(current.aovDelta),
      hint: '每笔订单',
      tone: 'success',
      spark: trend.value.sales,
    },
    {
      label: '会员订单占比',
      value: `${current.memberShare ?? 0}%`,
      delta: formatDelta(current.memberShareDelta),
      hint: '会员贡献订单',
      tone: 'default',
      spark: trend.value.sales.slice().reverse(),
    },
  ]
})

const sparkBars = computed(() => {
  const values = trend.value.sales || []
  if (!values.length) return []
  const max = Math.max(...values.map((value) => Number(value) || 0), 1)
  return values.map((value) => Math.max((Number(value) / max) * 100, 6))
})

function deltaClass(value) {
  return String(value || '').trim().startsWith('-') ? 'is-down' : 'is-up'
}

const chartOption = computed(() => ({
  color: ['#2b4edb'],
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#0b0f17',
    borderWidth: 0,
    padding: [8, 10],
    textStyle: { color: '#f5f7fa', fontSize: 11 },
    valueFormatter: (value) => formatCurrency(value),
  },
  grid: { left: 4, right: 24, top: 16, bottom: 0, containLabel: true },
  xAxis: {
    type: 'category',
    data: trend.value.labels,
    boundaryGap: false,
    axisLine: { lineStyle: { color: '#e3e7ed' } },
    axisTick: { show: false },
    axisLabel: { color: '#6b7483', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#eef1f5', type: 'dashed' } },
    axisLabel: {
      color: '#6b7483',
      fontSize: 10,
      formatter: (value) => formatCompact(value),
    },
  },
  series: [
    {
      name: '销售额',
      type: 'line',
      data: trend.value.sales,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2.2, color: '#2b4edb' },
      itemStyle: { color: '#2b4edb', borderColor: '#ffffff', borderWidth: 2 },
      areaStyle: { color: 'rgba(43, 78, 219, 0.08)' },
    },
  ],
}))

async function refresh() {
  try {
    await dashboard.load(range.value)
    lastUpdated.value = new Date()
    ElMessage.success('经营数据已刷新')
  } catch (error) {
    ElMessage.error(`刷新失败：${error.message}`)
  }
}

function exportData() {
  if (!dashboard.remote) {
    ElMessage.warning('演示模式暂不支持服务端导出')
    return
  }
  exporting.value = true
  downloadCsv(
    `/api/exports/dashboard?range=${range.value}`,
    `retailos-dashboard-${range.value}.csv`,
  )
    .then((filename) => ElMessage.success(`已导出 ${filename}`))
    .catch((error) => ElMessage.error(`导出失败：${error.message}`))
    .finally(() => {
      exporting.value = false
    })
}

function askAgent(text) {
  agent.open({ page: 'dashboard' })
  agent.send(text)
}
</script>

<template>
  <div class="page dashboard-page" v-loading="dashboard.loading">
    <div class="page-head">
      <div>
        <h1 class="page-title">经营驾驶舱</h1>
        <p class="page-subtitle">
          {{ auth.user?.scope }} · 数据更新于 {{ lastUpdatedText }}
        </p>
      </div>

      <div class="page-head-actions">
        <el-radio-group v-model="range" size="small">
          <el-radio-button
            v-for="item in ranges"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
        <el-button :icon="Refresh" circle aria-label="刷新数据" @click="refresh" />
        <el-button
          :icon="Download"
          :loading="exporting"
          @click="exportData"
        >
          导出
        </el-button>
      </div>
    </div>

    <div class="briefing">
      <StorePulse :items="storePulseItems" embedded />

      <section class="insight">
        <div class="insight-icon">
          <el-icon><MagicStick /></el-icon>
        </div>
        <div class="insight-copy">
          <strong>{{ rangeLabel }}洞察</strong>
          <p>{{ insight }}</p>
        </div>
        <el-button
          class="insight-btn"
          text
          @click="askAgent('帮我看看哪些门店经营异常，需要重点关注。')"
        >
          让助手分析
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </section>
    </div>

    <section class="metric-board">
      <article class="metric-primary">
        <div class="metric-top">
          <span class="metric-label">销售额</span>
          <span class="metric-delta" :class="deltaClass(kpiCards[0].delta)">
            {{ kpiCards[0].delta }}
          </span>
        </div>
        <strong class="metric-value">{{ kpiCards[0].value }}</strong>
        <div class="metric-foot">
          <span class="metric-hint">较上一周期</span>
          <div class="metric-spark" aria-hidden="true">
            <span
              v-for="(height, index) in sparkBars"
              :key="index"
              :style="{ height: `${height}%` }"
            ></span>
          </div>
        </div>
      </article>

      <article
        v-for="card in kpiCards.slice(1)"
        :key="card.label"
        class="metric-mini"
      >
        <div class="metric-top">
          <span class="metric-label">{{ card.label }}</span>
          <span class="metric-delta" :class="deltaClass(card.delta)">
            {{ card.delta }}
          </span>
        </div>
        <strong class="metric-value-sm">{{ card.value }}</strong>
        <span class="metric-hint">{{ card.hint }}</span>
      </article>
    </section>

    <section class="efficiency">
      <div
        v-for="item in efficiency"
        :key="item.label"
        class="efficiency-item"
        :class="`tone-${item.tone}`"
      >
        <span class="efficiency-label">{{ item.label }}</span>
        <strong class="efficiency-value tabular">{{ item.value }}</strong>
        <small class="efficiency-hint">{{ item.hint }}</small>
      </div>
    </section>

    <div class="dash-grid">
      <section class="card trend-card">
        <div class="card-head">
          <div>
            <h3 class="card-title">销售趋势</h3>
            <p class="card-subtitle">销售额 · 按{{ rangeLabel }}聚合</p>
          </div>
          <span class="pill">{{ rangeLabel }}</span>
        </div>
        <div class="card-body chart-body">
          <BaseChart :option="chartOption" height="264px" />
        </div>
      </section>

      <section class="card anomaly-card">
        <div class="card-head">
          <div>
            <h3 class="card-title">异常预警</h3>
            <p class="card-subtitle">按影响程度排序</p>
          </div>
          <span class="pill is-danger">{{ anomalies.length }} 条</span>
        </div>

        <div class="anomaly-list">
          <article v-for="item in anomalies" :key="item.id" class="anomaly-item">
            <span class="anomaly-dot" :class="`is-${item.severity}`"></span>
            <div class="anomaly-copy">
              <strong>{{ item.store }} · {{ item.type }}</strong>
              <p>{{ item.detail }}</p>
            </div>
            <span class="anomaly-time mono">{{ item.time }}</span>
          </article>
        </div>

        <button
          class="anomaly-link"
          type="button"
          @click="askAgent('帮我看看哪些门店经营异常，需要重点关注。')"
        >
          让助手给出处理顺序
          <el-icon><ArrowRight /></el-icon>
        </button>
      </section>
    </div>

    <div class="dash-grid-2">
      <section class="card ranking-card">
        <div class="card-head">
          <div>
            <h3 class="card-title">门店排行</h3>
            <p class="card-subtitle">按销售额排序 · Top 6</p>
          </div>
          <span class="pill">{{ scopeLabel }}</span>
        </div>
        <div class="card-body table-body">
          <el-table :data="ranking" size="small">
            <el-table-column label="#" width="42">
              <template #default="{ row, $index }">
                <span class="rank mono">{{ String(row.rank ?? $index + 1).padStart(2, '0') }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="门店" min-width="96" />
            <el-table-column prop="region" label="区域" width="68" />
            <el-table-column label="销售额" align="right" width="112">
              <template #default="{ row }">
                <span class="tabular">{{ formatCurrency(row.sales) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="环比" align="right" width="78">
              <template #default="{ row }">
                <span class="delta mono" :class="row.delta >= 0 ? 'is-up' : 'is-down'">
                  {{ formatDelta(row.delta) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="毛利率" align="right" width="82">
              <template #default="{ row }">
                <span class="tabular muted">
                  {{ formatPercent(row.grossMargin ?? 0) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="82">
              <template #default="{ row }">
                <el-tag size="small" effect="light" :type="statusTone(row.status)">
                  {{ statusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>

      <section class="card products-card">
        <div class="card-head">
          <div>
            <h3 class="card-title">商品 Top 5</h3>
            <p class="card-subtitle">按销售额贡献</p>
          </div>
          <span class="pill">{{ rangeLabel }}</span>
        </div>
        <div class="product-list">
          <div v-for="(product, index) in topProducts" :key="product.name" class="product-row">
            <span class="product-rank mono">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="product-copy">
              <div class="product-name">{{ product.name }}</div>
              <div class="product-meta">
                {{ product.category }} · {{ formatCurrency(product.sales) }}
              </div>
            </div>
            <div class="product-bar" aria-hidden="true">
              <span :style="{ width: `${product.share}%` }"></span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  animation: rise-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.briefing {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.insight {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-left: 1px solid var(--line);
}

.insight-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 15px;
}

.insight-copy {
  min-width: 0;
  flex: 1;
}

.insight-copy strong {
  color: var(--text);
  font-size: 11.5px;
  font-weight: 600;
}

.insight-copy p {
  margin-top: 2px;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.insight-btn {
  flex: none;
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 600;
}

.metric-board {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) repeat(3, minmax(0, 1fr));
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.metric-primary,
.metric-mini {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-left: 1px solid var(--line);
}

.metric-primary {
  padding: 16px 20px 14px;
  border-left: 0;
}

.metric-mini {
  padding: 16px 18px 14px;
}

.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.metric-label {
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 600;
}

.metric-delta {
  font-family: var(--display);
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.metric-delta.is-up {
  color: var(--success);
}

.metric-delta.is-down {
  color: var(--danger);
}

.metric-value {
  margin-top: 8px;
  color: var(--ink);
  font-family: var(--display);
  font-size: clamp(28px, 2.6vw, 36px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.metric-value-sm {
  margin-top: 6px;
  color: var(--ink);
  font-family: var(--display);
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.metric-foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 10px;
}

.metric-hint {
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.4;
}

.metric-spark {
  display: flex;
  width: 120px;
  height: 28px;
  flex: none;
  align-items: flex-end;
  gap: 2px;
}

.metric-spark span {
  min-height: 3px;
  flex: 1;
  border-radius: 1px;
  background: var(--accent);
  opacity: 0.38;
}

.metric-spark span:last-child {
  opacity: 1;
}

.efficiency {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}

.efficiency-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 18px;
  border-left: 1px solid var(--line);
}

.efficiency-item:first-child {
  border-left: 0;
}

.efficiency-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.efficiency-value {
  color: var(--text);
  font-family: var(--display);
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.efficiency-item.tone-accent .efficiency-value {
  color: var(--accent);
}

.efficiency-item.tone-success .efficiency-value {
  color: var(--success);
}

.efficiency-hint {
  color: var(--muted);
  font-size: 10px;
}

.dash-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.62fr) minmax(320px, 0.88fr);
  gap: 14px;
  margin-top: 14px;
}

.trend-card,
.anomaly-card,
.ranking-card,
.products-card {
  min-width: 0;
}

.chart-body {
  min-height: 264px;
  padding-top: 6px;
}

.anomaly-card {
  display: flex;
  flex-direction: column;
}

.anomaly-list {
  display: flex;
  flex-direction: column;
  padding: 10px 20px 0;
}

.anomaly-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}

.anomaly-item:last-child {
  border-bottom: 0;
}

.anomaly-dot {
  width: 7px;
  height: 7px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--faint);
  flex: none;
}

.anomaly-dot.is-high {
  background: var(--danger);
  box-shadow: 0 0 0 3px var(--danger-soft);
}

.anomaly-dot.is-medium {
  background: var(--warning);
  box-shadow: 0 0 0 3px var(--warning-soft);
}

.anomaly-dot.is-low {
  background: var(--info);
  box-shadow: 0 0 0 3px var(--info-soft);
}

.anomaly-copy {
  min-width: 0;
  flex: 1;
}

.anomaly-copy strong {
  display: block;
  color: var(--text);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.45;
}

.anomaly-copy p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.anomaly-time {
  color: var(--faint);
  font-size: 9.5px;
  flex: none;
}

.anomaly-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: auto 20px 16px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  text-align: left;
}

.dash-grid-2 {
  display: grid;
  grid-template-columns: minmax(0, 1.62fr) minmax(320px, 0.88fr);
  gap: 14px;
  margin-top: 14px;
}

.table-body {
  padding-top: 4px;
}

.rank {
  color: var(--faint);
  font-size: 10.5px;
}

.delta {
  font-size: 11px;
  font-weight: 600;
}

.delta.is-up {
  color: var(--success);
}

.delta.is-down {
  color: var(--danger);
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 20px 18px;
}

.product-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 72px;
  align-items: center;
  gap: 9px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}

.product-row:last-child {
  border-bottom: 0;
}

.product-rank {
  color: var(--faint);
  font-size: 10px;
}

.product-copy {
  min-width: 0;
}

.product-name {
  overflow: hidden;
  color: var(--text);
  font-size: 11.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-meta {
  margin-top: 1px;
  color: var(--faint);
  font-size: 9.5px;
}

.product-bar {
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--surface-3);
}

.product-bar span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
}

@media (max-width: 1180px) {
  .briefing {
    grid-template-columns: 1fr;
  }

  .insight {
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .metric-board,
  .efficiency {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-primary {
    grid-column: span 2;
    border-bottom: 1px solid var(--line);
  }

  .metric-mini:nth-child(2) {
    border-left: 0;
  }

  .efficiency-item:nth-child(3) {
    border-left: 0;
  }

  .efficiency-item:nth-child(n + 3) {
    border-top: 1px solid var(--line);
  }

  .dash-grid,
  .dash-grid-2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .metric-board,
  .efficiency {
    grid-template-columns: 1fr;
  }

  .metric-primary,
  .metric-mini {
    grid-column: auto;
    border-top: 1px solid var(--line);
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
  }

  .metric-primary {
    border-top: 0;
  }

  .efficiency-item {
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .efficiency-item:first-child {
    border-top: 0;
  }

  .insight {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .insight-btn {
    margin-left: 44px;
  }

  .anomaly-list,
  .product-list {
    padding-right: 14px;
    padding-left: 14px;
  }

  .anomaly-link {
    margin-right: 14px;
    margin-left: 14px;
  }
}
</style>
