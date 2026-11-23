import { API_BASE_URL } from './config'

let authToken = ''
let currentTraceId = ''

export function setAuthToken(token) {
  authToken = token || ''
}

export function getAuthToken() {
  return authToken
}

export function setCurrentTraceId(traceId) {
  currentTraceId = traceId || ''
}

function authHeaders(extra = {}) {
  return {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(currentTraceId ? { 'X-Trace-Id': currentTraceId } : {}),
    ...extra,
  }
}

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || `请求失败：${response.status}`)
  }
  return body
}

export async function loginRequest(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return parseResponse(response)
}

export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`)
  return parseResponse(response)
}

export async function fetchApprovals() {
  const response = await fetch(`${API_BASE_URL}/api/approvals`, {
    headers: authHeaders(),
  })
  const body = await parseResponse(response)
  return body.approvals || []
}

export async function createApproval(payload) {
  const response = await fetch(`${API_BASE_URL}/api/approvals`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function decideApproval(id, decision) {
  const response = await fetch(`${API_BASE_URL}/api/approvals/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ decision }),
  })
  return parseResponse(response)
}

export async function fetchAudit() {
  const response = await fetch(`${API_BASE_URL}/api/audit`, {
    headers: authHeaders(),
  })
  const body = await parseResponse(response)
  return body.records || []
}

function queryString(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      search.set(key, String(value))
    }
  })
  const suffix = search.toString()
  return suffix ? `?${suffix}` : ''
}

export async function fetchCategories() {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    headers: authHeaders(),
  })
  const body = await parseResponse(response)
  return body.categories || []
}

export async function createCategory(payload) {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function updateCategory(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function fetchProducts(params = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/products${queryString(params)}`,
    { headers: authHeaders() },
  )
  const body = await parseResponse(response)
  return body.products || []
}

export async function createProduct(payload) {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function updateProduct(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function toggleProduct(id, status) {
  const response = await fetch(
    `${API_BASE_URL}/api/products/${id}/status`,
    {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status }),
    },
  )
  return parseResponse(response)
}

export async function fetchSuppliers() {
  const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
    headers: authHeaders(),
  })
  const body = await parseResponse(response)
  return body.suppliers || []
}

export async function createSupplier(payload) {
  const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function updateSupplier(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function fetchPurchaseOrders(params = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/purchase-orders${queryString(params)}`,
    { headers: authHeaders() },
  )
  const body = await parseResponse(response)
  return body.orders || []
}

export async function createPurchaseOrder(payload) {
  const response = await fetch(`${API_BASE_URL}/api/purchase-orders`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function updatePurchaseOrder(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/purchase-orders/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function transitionPurchaseOrder(id, action) {
  const response = await fetch(
    `${API_BASE_URL}/api/purchase-orders/${id}/${action}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
    },
  )
  return parseResponse(response)
}

export async function fetchSalesOrders(params = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/orders${queryString(params)}`,
    { headers: authHeaders() },
  )
  const body = await parseResponse(response)
  return body.orders || []
}

export async function fetchSalesOrder(id) {
  const response = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
    headers: authHeaders(),
  })
  return parseResponse(response)
}

export async function refundSalesOrder(id, payload = {}) {
  const response = await fetch(`${API_BASE_URL}/api/orders/${id}/refund`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function fetchInventory(params = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/inventory${queryString(params)}`,
    { headers: authHeaders() },
  )
  const body = await parseResponse(response)
  return body.items || []
}

export async function fetchStockMovements(params = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/stock-movements${queryString(params)}`,
    { headers: authHeaders() },
  )
  const body = await parseResponse(response)
  return body.movements || []
}

export async function adjustInventory(sku, payload) {
  const response = await fetch(
    `${API_BASE_URL}/api/inventory/${encodeURIComponent(sku)}/adjust`,
    {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    },
  )
  return parseResponse(response)
}

export async function fetchStores() {
  const response = await fetch(`${API_BASE_URL}/api/stores`, {
    headers: authHeaders(),
  })
  const body = await parseResponse(response)
  return body.stores || []
}

export async function createStore(payload) {
  const response = await fetch(`${API_BASE_URL}/api/stores`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function fetchStore(id) {
  const response = await fetch(`${API_BASE_URL}/api/stores/${id}`, {
    headers: authHeaders(),
  })
  return parseResponse(response)
}

export async function updateStore(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/stores/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function fetchMembers(params = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/members${queryString(params)}`,
    { headers: authHeaders() },
  )
  return parseResponse(response)
}

export async function createMember(payload) {
  const response = await fetch(`${API_BASE_URL}/api/members`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function recalculateMemberPoints() {
  const response = await fetch(`${API_BASE_URL}/api/members/points/recalculate`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return parseResponse(response)
}

export async function fetchMember(id) {
  const response = await fetch(`${API_BASE_URL}/api/members/${id}`, {
    headers: authHeaders(),
  })
  return parseResponse(response)
}

export async function updateMember(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/members/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function fetchDashboard(range = 'week') {
  const response = await fetch(
    `${API_BASE_URL}/api/dashboard${queryString({ range })}`,
    { headers: authHeaders() },
  )
  return parseResponse(response)
}

export async function downloadCsv(path, fallbackName = 'retailos-export.csv') {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `导出失败：${response.status}`)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const matched = disposition.match(/filename="?([^";]+)"?/i)
  const filename = matched?.[1] || fallbackName
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return filename
}

export async function fetchSystemUsers() {
  const response = await fetch(`${API_BASE_URL}/api/system/users`, {
    headers: authHeaders(),
  })
  const body = await parseResponse(response)
  return body.users || []
}

export async function fetchSystemRoles() {
  const response = await fetch(`${API_BASE_URL}/api/system/roles`, {
    headers: authHeaders(),
  })
  return parseResponse(response)
}

export async function createSystemRole(payload) {
  const response = await fetch(`${API_BASE_URL}/api/system/roles`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function updateSystemRole(key, payload) {
  const response = await fetch(
    `${API_BASE_URL}/api/system/roles/${encodeURIComponent(key)}`,
    {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    },
  )
  return parseResponse(response)
}

export async function deleteSystemRole(key) {
  const response = await fetch(
    `${API_BASE_URL}/api/system/roles/${encodeURIComponent(key)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  )
  return parseResponse(response)
}

export async function updateSystemUser(id, payload) {
  const response = await fetch(`${API_BASE_URL}/api/system/users/${id}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function createSystemUser(payload) {
  const response = await fetch(`${API_BASE_URL}/api/system/users`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseResponse(response)
}

export async function resetSystemUserPassword(id, password) {
  const response = await fetch(
    `${API_BASE_URL}/api/system/users/${id}/password`,
    {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password }),
    },
  )
  return parseResponse(response)
}
