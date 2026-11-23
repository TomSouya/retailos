import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { USE_REMOTE_API } from '@/api/config'
import {
  fetchSalesOrder,
  fetchSalesOrders,
  refundSalesOrder,
} from '@/api/client'
import { salesOrders as orderSeed } from '@/mocks/phase2'

const isRemote = USE_REMOTE_API

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref(isRemote ? [] : clone(orderSeed))
  const detail = ref(null)
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  const summary = computed(() => {
    const total = orders.value.length
    const paid = orders.value.filter(
      (item) => item.status === 'paid',
    ).length
    const refunded = orders.value.filter((item) =>
      ['refunded', 'partially_refunded'].includes(item.status),
    ).length
    const amount = orders.value.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    )
    return { total, paid, refunded, amount }
  })

  async function refresh(query = {}) {
    if (!isRemote) return orders.value
    loading.value = true
    error.value = ''
    try {
      orders.value = await fetchSalesOrders(query)
      return orders.value
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(id) {
    if (isRemote) {
      detail.value = await fetchSalesOrder(id)
      return detail.value
    }
    detail.value = orders.value.find((item) => item.id === id) || null
    return detail.value
  }

  async function refund(id, payload = {}) {
    if (isRemote) {
      return refundSalesOrder(id, payload)
    }

    const target = orders.value.find((item) => item.id === id)
    if (
      !target ||
      !['paid', 'partially_refunded'].includes(target.status)
    ) {
      return null
    }

    const amount =
      payload.amount === undefined
        ? Number(target.amount) - Number(target.refundedAmount || 0)
        : Number(payload.amount)
    const refundable =
      Number(target.amount) - Number(target.refundedAmount || 0)
    if (!Number.isFinite(amount) || amount <= 0 || amount > refundable) {
      return null
    }

    target.refundedAmount = Number(target.refundedAmount || 0) + amount
    target.refundableAmount =
      Math.round((Number(target.amount) - target.refundedAmount) * 100) / 100
    target.refundReason = payload.reason || ''
    target.status =
      target.refundedAmount >= Number(target.amount)
        ? 'refunded'
        : 'partially_refunded'
    return target
  }

  return {
    orders,
    detail,
    summary,
    loading,
    error,
    remote,
    refresh,
    loadDetail,
    refund,
  }
})
