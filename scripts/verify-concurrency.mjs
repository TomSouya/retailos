// 并发一致性验证：并发验收只入库一次、并发审批退款只成功一次。
// 前置：后端运行在 API_BASE（默认 http://127.0.0.1:3000）。
const base = process.env.API_BASE || 'http://127.0.0.1:3000'

let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`)
    return
  }
  failed += 1
  console.error(`FAIL ${message}`)
}

async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json().catch(() => ({}))
  return { status: response.status, body: payload }
}

async function login() {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { username: 'owner', password: 'retailos123' },
  })
  if (result.status !== 201 || !result.body.token) {
    throw new Error(`登录失败：${result.status}`)
  }
  return result.body.token
}

async function inventoryStock(token, sku) {
  const result = await api(
    `/api/inventory?storeId=S001&search=${encodeURIComponent(sku)}`,
    { token },
  )
  const item = (result.body.items || []).find((row) => row.sku === sku)
  return item?.stock
}

async function verifyReceiveIdempotent(token) {
  const created = await api('/api/purchase-orders', {
    method: 'POST',
    token,
    body: {
      storeId: 'S001',
      supplierId: 'SUP-001',
      note: '并发验收验证',
      items: [
        {
          sku: 'SKU-1001',
          name: '有机鲜牛奶 950ml',
          quantity: 2,
          unitPrice: 46,
        },
      ],
    },
  })
  assert(created.status === 201, '并发验收：创建采购单草稿')

  const orderId = created.body.id
  const submitted = await api(`/api/purchase-orders/${orderId}/submit`, {
    method: 'PATCH',
    token,
  })
  assert(submitted.status === 200, '并发验收：提交采购单')

  const approved = await api(`/api/purchase-orders/${orderId}/approve`, {
    method: 'PATCH',
    token,
  })
  assert(approved.status === 200, '并发验收：审批采购单')

  const before = await inventoryStock(token, 'SKU-1001')
  const results = await Promise.all([
    api(`/api/purchase-orders/${orderId}/receive`, { method: 'PATCH', token }),
    api(`/api/purchase-orders/${orderId}/receive`, { method: 'PATCH', token }),
  ])
  const success = results.filter((item) => item.status === 200).length
  const after = await inventoryStock(token, 'SKU-1001')

  assert(success === 1, `并发验收：仅一次成功（实际 ${success} 次）`)
  assert(
    Number(after) - Number(before) === 2,
    `并发验收：库存只增加一次（${before} -> ${after}）`,
  )
}

async function verifyRefundOnce(token) {
  const list = await api('/api/orders?status=paid&page=1&pageSize=50', {
    token,
  })
  const target = (list.body.orders || []).find(
    (order) => Number(order.refundableAmount) >= 1,
  )
  if (!target) {
    console.log('SKIP 并发退款：没有可退款订单')
    return
  }

  const refunded = await api(`/api/orders/${target.id}/refund`, {
    method: 'POST',
    token,
    body: {
      amount: Number(target.refundableAmount),
      reason: '并发退款一致性验证',
    },
  })
  assert(refunded.status === 201, '并发退款：创建退款审批')

  const approvalId = refunded.body.id
  const results = await Promise.all([
    api(`/api/approvals/${approvalId}`, {
      method: 'PATCH',
      token,
      body: { decision: 'approved' },
    }),
    api(`/api/approvals/${approvalId}`, {
      method: 'PATCH',
      token,
      body: { decision: 'approved' },
    }),
  ])
  const success = results.filter((item) => item.status === 200).length
  assert(success === 1, `并发退款：仅一次审批成功（实际 ${success} 次）`)

  const detail = await api(`/api/orders/${target.id}`, { token })
  assert(
    Number(detail.body.refundedAmount) <= Number(detail.body.amount) + 0.001,
    '并发退款：退款金额未超过订单金额',
  )
  assert(
    detail.body.status === 'refunded',
    `并发退款：订单状态为已退款（实际 ${detail.body.status}）`,
  )
}

try {
  const token = await login()
  await verifyReceiveIdempotent(token)
  await verifyRefundOnce(token)
} catch (error) {
  failed += 1
  console.error(`ERROR ${error.message}`)
}

if (failed) {
  console.error(`CONCURRENCY FAIL：${failed} 项`)
  process.exit(1)
}
console.log('CONCURRENCY PASS')
