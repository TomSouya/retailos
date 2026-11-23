import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { USE_REMOTE_API } from '@/api/config'
import {
  createPurchaseOrder,
  fetchPurchaseOrders,
  transitionPurchaseOrder,
  updatePurchaseOrder,
} from '@/api/client'
import { purchaseOrders as orderSeed } from '@/mocks/phase2'

const isRemote = USE_REMOTE_API

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

const STATUS_FLOW = {
  submit: 'pending',
  approve: 'approved',
  receive: 'received',
}

export const useProcurementStore = defineStore('procurement', () => {
  const orders = ref(isRemote ? [] : clone(orderSeed))
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  const summary = computed(() => {
    const total = orders.value.length
    const pending = orders.value.filter(
      (item) => item.status === 'pending',
    ).length
    const approved = orders.value.filter(
      (item) => item.status === 'approved',
    ).length
    const received = orders.value.filter(
      (item) => item.status === 'received',
    ).length
    return { total, pending, approved, received }
  })

  async function refresh(query = {}) {
    if (!isRemote) return orders.value
    loading.value = true
    error.value = ''
    try {
      orders.value = await fetchPurchaseOrders(query)
      return orders.value
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  async function create(payload) {
    if (isRemote) {
      const record = await createPurchaseOrder(payload)
      orders.value.unshift(record)
      return record
    }

    const items = (payload.items || []).map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      amount: Number(item.quantity) * Number(item.unitPrice),
    }))
    const totalAmount = items.reduce(
      (sum, item) => sum + item.amount,
      0,
    )
    const record = {
      id: `PO-${dayjs().format('YYYYMMDD')}-${String(Date.now()).slice(-4)}`,
      supplierId: payload.supplierId,
      supplierName: payload.supplierName,
      storeId: payload.storeId,
      storeName: payload.storeName,
      status: 'draft',
      totalAmount,
      itemCount: items.length,
      createdBy: payload.createdBy || '系统',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      approvedBy: '',
      approvedAt: '',
      receivedAt: '',
      note: payload.note || '',
      items,
    }
    orders.value.unshift(record)
    return record
  }

  async function updateDraft(id, payload) {
    if (isRemote) {
      const record = await updatePurchaseOrder(id, payload)
      const index = orders.value.findIndex((item) => item.id === id)
      if (index >= 0) orders.value[index] = record
      return record
    }

    const target = orders.value.find((item) => item.id === id)
    if (!target) return null
    if (payload.supplierId) {
      target.supplierId = payload.supplierId
      target.supplierName = payload.supplierName || target.supplierName
    }
    if (payload.note !== undefined) target.note = payload.note
    for (const change of payload.items || []) {
      const item = target.items.find((entry) => entry.sku === change.sku)
      if (!item) continue
      item.unitPrice = Number(change.unitPrice)
      item.amount = Number(item.quantity) * item.unitPrice
    }
    target.totalAmount = target.items.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    )
    return target
  }

  async function transition(id, action) {
    if (isRemote) {
      const record = await transitionPurchaseOrder(id, action)
      const index = orders.value.findIndex((item) => item.id === id)
      if (index >= 0) orders.value[index] = record
      return record
    }

    const target = orders.value.find((item) => item.id === id)
    if (!target) return null
    target.status = STATUS_FLOW[action] || target.status
    if (action === 'approve') {
      target.approvedBy = '林悦'
      target.approvedAt = dayjs().format('YYYY-MM-DD HH:mm')
    }
    if (action === 'receive') {
      target.receivedAt = dayjs().format('YYYY-MM-DD HH:mm')
    }
    return target
  }

  return {
    orders,
    summary,
    loading,
    error,
    remote,
    refresh,
    create,
    updateDraft,
    transition,
  }
})
