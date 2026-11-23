import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { initialApprovals } from '@/mocks/data'
import { APPROVAL_STATUS } from '@/contracts/approval'
import { USE_REMOTE_API } from '@/api/config'
import {
  createApproval,
  decideApproval,
  fetchApprovals,
} from '@/api/client'
import { useAuditStore } from './audit'
import { useAuthStore } from './auth'

let sequence = 100
const STORAGE_KEY = 'retailos.approvals'
const isRemote = USE_REMOTE_API

function loadApprovals() {
  if (isRemote) return []
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved) && saved.length) return saved
  } catch {
    // 使用初始数据
  }
  return initialApprovals.map((item) => ({ ...item }))
}

export const useApprovalStore = defineStore('approval', () => {
  const approvals = ref(loadApprovals())
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  const pending = computed(() =>
    approvals.value.filter((item) => item.status === APPROVAL_STATUS.PENDING),
  )

  if (!isRemote) {
    watch(
      approvals,
      (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)),
      { deep: true },
    )
  }

  async function refresh() {
    if (!isRemote) return approvals.value
    loading.value = true
    error.value = ''
    try {
      approvals.value = await fetchApprovals()
      return approvals.value
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  async function submit(payload) {
    const auth = useAuthStore()

    if (isRemote) {
      const record = await createApproval(payload)
      const index = approvals.value.findIndex((item) => item.id === record.id)
      if (index >= 0) approvals.value[index] = record
      else approvals.value.unshift(record)
      return record
    }

    const audit = useAuditStore()

    if (payload.id) {
      const existing = approvals.value.find((item) => item.id === payload.id)
      if (existing) return existing
    }

    sequence += 1
    const id =
      payload.id ||
      `AP-${dayjs().format('YYYYMMDD')}-${String(sequence).padStart(3, '0')}`

    const record = {
      id,
      type: 'replenishment',
      status: APPROVAL_STATUS.PENDING,
      risk: 'medium',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      requester: auth.user?.name || '系统',
      items: [],
      ...payload,
    }

    approvals.value.unshift(record)

    audit.record({
      actor: record.requester,
      role: auth.user?.label || '系统',
      action: '提交补货申请',
      object: record.id,
      result: 'submitted',
      approvalId: record.id,
    })

    return record
  }

  async function decide(id, decision) {
    const auth = useAuthStore()

    if (isRemote) {
      const updated = await decideApproval(id, decision)
      const index = approvals.value.findIndex((item) => item.id === id)
      if (index >= 0) approvals.value[index] = updated
      else approvals.value.unshift(updated)
      return updated
    }

    const target = approvals.value.find((item) => item.id === id)
    if (!target || target.status !== APPROVAL_STATUS.PENDING) return false

    const audit = useAuditStore()

    target.status = decision
    target.decidedAt = dayjs().format('YYYY-MM-DD HH:mm')
    target.decidedBy = auth.user?.name || '系统'

    audit.record({
      actor: target.decidedBy,
      role: auth.user?.label || '系统',
      action: decision === 'approved' ? '审批通过补货申请' : '驳回补货申请',
      object: target.id,
      result: decision,
      approvalId: target.id,
    })

    return true
  }

  return {
    approvals,
    pending,
    loading,
    error,
    remote,
    refresh,
    submit,
    decide,
  }
})
