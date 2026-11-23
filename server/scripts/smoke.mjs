const base = process.env.SERVER_BASE_URL || 'http://127.0.0.1:3000'

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.ok) return
    } catch {
      // 服务尚未启动，继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`无法连接 ${base}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`)
}

async function login(username, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(10000),
  })
  assert(response.ok, `${username} 登录失败：${response.status}`)
  const body = await response.json()
  assert(body.token, `${username} 未返回 token`)
  return body.token
}

async function streamAgent(text, token) {
  const response = await fetch(`${base}/api/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(30000),
  })

  assert(response.ok, `stream 返回 ${response.status}`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('')
      if (data) events.push(JSON.parse(data))
    }
  }

  return events
}

await waitForServer()

const unauth = await fetch(`${base}/api/approvals`)
assert(unauth.status === 401, '未登录访问审批应返回 401')

const badLogin = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'owner', password: 'wrong-password' }),
})
assert(badLogin.status === 401, '错误密码应返回 401')

const ownerToken = await login('owner', 'retailos123')
const regionalToken = await login('regional', 'retailos123')
const storeToken = await login('store', 'retailos123')
const warehouseToken = await login('warehouse', 'retailos123')

const results = []

const salesEvents = await streamAgent('本周销售怎么样？', ownerToken)
const salesTypes = salesEvents.map((event) => event.type)
assert(salesTypes.includes('RUN_STARTED'), '销售流缺少 RUN_STARTED')
assert(
  salesEvents.some(
    (event) =>
      event.type === 'TOOL_CALL_RESULT' && event.status === 'succeeded',
  ),
  '销售流没有成功的工具调用',
)
assert(
  salesEvents.some((event) => event.type === 'TEXT_MESSAGE_END' && event.ui),
  '销售流缺少 UI Schema',
)
assert(salesTypes.includes('RUN_FINISHED'), '销售流缺少 RUN_FINISHED')
results.push(`sales: ${salesTypes.length} events`)

const rbacEvents = await streamAgent('天河店库存和低库存商品', storeToken)
const failedTool = rbacEvents.find(
  (event) =>
    event.type === 'TOOL_CALL_RESULT' && event.status === 'failed',
)
const runError = rbacEvents.find((event) => event.type === 'RUN_ERROR')
assert(Boolean(failedTool), '跨店调用应出现失败工具')
assert(Boolean(runError), '跨店调用应返回 RUN_ERROR')
assert(
  String(runError.message).includes('店长只能访问本店数据'),
  '错误信息应说明门店范围限制',
)
results.push(`rbac: ${runError.message}`)

function toolOutput(events, name) {
  const start = events.find(
    (event) => event.type === 'TOOL_CALL_START' && event.name === name,
  )
  if (!start) return null
  return (
    events.find(
      (event) =>
        event.type === 'TOOL_CALL_RESULT' &&
        event.toolCallId === start.toolCallId,
    ) || null
  )
}

const productEvents = await streamAgent('搜索商品 有机鲜牛奶', ownerToken)
const productTool = toolOutput(productEvents, 'search_products')
assert(Boolean(productTool), '商品查询未调用 search_products')
assert(productTool.status === 'succeeded', '商品查询工具应成功')
assert(
  productTool.output.rows.some((row) => row.id === 'SKU-1001'),
  '商品查询应返回 SKU-1001',
)
results.push(`products: ${productTool.output.total} hits`)

const purchaseEvents = await streamAgent('查询采购单', ownerToken)
const purchaseTool = toolOutput(purchaseEvents, 'list_purchase_orders')
assert(Boolean(purchaseTool), '采购查询未调用 list_purchase_orders')
assert(purchaseTool.status === 'succeeded', '采购查询工具应成功')
assert(
  purchaseTool.output.rows.length > 0,
  '采购查询应返回采购单列表',
)
results.push(
  `purchase: ${purchaseTool.output.total} orders, ${purchaseTool.output.summary.received} received`,
)

const orderEvents = await streamAgent('查询销售订单', ownerToken)
const orderTool = toolOutput(orderEvents, 'list_sales_orders')
assert(Boolean(orderTool), '订单查询未调用 list_sales_orders')
assert(orderTool.status === 'succeeded', '订单查询工具应成功')
assert(orderTool.output.rows.length > 0, '订单查询应返回订单列表')
results.push(`orders: ${orderTool.output.total} orders`)

const forbiddenEvents = await streamAgent('查询销售订单', warehouseToken)
const forbiddenError = forbiddenEvents.find(
  (event) => event.type === 'RUN_ERROR',
)
assert(Boolean(forbiddenError), '仓库角色查询销售订单应返回 RUN_ERROR')
assert(
  String(forbiddenError.message).includes('无权'),
  '拒绝原因应说明角色权限',
)
results.push('agent rbac: warehouse cannot query sales orders')

const listResponse = await fetch(`${base}/api/approvals`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
assert(listResponse.ok, '审批列表请求失败')
const listBody = await listResponse.json()
assert(listBody.approvals.length >= 2, '初始审批数量不足')

const createResponse = await fetch(`${base}/api/approvals`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${storeToken}`,
  },
  body: JSON.stringify({
    storeId: 'S001',
    risk: 'medium',
    summary: '为静安店创建 1 个 SKU 的补货申请',
    items: [{ sku: 'SKU-1001', name: '有机鲜牛奶 950ml', quantity: 24 }],
  }),
})
assert(createResponse.ok, `创建审批失败：${createResponse.status}`)
const created = await createResponse.json()
assert(created.status === 'pending', '新审批应为 pending')

const approveResponse = await fetch(`${base}/api/approvals/${created.id}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${regionalToken}`,
  },
  body: JSON.stringify({ decision: 'approved' }),
})
assert(approveResponse.ok, `审批失败：${approveResponse.status}`)
const approved = await approveResponse.json()
assert(approved.status === 'approved', '审批后状态应为 approved')
results.push(`approval: ${created.id} -> ${approved.status}`)

const auditResponse = await fetch(`${base}/api/audit`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
assert(auditResponse.ok, '审计列表请求失败')
const auditBody = await auditResponse.json()
assert(auditBody.records.length > 4, '审计记录应包含新增操作')
results.push(`audit: ${auditBody.records.length} records`)

const productListResponse = await fetch(`${base}/api/products`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
assert(productListResponse.ok, '商品列表请求失败')
const productList = await productListResponse.json()
assert(productList.products.length >= 10, '初始商品数量不足')
results.push(`products: ${productList.products.length}`)

const testSku = `SKU-TEST-${String(Date.now()).slice(-6)}`
const createProductResponse = await fetch(`${base}/api/products`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  },
  body: JSON.stringify({
    id: testSku,
    name: '测试商品',
    category: '零食',
    price: 12.5,
    unit: '盒',
    safetyStock: 10,
  }),
})
assert(createProductResponse.ok, `新增商品失败：${createProductResponse.status}`)
const createdProduct = await createProductResponse.json()
assert(createdProduct.id === testSku, '新增商品 SKU 不一致')

const updateProductResponse = await fetch(
  `${base}/api/products/${testSku}`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ name: '测试商品（已编辑）', price: 13.5 }),
  },
)
assert(updateProductResponse.ok, '编辑商品失败')
const updatedProduct = await updateProductResponse.json()
assert(updatedProduct.price === 13.5, '商品价格未更新')

const toggleProductResponse = await fetch(
  `${base}/api/products/${testSku}/status`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ status: 'inactive' }),
  },
)
assert(toggleProductResponse.ok, '商品上下架失败')
const toggledProduct = await toggleProductResponse.json()
assert(toggledProduct.status === 'inactive', '商品状态未更新')

const searchProductResponse = await fetch(
  `${base}/api/products?search=${encodeURIComponent('测试商品')}`,
  { headers: { Authorization: `Bearer ${ownerToken}` } },
)
const searchProductBody = await searchProductResponse.json()
assert(
  searchProductBody.products.some((item) => item.id === testSku),
  '商品搜索未找到新增商品',
)

const forbiddenProduct = await fetch(`${base}/api/products`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${storeToken}`,
  },
  body: JSON.stringify({
    name: '店长不应创建商品',
    category: '零食',
    price: 1,
  }),
})
assert(forbiddenProduct.status === 403, '店长创建商品应返回 403')
results.push(`product: ${testSku} created/updated/toggled`)

const categoryResponse = await fetch(`${base}/api/categories`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
const categoryBody = await categoryResponse.json()
assert(categoryBody.categories.length >= 6, '商品分类数量不足')

const supplierResponse = await fetch(`${base}/api/suppliers`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
const supplierBody = await supplierResponse.json()
assert(supplierBody.suppliers.length >= 3, '供应商数量不足')
results.push(
  `catalog: ${categoryBody.categories.length} categories, ${supplierBody.suppliers.length} suppliers`,
)

const testCategoryId = `CAT-T${String(Date.now()).slice(-5)}`
const createCategoryResponse = await fetch(`${base}/api/categories`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  },
  body: JSON.stringify({ id: testCategoryId, name: '自动化分类', sort: 99 }),
})
assert(createCategoryResponse.ok, '创建分类失败')
const updateCategoryResponse = await fetch(
  `${base}/api/categories/${testCategoryId}`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ name: '自动化分类·改', sort: 98 }),
  },
)
assert(updateCategoryResponse.ok, '更新分类失败')
const updatedCategory = await updateCategoryResponse.json()
assert(updatedCategory.name === '自动化分类·改', '分类名称未更新')

const storeCreateCategory = await fetch(`${base}/api/categories`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${storeToken}`,
  },
  body: JSON.stringify({ name: '店长越权分类' }),
})
assert(storeCreateCategory.status === 403, '店长创建分类应返回 403')

const testSupplierId = `SUP-T${String(Date.now()).slice(-5)}`
const createSupplierResponse = await fetch(`${base}/api/suppliers`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ownerToken}`,
  },
  body: JSON.stringify({
    id: testSupplierId,
    name: '自动化供应商',
    contact: '测试联系人',
    phone: '13800009999',
  }),
})
assert(createSupplierResponse.ok, '创建供应商失败')
const updateSupplierResponse = await fetch(
  `${base}/api/suppliers/${testSupplierId}`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ phone: '13800008888', status: 'inactive' }),
  },
)
assert(updateSupplierResponse.ok, '更新供应商失败')
const updatedSupplier = await updateSupplierResponse.json()
assert(
  updatedSupplier.phone === '13800008888' &&
    updatedSupplier.status === 'inactive',
  '供应商字段未更新',
)

const warehouseCreateSupplier = await fetch(`${base}/api/suppliers`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${warehouseToken}`,
  },
  body: JSON.stringify({
    name: '仓库越权供应商',
    contact: '测试',
    phone: '13800007777',
  }),
})
assert(warehouseCreateSupplier.status === 403, '仓库创建供应商应返回 403')
results.push(
  `catalog write: ${testCategoryId}, ${testSupplierId} created/updated; scope enforced`,
)

const ownerStoresResponse = await fetch(`${base}/api/stores`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
assert(ownerStoresResponse.ok, '门店列表请求失败')
const ownerStoresBody = await ownerStoresResponse.json()
assert(ownerStoresBody.stores.length >= 8, '门店数量不足')

const ownerMembersResponse = await fetch(`${base}/api/members`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
assert(ownerMembersResponse.ok, '会员列表请求失败')
const ownerMembersBody = await ownerMembersResponse.json()
assert(ownerMembersBody.members.length >= 8, '会员数量不足')
assert(
  ownerMembersBody.summary.total === ownerMembersBody.members.length,
  '会员汇总与列表不一致',
)

const regionalStoresResponse = await fetch(`${base}/api/stores`, {
  headers: { Authorization: `Bearer ${regionalToken}` },
})
const regionalStoresBody = await regionalStoresResponse.json()
assert(
  regionalStoresBody.stores.every((store) => store.region === '华东'),
  '区域经理只能看到本区域门店',
)

const storeStoresResponse = await fetch(`${base}/api/stores`, {
  headers: { Authorization: `Bearer ${storeToken}` },
})
assert(storeStoresResponse.status === 403, '店长不应访问门店管理')

const storeMembersResponse = await fetch(`${base}/api/members`, {
  headers: { Authorization: `Bearer ${storeToken}` },
})
const storeMembersBody = await storeMembersResponse.json()
assert(
  storeMembersBody.members.length > 0 &&
    storeMembersBody.members.every((member) => member.storeId === 'S001'),
  '店长只能看到本店会员',
)

const storeMemberPatch = await fetch(`${base}/api/members/MB-0001`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${storeToken}`,
  },
  body: JSON.stringify({ level: 'diamond' }),
})
assert(storeMemberPatch.status === 403, '店长编辑会员应返回 403')
results.push(
  `stores/members: ${ownerStoresBody.stores.length} stores, ${ownerMembersBody.members.length} members; scope enforced`,
)

const poListResponse = await fetch(`${base}/api/purchase-orders`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
assert(poListResponse.ok, '采购单列表请求失败')
const poListBody = await poListResponse.json()
assert(poListBody.orders.length >= 3, '初始采购单数量不足')

const beforeInventoryResponse = await fetch(
  `${base}/api/inventory?storeId=S001&search=SKU-1001`,
  { headers: { Authorization: `Bearer ${ownerToken}` } },
)
assert(beforeInventoryResponse.ok, '验收前库存查询失败')
const beforeInventory = await beforeInventoryResponse.json()
const beforeStock = beforeInventory.items[0]?.stock || 0

const createPoResponse = await fetch(`${base}/api/purchase-orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${warehouseToken}`,
  },
  body: JSON.stringify({
    supplierId: 'SUP-001',
    storeId: 'S001',
    note: 'smoke 采购单',
    items: [
      {
        sku: 'SKU-1001',
        name: '有机鲜牛奶 950ml',
        quantity: 5,
        unitPrice: 60,
      },
    ],
  }),
})
assert(createPoResponse.ok, `创建采购单失败：${createPoResponse.status}`)
const createdPo = await createPoResponse.json()
assert(createdPo.status === 'draft', '新采购单应为草稿')

const submitPoResponse = await fetch(
  `${base}/api/purchase-orders/${createdPo.id}/submit`,
  {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${warehouseToken}` },
  },
)
assert(submitPoResponse.ok, '提交采购单失败')
const submittedPo = await submitPoResponse.json()
assert(submittedPo.status === 'pending', '提交后采购单应为待审批')

const approvePoResponse = await fetch(
  `${base}/api/purchase-orders/${createdPo.id}/approve`,
  {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${regionalToken}` },
  },
)
assert(approvePoResponse.ok, '审批采购单失败')
const approvedPo = await approvePoResponse.json()
assert(approvedPo.status === 'approved', '审批后采购单应为已通过')

const receivePoResponse = await fetch(
  `${base}/api/purchase-orders/${createdPo.id}/receive`,
  {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${warehouseToken}` },
  },
)
assert(receivePoResponse.ok, '采购验收失败')
const receivedPo = await receivePoResponse.json()
assert(receivedPo.status === 'received', '验收后采购单应为已入库')
results.push(
  `purchase-order: ${createdPo.id} draft -> pending -> approved -> received`,
)

const afterInventoryResponse = await fetch(
  `${base}/api/inventory?storeId=S001&search=SKU-1001`,
  { headers: { Authorization: `Bearer ${ownerToken}` } },
)
assert(afterInventoryResponse.ok, '验收后库存查询失败')
const afterInventory = await afterInventoryResponse.json()
const afterStock = afterInventory.items[0]?.stock || 0
assert(
  afterStock === beforeStock + 5,
  `采购验收未正确增加库存：${beforeStock} -> ${afterStock}`,
)

const movementResponse = await fetch(
  `${base}/api/stock-movements?storeId=S001&sku=SKU-1001`,
  { headers: { Authorization: `Bearer ${ownerToken}` } },
)
assert(movementResponse.ok, '库存流水查询失败')
const movementBody = await movementResponse.json()
const receiptMovement = movementBody.movements.find(
  (item) =>
    item.refId === createdPo.id && item.type === 'purchase_received',
)
assert(Boolean(receiptMovement), '验收后缺少采购入库流水')
assert(receiptMovement.quantity === 5, '库存流水数量不正确')
results.push(
  `inventory: SKU-1001 ${beforeStock} -> ${afterStock}, movement ${receiptMovement.id}`,
)

const ordersResponse = await fetch(`${base}/api/orders`, {
  headers: { Authorization: `Bearer ${ownerToken}` },
})
assert(ordersResponse.ok, '销售订单列表请求失败')
const ordersBody = await ordersResponse.json()
assert(ordersBody.orders.length >= 6, '销售订单数量不足')
const firstOrder = ordersBody.orders[0]
const orderDetailResponse = await fetch(
  `${base}/api/orders/${firstOrder.id}`,
  { headers: { Authorization: `Bearer ${ownerToken}` } },
)
assert(orderDetailResponse.ok, '订单详情请求失败')
const orderDetail = await orderDetailResponse.json()
assert(Array.isArray(orderDetail.items), '订单详情缺少明细')
results.push(
  `orders: ${ordersBody.orders.length}, detail items ${orderDetail.items.length}`,
)

const refundOrder = ordersBody.orders.find(
  (order) =>
    order.storeId === 'S001' &&
    ['paid', 'partially_refunded'].includes(order.status) &&
    Number(order.refundableAmount) >= 1,
)
assert(Boolean(refundOrder), '没有可用于退款验证的订单')

const refundResponse = await fetch(
  `${base}/api/orders/${refundOrder.id}/refund`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${storeToken}`,
    },
    body: JSON.stringify({ amount: 1, reason: 'smoke 退款流程验证' }),
  },
)
assert(refundResponse.ok, `退款申请失败：${refundResponse.status}`)
const refundApproval = await refundResponse.json()
assert(refundApproval.type === 'refund', '退款应生成退款审批单')
assert(refundApproval.status === 'pending', '退款申请应为待审批')

const preRefundDetail = await (
  await fetch(`${base}/api/orders/${refundOrder.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  })
).json()
assert(
  Number(preRefundDetail.refundedAmount) ===
    Number(refundOrder.refundedAmount || 0),
  '审批通过前不应发生退款',
)

const overRefund = await fetch(
  `${base}/api/orders/${refundOrder.id}/refund`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${storeToken}`,
    },
    body: JSON.stringify({ amount: 999999, reason: '超额退款' }),
  },
)
assert(overRefund.status === 400, '超过可退金额应返回 400')

const decideRefund = await fetch(
  `${base}/api/approvals/${refundApproval.id}`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ decision: 'approved' }),
  },
)
assert(decideRefund.ok, `退款审批失败：${decideRefund.status}`)

const postRefundDetail = await (
  await fetch(`${base}/api/orders/${refundOrder.id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  })
).json()
assert(
  Math.abs(
    Number(postRefundDetail.refundedAmount) -
      Number(preRefundDetail.refundedAmount) -
      1,
  ) < 0.001,
  '审批通过后应退款 1 元',
)
assert(
  postRefundDetail.status ===
    (Number(postRefundDetail.refundableAmount) > 0
      ? 'partially_refunded'
      : 'refunded'),
  '退款后订单状态不正确',
)
results.push(
  `refund: ${refundOrder.id} ¥1 approved -> ${postRefundDetail.status}`,
)

const storeOrdersResponse = await fetch(`${base}/api/orders`, {
  headers: { Authorization: `Bearer ${storeToken}` },
})
assert(storeOrdersResponse.ok, '店长订单列表请求失败')
const storeOrdersBody = await storeOrdersResponse.json()
assert(
  storeOrdersBody.orders.every((order) => order.storeId === 'S001'),
  '店长只能看到本店订单',
)

const storeInventoryResponse = await fetch(`${base}/api/inventory`, {
  headers: { Authorization: `Bearer ${storeToken}` },
})
assert(storeInventoryResponse.ok, '店长库存请求失败')
const storeInventoryBody = await storeInventoryResponse.json()
assert(
  storeInventoryBody.items.length > 0 &&
    storeInventoryBody.items.every((item) => item.storeId === 'S001'),
  '店长只能看到本店库存',
)

const storeMovementsResponse = await fetch(`${base}/api/stock-movements`, {
  headers: { Authorization: `Bearer ${storeToken}` },
})
assert(storeMovementsResponse.ok, '店长库存流水请求失败')
const storeMovementsBody = await storeMovementsResponse.json()
assert(
  storeMovementsBody.movements.every(
    (movement) => movement.storeId === 'S001',
  ),
  '店长只能看到本店库存流水',
)

results.push(
  'inventory scope: store manager sees own stock and movements only',
)

const storeProductsResponse = await fetch(`${base}/api/products`, {
  headers: { Authorization: `Bearer ${storeToken}` },
})
assert(storeProductsResponse.ok, '店长应可查看商品')

const storePoResponse = await fetch(`${base}/api/purchase-orders`, {
  headers: { Authorization: `Bearer ${storeToken}` },
})
assert(storePoResponse.status === 403, '店长不应访问采购管理')

results.push('scope: store manager sees own store only; procurement denied')

console.log(results.join('\n'))
console.log('SERVER SMOKE PASS')
