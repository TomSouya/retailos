import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { initialAudit } from '@/mocks/data'
import { USE_REMOTE_API } from '@/api/config'
import { fetchAudit } from '@/api/client'

let sequence = 100
const STORAGE_KEY = 'retailos.audit'
const isRemote = USE_REMOTE_API

function loadRecords() {
  if (isRemote) return []
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved) && saved.length) return saved
  } catch {
    // 使用初始数据
  }
  return initialAudit.map((record) => ({ ...record }))
}

export const useAuditStore = defineStore('audit', () => {
  const records = ref(loadRecords())
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  if (!isRemote) {
    watch(
      records,
      (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)),
      { deep: true },
    )
  }

  async function refresh() {
    if (!isRemote) return records.value
    loading.value = true
    error.value = ''
    try {
      records.value = await fetchAudit()
      return records.value
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  function record(entry) {
    if (isRemote) return null
    sequence += 1
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const id = `AU-${dayjs().format('YYYYMMDD')}-${String(sequence).padStart(3, '0')}`
    const next = {
      id,
      timestamp,
      actor: '系统',
      role: '系统',
      action: '未知操作',
      object: '—',
      result: 'success',
      approvalId: '—',
      ...entry,
    }
    records.value.unshift(next)
    return next
  }

  return {
    records,
    loading,
    error,
    remote,
    refresh,
    record,
  }
})
