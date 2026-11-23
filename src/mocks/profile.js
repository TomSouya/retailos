import { salesOrders } from './phase2'

export const storeProfiles = {
  S001: { phone: '021-6200 1001', openedAt: '2022-03-18' },
  S002: { phone: '021-6400 2002', openedAt: '2022-06-25' },
  S003: { phone: '021-5800 3003', openedAt: '2023-01-12' },
  S004: { phone: '0571-8800 4004', openedAt: '2023-04-20' },
  S005: { phone: '020-3800 5005', openedAt: '2022-11-08' },
  S006: { phone: '0755-8600 6006', openedAt: '2023-07-16' },
  S007: { phone: '028-6600 7007', openedAt: '2024-01-28' },
  S008: { phone: '023-6300 8008', openedAt: '2024-05-30' },
}

const MEMBER_SEED = [
  {
    id: 'MB-0001',
    name: '张女士',
    phone: '13800001001',
    level: 'gold',
    storeId: 'S001',
    points: 2860,
    joinedAt: '2024-06-12 10:20',
    status: 'normal',
  },
  {
    id: 'MB-0002',
    name: '李女士',
    phone: '13800001002',
    level: 'gold',
    storeId: 'S002',
    points: 1980,
    joinedAt: '2024-09-03 15:45',
    status: 'normal',
  },
  {
    id: 'MB-0003',
    name: '王先生',
    phone: '13800001003',
    level: 'diamond',
    storeId: 'S003',
    points: 5620,
    joinedAt: '2023-11-20 09:10',
    status: 'normal',
  },
  {
    id: 'MB-0004',
    name: '赵女士',
    phone: '13800001004',
    level: 'silver',
    storeId: 'S001',
    points: 860,
    joinedAt: '2025-03-15 18:30',
    status: 'normal',
  },
  {
    id: 'MB-0005',
    name: '陈先生',
    phone: '13800001005',
    level: 'silver',
    storeId: 'S004',
    points: 1120,
    joinedAt: '2024-12-01 12:05',
    status: 'normal',
  },
  {
    id: 'MB-0006',
    name: '林女士',
    phone: '13800001006',
    level: 'gold',
    storeId: 'S005',
    points: 2400,
    joinedAt: '2024-02-08 11:50',
    status: 'normal',
  },
  {
    id: 'MB-0007',
    name: '何先生',
    phone: '13800001007',
    level: 'basic',
    storeId: 'S007',
    points: 320,
    joinedAt: '2026-05-22 14:10',
    status: 'dormant',
  },
  {
    id: 'MB-0008',
    name: '周女士',
    phone: '13800001008',
    level: 'basic',
    storeId: 'S006',
    points: 180,
    joinedAt: '2025-08-09 16:40',
    status: 'dormant',
  },
]

function metricsFor(name) {
  const orders = salesOrders.filter((order) => order.memberName === name)
  const totalSpent = orders.reduce(
    (sum, order) =>
      sum +
      Math.max(Number(order.amount) - Number(order.refundedAmount || 0), 0),
    0,
  )
  return {
    orderCount: orders.length,
    totalSpent: Math.round(totalSpent * 100) / 100,
    lastVisitAt: orders[0]?.createdAt || '',
  }
}

export const members = MEMBER_SEED.map((member) => ({
  ...member,
  ...metricsFor(member.name),
}))
