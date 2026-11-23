<script setup>
import { computed } from 'vue'
import BaseChart from '@/components/BaseChart.vue'
import { formatCompact } from '@/utils/format'

const props = defineProps({
  title: { type: String, default: '' },
  kind: { type: String, default: 'line' },
  x: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },
  height: { type: String, default: '190px' },
})

const option = computed(() => ({
  color: ['#2b4edb', '#0b8a5f', '#a86600', '#c4321f'],
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#0b0f17',
    borderWidth: 0,
    padding: [8, 10],
    textStyle: { color: '#f5f7fa', fontSize: 11 },
  },
  legend:
    props.series.length > 1
      ? {
          top: 0,
          right: 0,
          itemWidth: 8,
          itemHeight: 8,
          textStyle: { color: '#6b7483', fontSize: 10 },
        }
      : undefined,
  grid: {
    left: 4,
    right: 22,
    top: props.series.length > 1 ? 28 : 10,
    bottom: 0,
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    data: props.x,
    boundaryGap: props.kind === 'bar',
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
  series: props.series.map((item, index) => ({
    name: item.name,
    type: props.kind,
    data: item.data,
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    lineStyle: { width: 2 },
    itemStyle: { borderWidth: 2, borderColor: '#ffffff' },
    areaStyle:
      props.kind === 'line' && index === 0
        ? { color: 'rgba(43, 78, 219, 0.08)' }
        : undefined,
    barMaxWidth: 18,
  })),
}))
</script>

<template>
  <div class="chart-renderer">
    <div v-if="title" class="chart-title">{{ title }}</div>
    <BaseChart v-if="x.length" :option="option" :height="height" />
    <div v-else class="chart-empty">暂无趋势数据</div>
  </div>
</template>

<style scoped>
.chart-renderer {
  padding: 10px 0 0;
}

.chart-title {
  margin-bottom: 6px;
  color: var(--text);
  font-size: 11.5px;
  font-weight: 650;
}

.chart-empty {
  display: grid;
  height: 120px;
  place-items: center;
  color: var(--faint);
  font-size: 11px;
}
</style>
