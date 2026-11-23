import { ref } from 'vue'
import { defineStore } from 'pinia'
import { USE_REMOTE_API } from '@/api/config'
import { adjustInventory, fetchInventory, fetchStockMovements } from '@/api/client'
import { inventory as inventorySeed } from '@/mocks/data'

const isRemote = USE_REMOTE_API

const MOVEMENT_SEED = [
  {
    id: 'MV-SEED-001',
    storeId: 'S001',
    storeName: '静安店',
    sku: 'SKU-1001',
    name: '有机鲜牛奶 950ml',
    type: 'purchase_received',
    typeLabel: '采购入库',
    quantity: 18,
    beforeStock: 0,
    afterStock: 18,
    refId: 'PO-20261115-001',
    operator: '顾岩',
    note: '期初采购入库',
    createdAt: '2026-11-15 08:30',
  },
  {
    id: 'MV-SEED-002',
    storeId: 'S001',
    storeName: '静安店',
    sku: 'SKU-1002',
    name: '云南蓝莓 125g',
    type: 'purchase_received',
    typeLabel: '采购入库',
    quantity: 6,
    beforeStock: 0,
    afterStock: 6,
    refId: 'PO-20261118-001',
    operator: '顾岩',
    note: '生鲜到货验收',
    createdAt: '2026-11-18 09:40',
  },
  {
    id: 'MV-SEED-003',
    storeId: 'S001',
    storeName: '静安店',
    sku: 'SKU-1006',
    name: '冷萃咖啡 280ml',
    type: 'replenishment_out',
    typeLabel: '补货出库',
    quantity: -12,
    beforeStock: 12,
    afterStock: 0,
    refId: 'AP-20261120-009',
    operator: '周然',
    note: '门店间调拨出库',
    createdAt: '2026-11-20 16:10',
  },
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export const useInventoryStore = defineStore('inventory', () => {
  const items = ref(
    isRemote
      ? []
      : inventorySeed.map((item) => ({ ...item, sku: item.id })),
  )
  const movements = ref(isRemote ? [] : clone(MOVEMENT_SEED))
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  async function refresh() {
    if (!isRemote) return
    loading.value = true
    error.value = ''
    try {
      const [nextItems, nextMovements] = await Promise.all([
        fetchInventory(),
        fetchStockMovements({ limit: 50 }),
      ])
      items.value = nextItems
      movements.value = nextMovements
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  async function adjust(sku, payload) {
    if (isRemote) {
      const result = await adjustInventory(sku, payload)
      await refresh()
      return result
    }

    const item = items.value.find(
      (entry) => entry.sku === sku && entry.storeId === payload.storeId,
    )
    if (!item) throw new Error('未找到该门店的库存记录')
    const beforeStock = Number(item.stock)
    const afterStock = beforeStock + Number(payload.delta)
    if (afterStock < 0) throw new Error('调整后库存不能为负')
    item.stock = afterStock
    const movement = {
      id: `MV-MOCK-${Date.now()}`,
      storeId: item.storeId,
      storeName: item.storeId,
      sku,
      name: item.name,
      type: 'adjustment',
      typeLabel: '库存调整',
      quantity: Number(payload.delta),
      beforeStock,
      afterStock,
      refId: 'ADJ-MOCK',
      operator: '当前用户',
      note: payload.reason,
      createdAt: new Date().toISOString(),
    }
    movements.value.unshift(movement)
    return { item, movement }
  }

  return {
    items,
    movements,
    loading,
    error,
    remote,
    refresh,
    adjust,
  }
})
