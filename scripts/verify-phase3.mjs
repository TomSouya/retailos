import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { resolveChromePath } from './resolve-chrome.mjs'

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4175'
const chrome = resolveChromePath()
const shots = path.resolve('screenshots')
const downloads = path.join(shots, 'phase3-downloads')
fs.mkdirSync(downloads, { recursive: true })

const errors = []

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function screenshot(page, name) {
  fs.mkdirSync(shots, { recursive: true })
  await page.screenshot({ path: path.join(shots, name) })
}

async function waitForApp(page) {
  await page.waitForSelector('.page-title', { timeout: 20000 })
  await sleep(800)
}

async function loginAs(page, username = 'owner', password = 'retailos123') {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.login-username input', { timeout: 10000 })
  await page.type('.login-username input', username)
  await page.type('.login-password input', password)
  await page.click('.login-submit')
  await waitForApp(page)
}

async function clickText(page, selector, text) {
  return page.evaluate(
    ({ selector, text }) => {
      const element = [...document.querySelectorAll(selector)].find(
        (item) =>
          item.offsetParent !== null &&
          item.textContent.trim().includes(text),
      )
      if (!element) return false
      element.click()
      return true
    },
    { selector, text },
  )
}

async function clickExport(page) {
  const clicked = await clickText(page, '.page-head-actions button', '导出')
  assert(clicked, '未找到导出按钮')
}

async function waitForDownload(existing) {
  const start = Date.now()
  while (Date.now() - start < 20000) {
    const files = fs
      .readdirSync(downloads)
      .filter((name) => !name.endsWith('.crdownload'))
      .filter((name) => !existing.includes(name))
    if (files.length) return files[0]
    await sleep(250)
  }
  throw new Error('下载超时')
}

async function download(page, label) {
  const existing = fs.readdirSync(downloads)
  await clickExport(page)
  const file = await waitForDownload(existing)
  const content = fs.readFileSync(path.join(downloads, file), 'utf8')
  return { label, file, content }
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960 })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  const client = await page.createCDPSession()
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloads,
  })

  await loginAs(page)
  assert(
    (await page.$eval('.page-title', (element) => element.textContent.trim())) ===
      '经营驾驶舱',
    '驾驶舱未加载',
  )

  const kpiCount = await page.$$eval(
    '.metric-primary, .metric-mini',
    (list) => list.length,
  )
  assert(kpiCount === 4, `KPI 数量异常：${kpiCount}`)
  const efficiencyCount = await page.$$eval(
    '.efficiency-item',
    (list) => list.length,
  )
  assert(efficiencyCount === 4, `经营效率指标数量异常：${efficiencyCount}`)
  const rankingRows = await page.$$eval(
    '.ranking-card .el-table__body tr',
    (list) => list.length,
  )
  assert(rankingRows >= 3, `门店排行不足：${rankingRows}`)

  await clickText(page, '.el-radio-button', '本月')
  await sleep(1200)
  const monthLabel = await page.$eval(
    '.trend-card .pill',
    (element) => element.textContent,
  )
  assert(monthLabel.includes('本月'), '驾驶舱未切换到本月')
  await screenshot(page, 'phase3-dashboard.png')

  const exports = []
  exports.push(await download(page, 'dashboard'))

  await page.goto(`${base}/orders`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  exports.push(await download(page, 'orders'))

  await page.goto(`${base}/inventory`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  exports.push(await download(page, 'inventory'))

  await page.goto(`${base}/audit`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  exports.push(await download(page, 'audit'))
  for (const item of exports) {
    assert(item.content.length > 100, `${item.label} CSV 内容过少`)
  }
  assert(
    exports[0].content.includes('RetailOS 经营报表'),
    '驾驶舱 CSV 缺少标题',
  )
  assert(exports[1].content.includes('订单号'), '订单 CSV 缺少表头')
  assert(
    exports[0].content.includes('毛利率') &&
      exports[0].content.includes('售罄率'),
    '驾驶舱 CSV 缺少经营效率指标',
  )
  assert(exports[2].content.includes('SKU'), '库存 CSV 缺少表头')
  assert(exports[3].content.includes('时间'), '审计 CSV 缺少表头')

  await page.goto(`${base}/system`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  const userRows = await page.$$eval(
    '.system-card .el-table__body tr',
    (list) => list.length,
  )
  assert(userRows >= 4, `系统账号行数不足：${userRows}`)
  assert(
    await clickText(page, 'button', '新增账号'),
    '未找到新增账号按钮',
  )
  await page.waitForSelector('.el-dialog', { visible: true, timeout: 8000 })
  await clickText(page, '.el-dialog__footer button', '取消')
  await sleep(500)

  await page.goto(`${base}/stores`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  assert(await clickText(page, 'button', '新增门店'), '未找到新增门店按钮')
  await page.waitForSelector('.el-dialog', { visible: true, timeout: 8000 })
  await clickText(page, '.el-dialog__footer button', '取消')
  await sleep(500)

  await page.goto(`${base}/members`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  assert(await clickText(page, 'button', '新增会员'), '未找到新增会员按钮')
  await page.waitForSelector('.el-dialog', { visible: true, timeout: 8000 })
  await clickText(page, '.el-dialog__footer button', '取消')
  await sleep(500)

  await page.goto(`${base}/inventory`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  const beforeStock = await page.$eval(
    '.inventory-card .el-table__body tr:first-child .stock-value',
    (element) => Number(element.textContent.replace(/[^\d]/g, '')),
  )
  assert(await clickText(page, '.inventory-card button', '调整'), '未找到库存调整按钮')
  await page.waitForSelector('.adjust-dialog', { visible: true, timeout: 8000 })
  await page.click('.adjust-dialog .el-input-number__increase')
  await page.type('.adjust-dialog textarea', 'phase3 inventory check')
  await clickText(page, '.adjust-dialog button', '确认调整')
  await page.waitForFunction(
    () => document.body.innerText.includes('库存已从'),
    { timeout: 15000 },
  )
  await sleep(800)
  const adjustedStock = await page.$eval(
    '.inventory-card .el-table__body tr:first-child .stock-value',
    (element) => Number(element.textContent.replace(/[^\d]/g, '')),
  )
  assert(adjustedStock === beforeStock + 1, '库存调整未生效')

  const sku = await page.$eval(
    '.inventory-card .el-table__body tr td:nth-child(1)',
    (element) => element.textContent.trim(),
  )
  const restoreResponse = await page.evaluate(async (skuCode) => {
    const session = JSON.parse(
      localStorage.getItem('retailos.auth.session') || '{}',
    )
    const response = await fetch(`/api/inventory/${skuCode}/adjust`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        storeId: 'S001',
        delta: -1,
        reason: 'phase3 inventory restore',
      }),
    })
    return { ok: response.ok, body: await response.json() }
  }, sku)
  assert(restoreResponse.ok, '库存恢复失败')

  let draft = await page.evaluate(async () => {
    const session = JSON.parse(
      localStorage.getItem('retailos.auth.session') || '{}',
    )
    const rows = await fetch('/api/purchase-orders?status=draft', {
      headers: { Authorization: `Bearer ${session.token}` },
    }).then((response) => response.json())
    return rows.orders?.[0]?.id || ''
  })

  // 重置后的演示库没有草稿采购单，先通过接口创建一张，保证 Agent 确认卡片路径始终被覆盖
  if (!draft) {
    draft = await page.evaluate(async () => {
      const session = JSON.parse(
        localStorage.getItem('retailos.auth.session') || '{}',
      )
      const created = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          storeId: 'S001',
          supplierId: 'SUP-001',
          note: 'phase3 agent card',
          items: [
            {
              sku: 'SKU-1001',
              name: '有机鲜牛奶 950ml',
              quantity: 2,
              unitPrice: 46,
            },
          ],
        }),
      }).then((response) => response.json())
      return created.id || ''
    })
  }
  assert(draft, '无法准备采购单草稿')

  let agentCardChecked = false
  if (draft) {
    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle2' })
    await waitForApp(page)
    await page.click('.ai-trigger')
    await page.waitForSelector('.composer-box textarea', { timeout: 10000 })
    await page.evaluate(() => {
      const reset = document.querySelector('button[aria-label="新对话"]')
      reset?.click()
    })
    await sleep(600)
    await page.type(
      '.composer-box textarea',
      `帮我提交采购单 ${draft}，生成确认卡片让我确认`,
    )
    await page.click('.send-btn')
    await page.waitForFunction(
      (orderId) =>
        [...document.querySelectorAll('.confirm')].some(
          (card) =>
            card.textContent.includes(orderId) &&
            [...card.querySelectorAll('button')].some((button) =>
              button.textContent.includes('确认提交'),
            ),
        ),
      { timeout: 90000 },
      draft,
    )
    const labels = await page.evaluate((orderId) => {
      const card = [...document.querySelectorAll('.confirm')].find(
        (item) =>
          item.textContent.includes(orderId) &&
          [...item.querySelectorAll('button')].some((button) =>
            button.textContent.includes('确认提交'),
          ),
      )
      return [...card.querySelectorAll('button')].map((button) =>
        button.textContent.trim(),
      )
    }, draft)
    assert(labels.includes('确认提交'), '采购单卡片缺少确认提交按钮')
    await clickText(page, '.confirm button', '取消')
    await page.waitForFunction(
      () => document.body.innerText.includes('已取消'),
      { timeout: 10000 },
    )
    agentCardChecked = true
  }

  await screenshot(page, 'phase3-final.png')
  assert(errors.length === 0, `页面错误：${errors.join(' | ')}`)

  console.log(`KPI ${kpiCount}`)
  console.log(`EFFICIENCY ${efficiencyCount}`)
  console.log(`RANKING ${rankingRows}`)
  console.log(`EXPORTS ${exports.map((item) => item.file).join(', ')}`)
  console.log(`SYSTEM_USERS ${userRows}`)
  console.log(`INVENTORY ${beforeStock} -> ${beforeStock + 1} -> restored`)
  console.log(`AGENT_PO_CARD ${agentCardChecked ? draft : 'SKIPPED_NO_DRAFT'}`)
  console.log('PHASE_3 E2E PASS')
} finally {
  await browser.close()
  fs.rmSync(downloads, { recursive: true, force: true })
}
