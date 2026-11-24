// 轻量安全回归：对运行中的服务做无破坏性探针。
// 覆盖安全头、CORS、JWT 篡改、越权、SQL 注入、异常请求与 PII 脱敏。
const base = process.env.SERVER_BASE_URL || 'http://127.0.0.1:3000'

const failures = []
const passes = []

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function check(name, task) {
  try {
    await task()
    passes.push(name)
    console.log(`PASS ${name}`)
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

async function login(username, password = 'retailos123') {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  assert(response.ok, `登录失败：${username} ${response.status}`)
  const body = await response.json()
  assert(body.token, '登录未返回 token')
  return body.token
}

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health/live`)
      if (response.ok) return
    } catch {
      // 继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`无法连接 ${base}`)
}

await waitForServer()
const ownerToken = await login('owner')
const storeToken = await login('store')
const warehouseToken = await login('warehouse')

await check('安全响应头存在', async () => {
  const response = await fetch(`${base}/api/health/live`)
  assert(
    response.headers.get('x-content-type-options') === 'nosniff',
    '缺少 X-Content-Type-Options',
  )
  assert(response.headers.get('x-frame-options'), '缺少 X-Frame-Options')
  assert(response.headers.get('referrer-policy'), '缺少 Referrer-Policy')
})

await check('未知来源 CORS 被拒绝', async () => {
  const response = await fetch(`${base}/api/health/live`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'GET',
    },
  })
  const allowed = response.headers.get('access-control-allow-origin')
  assert(!allowed || allowed !== 'https://evil.example', '未知来源被允许')
})

await check('白名单来源 CORS 通过', async () => {
  const origin = 'http://127.0.0.1:4173'
  const response = await fetch(`${base}/api/health/live`, {
    headers: { Origin: origin },
  })
  assert(
    response.headers.get('access-control-allow-origin') === origin,
    '白名单来源未返回 CORS 头',
  )
})

await check('未登录访问审批返回 401', async () => {
  const response = await fetch(`${base}/api/approvals`)
  assert(response.status === 401, `实际状态 ${response.status}`)
})

await check('JWT 签名篡改返回 401', async () => {
  const parts = ownerToken.split('.')
  const last = parts[2].slice(-1)
  parts[2] = `${parts[2].slice(0, -1)}${last === 'a' ? 'b' : 'a'}`
  const response = await fetch(`${base}/api/approvals`, {
    headers: auth(parts.join('.')),
  })
  assert(response.status === 401, `实际状态 ${response.status}`)
})

await check('店长跨店查询门店返回 403', async () => {
  const response = await fetch(`${base}/api/stores/S002`, {
    headers: auth(storeToken),
  })
  assert(response.status === 403, `实际状态 ${response.status}`)
})

await check('商品搜索 SQL 注入无效', async () => {
  const baseline = await fetch(`${base}/api/products`, {
    headers: auth(ownerToken),
  }).then((response) => response.json())
  const injected = await fetch(
    `${base}/api/products?search=${encodeURIComponent("' OR '1'='1")}`,
    { headers: auth(ownerToken) },
  ).then((response) => response.json())
  assert(baseline.products.length > 0, '基准商品为空')
  assert(
    injected.products.length < baseline.products.length,
    `注入后返回 ${injected.products.length} 条，疑似注入生效`,
  )
})

await check('订单搜索 SQL 注入无效', async () => {
  const baseline = await fetch(`${base}/api/orders`, {
    headers: auth(ownerToken),
  }).then((response) => response.json())
  const injected = await fetch(
    `${base}/api/orders?search=${encodeURIComponent("' OR '1'='1")}`,
    { headers: auth(ownerToken) },
  ).then((response) => response.json())
  assert(baseline.orders.length > 0, '基准订单为空')
  assert(
    injected.orders.length < baseline.orders.length,
    `注入后返回 ${injected.orders.length} 条，疑似注入生效`,
  )
})

await check('超大请求体返回 413', async () => {
  const response = await fetch(`${base}/api/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'x'.repeat(200_000) }),
  })
  assert(response.status === 413, `实际状态 ${response.status}`)
})

await check('畸形 JSON 不泄露堆栈', async () => {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"username"',
  })
  const text = await response.text()
  assert(response.status === 400, `实际状态 ${response.status}`)
  assert(!/stack|at\s+\w+\s+\(/i.test(text), '响应包含堆栈信息')
})

await check('店长看到的会员手机号已脱敏', async () => {
  const body = await fetch(`${base}/api/members`, {
    headers: auth(storeToken),
  }).then((response) => response.json())
  assert(body.members.length > 0, '会员列表为空')
  assert(
    body.members.every((member) => member.phone.includes('****')),
    '存在未脱敏手机号',
  )
})

await check('老板看到的会员手机号完整', async () => {
  const body = await fetch(`${base}/api/members`, {
    headers: auth(ownerToken),
  }).then((response) => response.json())
  assert(body.members.length > 0, '会员列表为空')
  assert(
    body.members.every((member) => !member.phone.includes('*')),
    '完整手机号仍被脱敏',
  )
})

await check('店长看到的供应商联系方式已脱敏', async () => {
  const body = await fetch(`${base}/api/suppliers`, {
    headers: auth(storeToken),
  }).then((response) => response.json())
  assert(body.suppliers.length > 0, '供应商列表为空')
  assert(
    body.suppliers.every(
      (item) => item.phone.includes('****') && item.contact.includes('*'),
    ),
    '供应商联系方式未脱敏',
  )
})

await check('仓库看到完整供应商联系方式', async () => {
  const body = await fetch(`${base}/api/suppliers`, {
    headers: auth(warehouseToken),
  }).then((response) => response.json())
  assert(body.suppliers.length > 0, '供应商列表为空')
  assert(
    body.suppliers.every((item) => !item.phone.includes('*')),
    '仓库应看到完整联系方式',
  )
})

console.log(
  JSON.stringify({
    total: passes.length + failures.length,
    passed: passes.length,
    failed: failures.length,
  }),
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('SECURITY CHECK PASS')
