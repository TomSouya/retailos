import { ref } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { USE_REMOTE_API } from '@/api/config'
import {
  createStore as createStoreApi,
  fetchStore,
  fetchStores,
  updateStore as updateStoreApi,
} from '@/api/client'
import { inventory, stores as storeSeed } from '@/mocks/data'
import { salesOrders } from '@/mocks/phase2'
import { storeProfiles } from '@/mocks/profile'

const isRemote = USE_REMOTE_API

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function buildMockStores() {
  return storeSeed.map((store) => {
    const orders = salesOrders.filter((order) => order.storeId === store.id)
    const items = inventory.filter((item) => item.storeId === store.id)
    const sales = orders.reduce(
      (sum, order) =>
        sum +
        Math.max(
          Number(order.amount) - Number(order.refundedAmount || 0),
          0,
        ),
      0,
    )
    return {
      ...store,
      phone: storeProfiles[store.id]?.phone || '—',
      openedAt: storeProfiles[store.id]?.openedAt || '—',
      updatedAt: '—',
      sales: Math.round(sales * 100) / 100,
      orders: orders.length,
      members: new Set(orders.map((order) => order.memberName)).size,
      lowStock: items.filter((item) => item.stock < item.safetyStock).length,
      inventoryCount: items.length,
    }
  })
}

export const useDirectoryStore = defineStore('directory', () => {
  const stores = ref(isRemote ? [] : buildMockStores())
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  async function refresh() {
    if (!isRemote) return stores.value
    loading.value = true
    error.value = ''
    try {
      stores.value = await fetchStores()
      return stores.value
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(id) {
    if (isRemote) return fetchStore(id)
    const store = stores.value.find((item) => item.id === id)
    if (!store) return null
    return {
      store: clone(store),
      orders: salesOrders
        .filter((order) => order.storeId === id)
        .slice(0, 8)
        .map((order) => ({
          id: order.id,
          memberName: order.memberName,
          itemCount: order.itemCount,
          amount: order.amount,
          refundedAmount: order.refundedAmount || 0,
          status: order.status,
          createdAt: order.createdAt,
        })),
    }
  }

  async function update(id, payload) {
    if (isRemote) {
      const record = await updateStoreApi(id, payload)
      const index = stores.value.findIndex((item) => item.id === id)
      if (index >= 0) stores.value[index] = record
      return record
    }
    const target = stores.value.find((item) => item.id === id)
    if (!target) return null
    Object.assign(target, payload, {
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
    })
    return target
  }

  async function create(payload) {
    if (isRemote) {
      const record = await createStoreApi(payload)
      stores.value.push(record)
      return record
    }
    const record = {
      ...payload,
      id: `S${String(stores.value.length + 1).padStart(3, '0')}`,
      status: payload.status || 'normal',
      sales: 0,
      orders: 0,
      members: 0,
      lowStock: 0,
      inventoryCount: 0,
      updatedAt: '刚刚',
    }
    stores.value.push(record)
    return record
  }

  return {
    stores,
    loading,
    error,
    remote,
    refresh,
    loadDetail,
    update,
    create,
  }
})
