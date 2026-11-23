export const company = {
  name: '星辰生活',
  brand: 'RetailOS',
  subtitle: '智慧零售运营平台',
  stores: 50,
  modules: 8,
  roles: 7,
}

export const stores = [
  {
    id: 'S001',
    name: '静安店',
    city: '上海',
    region: '华东',
    sales: 386400,
    orders: 2410,
    aov: 160.3,
    delta: -6.4,
    status: 'warning',
    manager: '周然',
  },
  {
    id: 'S002',
    name: '徐汇店',
    city: '上海',
    region: '华东',
    sales: 421800,
    orders: 2680,
    aov: 157.4,
    delta: 4.8,
    status: 'normal',
    manager: '许安',
  },
  {
    id: 'S003',
    name: '浦东店',
    city: '上海',
    region: '华东',
    sales: 398600,
    orders: 2450,
    aov: 162.7,
    delta: 2.1,
    status: 'warning',
    manager: '沈一',
  },
  {
    id: 'S004',
    name: '西湖店',
    city: '杭州',
    region: '华东',
    sales: 365200,
    orders: 2310,
    aov: 158.1,
    delta: 7.6,
    status: 'normal',
    manager: '陈默',
  },
  {
    id: 'S005',
    name: '天河店',
    city: '广州',
    region: '华南',
    sales: 342900,
    orders: 2180,
    aov: 157.3,
    delta: 3.2,
    status: 'normal',
    manager: '林可',
  },
  {
    id: 'S006',
    name: '福田店',
    city: '深圳',
    region: '华南',
    sales: 331500,
    orders: 2090,
    aov: 158.6,
    delta: -1.8,
    status: 'normal',
    manager: '赵清',
  },
  {
    id: 'S007',
    name: '春熙店',
    city: '成都',
    region: '西南',
    sales: 298400,
    orders: 1960,
    aov: 152.2,
    delta: 5.4,
    status: 'normal',
    manager: '何川',
  },
  {
    id: 'S008',
    name: '解放碑店',
    city: '重庆',
    region: '西南',
    sales: 276800,
    orders: 1830,
    aov: 151.3,
    delta: -3.1,
    status: 'normal',
    manager: '苏禾',
  },
]

const pulseAreas = [
  '静安',
  '徐汇',
  '浦东',
  '黄浦',
  '长宁',
  '虹口',
  '杨浦',
  '闵行',
  '宝山',
  '嘉定',
  '西湖',
  '滨江',
  '天河',
  '越秀',
  '海珠',
  '福田',
  '南山',
  '罗湖',
  '春熙',
  '高新',
  '锦江',
  '解放碑',
  '江北',
  '渝中',
  '江汉',
  '武昌',
  '洪山',
  '鼓楼',
  '玄武',
  '秦淮',
  '和平',
  '河西',
  '市南',
  '崂山',
  '历下',
  '金水',
  '二七',
  '长安',
  '雁塔',
  '未央',
  '庐阳',
  '蜀山',
  '包河',
  '经开',
  '青秀',
  '兴宁',
  '江南',
  '西乡塘',
  '良庆',
  '钱塘',
]

export const storePulse = Array.from({ length: 50 }, (_, index) => {
  let status = 'normal'
  if (index % 19 === 0) status = 'danger'
  else if (index % 7 === 0) status = 'warning'
  else if (index % 23 === 0) status = 'offline'

  return {
    id: `P${String(index + 1).padStart(3, '0')}`,
    name: `${pulseAreas[index] || `门店 ${index + 1}`}店`,
    status,
    sales: 120000 + ((index * 7919) % 320000),
  }
})

export const kpiByRange = {
  today: {
    sales: 486200,
    orders: 3120,
    aov: 155.8,
    memberShare: 38.6,
    salesDelta: 6.2,
    ordersDelta: 3.4,
    aovDelta: 2.7,
    memberShareDelta: 1.8,
  },
  week: {
    sales: 2864000,
    orders: 18420,
    aov: 155.5,
    memberShare: 41.2,
    salesDelta: 8.2,
    ordersDelta: 5.6,
    aovDelta: 2.5,
    memberShareDelta: 3.1,
  },
  month: {
    sales: 11860000,
    orders: 76200,
    aov: 155.6,
    memberShare: 43.8,
    salesDelta: 12.4,
    ordersDelta: 9.8,
    aovDelta: 2.3,
    memberShareDelta: 4.6,
  },
}

export const trendByRange = {
  today: {
    labels: [
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
      '19:00',
      '20:00',
      '21:00',
    ],
    sales: [
      12000, 18000, 26000, 34000, 41000, 52000, 58000, 66000, 74000, 86000, 92000, 78000,
      54000, 32000,
    ],
  },
  week: {
    labels: ['11-15', '11-16', '11-17', '11-18', '11-19', '11-20', '11-21'],
    sales: [368000, 392000, 418000, 402000, 436000, 452000, 396000],
  },
  month: {
    labels: ['第 1 周', '第 2 周', '第 3 周', '第 4 周', '本周'],
    sales: [2680000, 2840000, 2960000, 2864000, 510000],
  },
}

export const anomalies = [
  {
    id: 'A1',
    store: '静安店',
    region: '华东',
    type: '销售下滑',
    detail: '销售额环比 -6.4%，低于区域均值 12%',
    severity: 'high',
    time: '10:42',
  },
  {
    id: 'A2',
    store: '浦东店',
    region: '华东',
    type: '库存周转',
    detail: '周转天数 28 天，高于目标 18 天',
    severity: 'medium',
    time: '10:18',
  },
  {
    id: 'A3',
    store: '虹口店',
    region: '华东',
    type: '缺货风险',
    detail: '3 个 SKU 低于安全库存',
    severity: 'medium',
    time: '09:56',
  },
  {
    id: 'A4',
    store: '嘉定店',
    region: '华东',
    type: '会员流失',
    detail: '30 天复购率下降 4.2%',
    severity: 'low',
    time: '09:20',
  },
]

export const topProducts = [
  { name: '有机鲜牛奶 950ml', category: '乳品', sales: 128600, share: 92 },
  { name: '云南蓝莓 125g', category: '生鲜', sales: 112400, share: 81 },
  { name: '零糖气泡水 6 连包', category: '饮料', sales: 98600, share: 71 },
  { name: '原味吐司 400g', category: '烘焙', sales: 86400, share: 62 },
  { name: '厨房纸巾 4 卷装', category: '家居', sales: 72800, share: 52 },
]

export const inventory = [
  {
    id: 'SKU-1001',
    name: '有机鲜牛奶 950ml',
    category: '乳品',
    storeId: 'S001',
    stock: 18,
    safetyStock: 40,
    unit: '箱',
    price: 68,
  },
  {
    id: 'SKU-1002',
    name: '云南蓝莓 125g',
    category: '生鲜',
    storeId: 'S001',
    stock: 6,
    safetyStock: 24,
    unit: '盒',
    price: 19.9,
  },
  {
    id: 'SKU-1003',
    name: '零糖气泡水 6 连包',
    category: '饮料',
    storeId: 'S001',
    stock: 52,
    safetyStock: 30,
    unit: '提',
    price: 29.9,
  },
  {
    id: 'SKU-1004',
    name: '原味吐司 400g',
    category: '烘焙',
    storeId: 'S001',
    stock: 22,
    safetyStock: 20,
    unit: '袋',
    price: 12.8,
  },
  {
    id: 'SKU-1005',
    name: '厨房纸巾 4 卷装',
    category: '家居',
    storeId: 'S001',
    stock: 64,
    safetyStock: 36,
    unit: '提',
    price: 24.9,
  },
  {
    id: 'SKU-1006',
    name: '冷萃咖啡 280ml',
    category: '饮料',
    storeId: 'S001',
    stock: 0,
    safetyStock: 18,
    unit: '瓶',
    price: 16.9,
  },
  {
    id: 'SKU-1007',
    name: '进口香蕉 1kg',
    category: '生鲜',
    storeId: 'S001',
    stock: 34,
    safetyStock: 30,
    unit: '份',
    price: 15.9,
  },
  {
    id: 'SKU-1008',
    name: '低脂酸奶 200g',
    category: '乳品',
    storeId: 'S001',
    stock: 44,
    safetyStock: 24,
    unit: '杯',
    price: 8.9,
  },
  {
    id: 'SKU-1009',
    name: '坚果能量棒',
    category: '零食',
    storeId: 'S001',
    stock: 38,
    safetyStock: 20,
    unit: '盒',
    price: 22.9,
  },
  {
    id: 'SKU-1010',
    name: '天然矿泉水 550ml',
    category: '饮料',
    storeId: 'S001',
    stock: 120,
    safetyStock: 60,
    unit: '箱',
    price: 36,
  },
  {
    id: 'SKU-1011',
    name: '手工吐司 300g',
    category: '烘焙',
    storeId: 'S002',
    stock: 16,
    safetyStock: 20,
    unit: '袋',
    price: 14.8,
  },
  {
    id: 'SKU-1012',
    name: '鲜鸡蛋 10 枚',
    category: '生鲜',
    storeId: 'S002',
    stock: 32,
    safetyStock: 28,
    unit: '盒',
    price: 18.9,
  },
]

export const initialApprovals = [
  {
    id: 'AP-20261121-001',
    type: 'replenishment',
    storeId: 'S001',
    storeName: '静安店',
    requester: '周然',
    risk: 'medium',
    status: 'pending',
    createdAt: '2026-11-21 09:40',
    items: [
      { sku: 'SKU-1001', name: '有机鲜牛奶 950ml', quantity: 60 },
      { sku: 'SKU-1002', name: '云南蓝莓 125g', quantity: 48 },
    ],
  },
  {
    id: 'AP-20261121-002',
    type: 'replenishment',
    storeId: 'S003',
    storeName: '浦东店',
    requester: '沈一',
    risk: 'low',
    status: 'pending',
    createdAt: '2026-11-21 08:55',
    items: [{ sku: 'SKU-2001', name: '低脂酸奶 200g', quantity: 36 }],
  },
]

export const initialAudit = [
  {
    id: 'AU-20261121-004',
    timestamp: '2026-11-21 10:42:18',
    actor: '林悦',
    role: '区域经理',
    action: '审批通过补货申请',
    object: 'AP-20261120-014',
    result: 'approved',
    approvalId: 'AP-20261120-014',
  },
  {
    id: 'AU-20261121-003',
    timestamp: '2026-11-21 10:12:06',
    actor: '周然',
    role: '店长',
    action: '提交补货申请',
    object: 'AP-20261121-001',
    result: 'submitted',
    approvalId: 'AP-20261121-001',
  },
  {
    id: 'AU-20261121-002',
    timestamp: '2026-11-21 09:36:44',
    actor: '陈星',
    role: '企业老板',
    action: '查看经营驾驶舱',
    object: '全国经营数据',
    result: 'success',
    approvalId: '—',
  },
  {
    id: 'AU-20261121-001',
    timestamp: '2026-11-21 09:02:11',
    actor: '系统',
    role: '系统任务',
    action: '同步门店销售数据',
    object: '50 家门店',
    result: 'success',
    approvalId: '—',
  },
]

export const agentPrompts = [
  { label: '本周销售', text: '本周销售怎么样？和上周相比有什么变化？' },
  { label: '门店异常', text: '帮我看看哪些门店经营异常，需要重点关注。' },
  { label: '低库存', text: '静安店有哪些商品低于安全库存？' },
  { label: '查商品', text: '搜索商品 有机鲜牛奶' },
  { label: '查采购单', text: '查询采购单' },
  { label: '发起补货', text: '帮我把静安店低于安全库存的商品发起补货申请。' },
]

export function getStore(storeId) {
  return stores.find((store) => store.id === storeId) || null
}

export function getInventoryByStore(storeId) {
  if (!storeId || storeId === 'all') return inventory
  return inventory.filter((item) => item.storeId === storeId)
}

export function inventoryStatus(item) {
  if (item.stock <= 0) return 'out'
  if (item.stock < item.safetyStock) return 'low'
  return 'normal'
}

export function inventoryStatusLabel(item) {
  const status = inventoryStatus(item)
  if (status === 'out') return '缺货'
  if (status === 'low') return '低库存'
  return '正常'
}
