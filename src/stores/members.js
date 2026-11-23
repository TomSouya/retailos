import { ref } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { USE_REMOTE_API } from '@/api/config'
import {
  createMember as createMemberApi,
  fetchMember,
  fetchMembers,
  recalculateMemberPoints as recalculateMemberPointsApi,
  updateMember as updateMemberApi,
} from '@/api/client'
import { stores } from '@/mocks/data'
import { salesOrders } from '@/mocks/phase2'
import { members as memberSeed } from '@/mocks/profile'
import { useAuthStore } from './auth'

const isRemote = USE_REMOTE_API

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function scopedStoreIds() {
  const auth = useAuthStore()
  if (auth.roleKey === 'owner') return stores.map((store) => store.id)
  if (auth.roleKey === 'regional_manager') {
    return stores
      .filter((store) => store.region === auth.user?.region)
      .map((store) => store.id)
  }
  if (auth.roleKey === 'store_manager') {
    return stores
      .filter((store) => store.id === auth.user?.storeId)
      .map((store) => store.id)
  }
  return []
}

function summarize(list) {
  const now = dayjs()
  const repeatMembers = list.filter(
    (item) => Number(item.orderCount) >= 2,
  ).length
  const totalSpent =
    Math.round(
      list.reduce((sum, item) => sum + Number(item.totalSpent || 0), 0) * 100,
    ) / 100
  return {
    total: list.length,
    active: list.filter((item) => item.status === 'normal').length,
    dormant: list.filter((item) => item.status === 'dormant').length,
    silent: list.filter((item) => Number(item.inactiveDays) >= 45).length,
    repeatMembers,
    repeatRate: list.length
      ? Math.round((repeatMembers / list.length) * 1000) / 10
      : 0,
    avgSpent: list.length
      ? Math.round((totalSpent / list.length) * 100) / 100
      : 0,
    totalSpent,
    newThisMonth: list.filter((item) =>
      dayjs(item.joinedAt).isAfter(now.startOf('month')),
    ).length,
    points: list.reduce((sum, item) => sum + Number(item.points || 0), 0),
  }
}

export const useMembersStore = defineStore('members', () => {
  const members = ref(isRemote ? [] : clone(memberSeed))
  const summary = ref(isRemote ? null : summarize(memberSeed))
  const loading = ref(false)
  const error = ref('')
  const remote = isRemote

  async function refresh(query = {}) {
    if (!isRemote) {
      const allowed = new Set(scopedStoreIds())
      const keyword = String(query.search || '').trim().toLowerCase()
      const list = members.value
        .filter((item) => allowed.has(item.storeId))
        .filter((item) =>
          query.storeId && query.storeId !== 'all'
            ? item.storeId === query.storeId
            : true,
        )
        .filter((item) =>
          query.level && query.level !== 'all' ? item.level === query.level : true,
        )
        .filter((item) =>
          query.status && query.status !== 'all'
            ? item.status === query.status
            : true,
        )
        .filter((item) => {
          if (!keyword) return true
          return (
            item.name.toLowerCase().includes(keyword) ||
            item.phone.toLowerCase().includes(keyword) ||
            item.id.toLowerCase().includes(keyword)
          )
        })
      summary.value = summarize(list)
      return list
    }

    loading.value = true
    error.value = ''
    try {
      const body = await fetchMembers(query)
      members.value = body.members || []
      summary.value = body.summary || summarize(members.value)
      return members.value
    } catch (nextError) {
      error.value = nextError.message
      throw nextError
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(id) {
    if (isRemote) return fetchMember(id)
    const member = members.value.find((item) => item.id === id)
    if (!member) return null
    return {
      member: clone(member),
      orders: salesOrders
        .filter((order) => order.memberName === member.name)
        .slice(0, 10)
        .map((order) => ({
          id: order.id,
          storeName: order.storeName,
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
      const record = await updateMemberApi(id, payload)
      const index = members.value.findIndex((item) => item.id === id)
      if (index >= 0) members.value[index] = record
      return record
    }
    const target = members.value.find((item) => item.id === id)
    if (!target) return null
    Object.assign(target, payload, {
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
    })
    return target
  }

  async function create(payload) {
    if (isRemote) {
      const record = await createMemberApi(payload)
      members.value.unshift(record)
      return record
    }
    const record = {
      ...payload,
      id: `MB-${String(members.value.length + 1).padStart(4, '0')}`,
      status: 'normal',
      joinedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      orderCount: 0,
      totalSpent: 0,
      lastVisitAt: '',
    }
    members.value.unshift(record)
    summary.value = summarize(members.value)
    return record
  }

  async function recalculatePoints() {
    if (isRemote) return recalculateMemberPointsApi()
    return {
      updated: members.value.length,
      totalPoints: members.value.reduce(
        (sum, item) => sum + Number(item.points || 0),
        0,
      ),
      rule: '演示模式未接入积分规则',
    }
  }

  return {
    members,
    summary,
    loading,
    error,
    remote,
    refresh,
    loadDetail,
    update,
    create,
    recalculatePoints,
  }
})
