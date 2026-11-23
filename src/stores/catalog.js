import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { USE_REMOTE_API } from '@/api/config'
import {
  createCategory as createCategoryApi,
  createProduct as createProductApi,
  createSupplier as createSupplierApi,
  fetchCategories,
  fetchProducts,
  fetchSuppliers,
  toggleProduct as toggleProductApi,
  updateCategory as updateCategoryApi,
  updateProduct as updateProductApi,
  updateSupplier as updateSupplierApi,
} from '@/api/client'
import { useAuthStore } from './auth'
import {
  categories as categorySeed,
  products as productSeed,
  suppliers as supplierSeed,
} from '@/mocks/phase2'

const isRemote = USE_REMOTE_API

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export const useCatalogStore = defineStore('catalog', () => {
  const categories = ref(isRemote ? [] : clone(categorySeed))
  const products = ref(isRemote ? [] : clone(productSeed))
  const suppliers = ref(isRemote ? [] : clone(supplierSeed))
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  const activeProducts = computed(() =>
    products.value.filter((item) => item.status === 'active'),
  )

  async function refresh() {
    if (!isRemote) return
    const auth = useAuthStore()
    loading.value = true
    error.value = ''
    try {
      const [nextCategories, nextProducts] = await Promise.all([
        fetchCategories(),
        fetchProducts(),
      ])
      categories.value = nextCategories
      products.value = nextProducts

      if (auth.roleKey !== 'store_manager') {
        try {
          suppliers.value = await fetchSuppliers()
        } catch {
          suppliers.value = []
        }
      }
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  async function createProduct(payload) {
    if (isRemote) {
      const record = await createProductApi(payload)
      products.value.unshift(record)
      return record
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm')
    const record = {
      id: payload.id || `SKU-${String(Date.now()).slice(-6)}`,
      name: payload.name,
      category: payload.category,
      price: Number(payload.price),
      costPrice: Number(payload.costPrice) || 0,
      unit: payload.unit || '件',
      status: payload.status || 'active',
      safetyStock: Number(payload.safetyStock) || 0,
      createdAt: now,
      updatedAt: now,
    }
    products.value.unshift(record)
    return record
  }

  async function updateProduct(id, payload) {
    if (isRemote) {
      const record = await updateProductApi(id, payload)
      const index = products.value.findIndex((item) => item.id === id)
      if (index >= 0) products.value[index] = record
      return record
    }

    const target = products.value.find((item) => item.id === id)
    if (!target) return null
    Object.assign(target, payload, {
      price: Number(payload.price ?? target.price),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
    })
    return target
  }

  async function toggleProduct(id, status) {
    if (isRemote) {
      const record = await toggleProductApi(id, status)
      const index = products.value.findIndex((item) => item.id === id)
      if (index >= 0) products.value[index] = record
      return record
    }

    const target = products.value.find((item) => item.id === id)
    if (!target) return null
    target.status = status
    target.updatedAt = dayjs().format('YYYY-MM-DD HH:mm')
    return target
  }

  async function createSupplier(payload) {
    if (isRemote) {
      const record = await createSupplierApi(payload)
      suppliers.value.push(record)
      return record
    }

    const record = {
      id: payload.id || `SUP-${String(Date.now()).slice(-6)}`,
      name: payload.name,
      contact: payload.contact,
      phone: payload.phone,
      status: payload.status || 'active',
    }
    suppliers.value.push(record)
    return record
  }

  async function updateSupplier(id, payload) {
    if (isRemote) {
      const record = await updateSupplierApi(id, payload)
      const index = suppliers.value.findIndex((item) => item.id === id)
      if (index >= 0) suppliers.value[index] = record
      return record
    }

    const target = suppliers.value.find((item) => item.id === id)
    if (!target) return null
    Object.assign(target, payload)
    return target
  }

  async function createCategory(payload) {
    if (isRemote) {
      const record = await createCategoryApi(payload)
      categories.value.push(record)
      categories.value.sort((a, b) => a.sort - b.sort)
      return record
    }

    const record = {
      id: payload.id || `CAT-${String(Date.now()).slice(-6)}`,
      name: payload.name,
      sort: Number(payload.sort) || categories.value.length + 1,
    }
    categories.value.push(record)
    categories.value.sort((a, b) => a.sort - b.sort)
    return record
  }

  async function updateCategory(id, payload) {
    if (isRemote) {
      const record = await updateCategoryApi(id, payload)
      const index = categories.value.findIndex((item) => item.id === id)
      if (index >= 0) categories.value[index] = record
      categories.value.sort((a, b) => a.sort - b.sort)
      return record
    }

    const target = categories.value.find((item) => item.id === id)
    if (!target) return null
    Object.assign(target, payload)
    categories.value.sort((a, b) => a.sort - b.sort)
    return target
  }

  return {
    categories,
    products,
    suppliers,
    activeProducts,
    loading,
    error,
    remote,
    refresh,
    createProduct,
    updateProduct,
    toggleProduct,
    createSupplier,
    updateSupplier,
    createCategory,
    updateCategory,
  }
})
