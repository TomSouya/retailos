import { ref } from 'vue'
import { defineStore } from 'pinia'
import { USE_REMOTE_API } from '@/api/config'
import { fetchDashboard } from '@/api/client'
import {
  anomalies as mockAnomalies,
  kpiByRange,
  storePulse as mockPulse,
  stores as mockStores,
  topProducts as mockProducts,
  trendByRange,
} from '@/mocks/data'

const isRemote = USE_REMOTE_API
const RANGE_LABELS = { today: '今日', week: '本周', month: '本月' }

function buildMock(range) {
  return {
    range,
    rangeLabel: RANGE_LABELS[range] || '本周',
    updatedAt: '',
    kpis: kpiByRange[range],
    trend: trendByRange[range],
    ranking: [...mockStores]
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 6)
      .map((store, index) => ({ ...store, rank: index + 1 })),
    anomalies: mockAnomalies,
    topProducts: mockProducts,
    storePulse: mockPulse,
  }
}

export const useDashboardStore = defineStore('dashboard', () => {
  const data = ref(buildMock('week'))
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  async function load(range = 'week') {
    if (!isRemote) {
      data.value = buildMock(range)
      return data.value
    }

    loading.value = true
    error.value = ''
    try {
      data.value = await fetchDashboard(range)
      return data.value
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, remote, load }
})
