// 先启动开发服务器：npm run dev -- --port 4173
// 若 4173 被占用，Vite 会顺延到 4174；本脚本默认使用 4174。
// 使用其他端口时：$env:E2E_BASE_URL="http://127.0.0.1:5173"; node scripts/verify.mjs
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { resolveChromePath } from './resolve-chrome.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const shots = path.join(root, 'screenshots')
const chrome = resolveChromePath()
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:4174'

const consoleErrors = []

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`)
}

function attachDiagnostics(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(`[${label}] console: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(`[${label}] pageerror: ${error.message}`)
  })
}

async function waitForApp(page) {
  await page.waitForSelector('.page-title', { timeout: 15000 })
  await new Promise((resolve) => setTimeout(resolve, 1200))
}

async function overflowReport(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const all = [...document.querySelectorAll('*')]
    const overflowing = all
      .map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          tag: el.tagName,
          cls: typeof el.className === 'string' ? el.className.slice(0, 100) : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter((item) => item.right > vw + 1 || item.left < -1)
      .slice(0, 20)

    return {
      vw,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflowing,
    }
  })
}

async function clickByText(page, selector, text) {
  const clicked = await page.evaluate(
    ({ selector, text }) => {
      const elements = [...document.querySelectorAll(selector)]
      const target = elements.find((element) =>
        element.textContent.trim().includes(text),
      )
      if (!target) return false
      target.click()
      return true
    },
    { selector, text },
  )
  if (!clicked) throw new Error(`Could not find ${selector} containing "${text}"`)
}

async function loginAs(page, username = 'owner', password = 'retailos123') {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.login-username input', { timeout: 10000 })
  await page.type('.login-username input', username)
  await page.type('.login-password input', password)
  await page.click('.login-submit')
  await waitForApp(page)
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  defaultViewport: null,
})

try {
  const desktop = await browser.newPage()
  attachDiagnostics(desktop, 'desktop')
  await desktop.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 })
  await loginAs(desktop)
  const ownerTitle = await desktop.$eval('.page-title', (el) => el.textContent.trim())
  assert(ownerTitle === '经营驾驶舱', '企业老板应进入经营驾驶舱')
  await desktop.screenshot({ path: path.join(shots, 'dashboard-desktop.png') })
  const desktopOverflow = await overflowReport(desktop)
  console.log('DESKTOP_OVERFLOW', JSON.stringify(desktopOverflow, null, 2))
  assert(
    desktopOverflow.docScrollWidth === desktopOverflow.vw,
    '桌面端页面不应横向溢出',
  )

  await desktop.click('.ai-trigger')
  await desktop.waitForSelector('.agent-shell', { visible: true, timeout: 8000 })
  await new Promise((resolve) => setTimeout(resolve, 500))
  await desktop.screenshot({ path: path.join(shots, 'agent-welcome-desktop.png') })

  await clickByText(desktop, '.welcome-card', '本周销售')
  await desktop.waitForSelector('.generated-view', { timeout: 20000 })
  await new Promise((resolve) => setTimeout(resolve, 1200))
  await desktop.screenshot({ path: path.join(shots, 'agent-sales-desktop.png') })

  const succeededTools = await desktop.$$eval(
    '.tool-card.is-succeeded',
    (elements) => elements.length,
  )
  assert(succeededTools >= 2, '销售场景应至少完成两个工具')
  const generatedText = await desktop.$eval(
    '.generated-view',
    (element) => element.textContent,
  )
  assert(
    generatedText.includes('销售额') &&
      (generatedText.includes('门店排行') ||
        generatedText.includes('销售趋势')),
    '销售结果应包含销售额，并展示门店排行或销售趋势',
  )

  await clickByText(desktop, '.prompt-chip', '查采购单')
  await desktop.waitForFunction(
    () =>
      [...document.querySelectorAll('.generated-view')].some((element) =>
        element.textContent.includes('采购单查询结果'),
      ),
    { timeout: 20000 },
  )
  await desktop.screenshot({
    path: path.join(shots, 'agent-purchase-mock.png'),
  })

  await clickByText(desktop, '.prompt-chip', '发起补货')
  await desktop.waitForSelector('.approval', { timeout: 20000 })
  await new Promise((resolve) => setTimeout(resolve, 1500))
  await desktop.screenshot({ path: path.join(shots, 'agent-approval-desktop.png') })

  await desktop.click('.approval-actions .el-button--primary')
  await new Promise((resolve) => setTimeout(resolve, 800))
  const approvalState = await desktop.$eval('.approval-state', (el) => el.textContent.trim())
  console.log('APPROVAL_STATE', approvalState)
  assert(approvalState.includes('已提交'), '审批卡应变为已提交')

  await desktop.goto(`${base}/inventory`, { waitUntil: 'domcontentloaded' })
  await waitForApp(desktop)
  await clickByText(desktop, '.el-tabs__item', '待审批')
  await new Promise((resolve) => setTimeout(resolve, 600))
  await desktop.screenshot({ path: path.join(shots, 'inventory-approvals-desktop.png') })
  const pendingRows = await desktop.$$eval(
    '.el-tab-pane:not([style*="display: none"]) .el-table__body tr',
    (rows) => rows.length,
  )
  console.log('PENDING_ROWS', pendingRows)
  assert(pendingRows >= 3, '待审批列表应包含新提交的补货申请')

  await desktop.goto(`${base}/audit`, { waitUntil: 'domcontentloaded' })
  await waitForApp(desktop)
  await new Promise((resolve) => setTimeout(resolve, 600))
  await desktop.screenshot({ path: path.join(shots, 'audit-desktop.png') })
  const auditRows = await desktop.$$eval(
    '.el-table__body tr',
    (rows) => rows.length,
  )
  console.log('AUDIT_ROWS', auditRows)
  assert(auditRows >= 4, '审计页应展示服务端或本地的审计记录')

  const mobile = await browser.newPage()
  attachDiagnostics(mobile, 'mobile')
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  // 新标签页与桌面页共享 localStorage，先清除登录态才能回到登录页
  await mobile.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await mobile.evaluate(() => localStorage.clear())
  await mobile.reload({ waitUntil: 'domcontentloaded' })
  await loginAs(mobile)
  await mobile.screenshot({ path: path.join(shots, 'dashboard-mobile.png') })
  const mobileOverflow = await overflowReport(mobile)
  console.log('MOBILE_OVERFLOW', JSON.stringify(mobileOverflow, null, 2))
  assert(
    mobileOverflow.docScrollWidth === mobileOverflow.vw,
    '移动端页面不应横向溢出',
  )

  await mobile.click('.ai-trigger')
  await mobile.waitForSelector('.agent-shell', { visible: true, timeout: 8000 })
  await new Promise((resolve) => setTimeout(resolve, 500))
  await mobile.screenshot({ path: path.join(shots, 'agent-mobile.png') })

  await mobile.goto(`${base}/inventory`, { waitUntil: 'domcontentloaded' })
  await waitForApp(mobile)
  await new Promise((resolve) => setTimeout(resolve, 600))
  await mobile.screenshot({ path: path.join(shots, 'inventory-mobile.png') })

  const loginMobile = await browser.newPage()
  attachDiagnostics(loginMobile, 'login-mobile')
  await loginMobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await loginMobile.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await loginMobile.evaluate(() => localStorage.clear())
  await loginMobile.reload({ waitUntil: 'domcontentloaded' })
  await loginMobile.waitForSelector('.login-form', { timeout: 10000 })
  await new Promise((resolve) => setTimeout(resolve, 500))
  await loginMobile.screenshot({ path: path.join(shots, 'login-mobile.png') })

  const loginDesktop = await browser.newPage()
  attachDiagnostics(loginDesktop, 'login-desktop')
  await loginDesktop.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await loginDesktop.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await loginDesktop.waitForSelector('.login-form', { timeout: 10000 })
  await new Promise((resolve) => setTimeout(resolve, 500))
  await loginDesktop.screenshot({ path: path.join(shots, 'login-desktop.png') })

  const rbac = await browser.newPage()
  attachDiagnostics(rbac, 'rbac')
  await rbac.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await loginAs(rbac, 'store', 'retailos123')
  await rbac.click('.ai-trigger')
  await rbac.waitForSelector('.agent-shell', { visible: true, timeout: 8000 })
  await rbac.type('.composer-box textarea', '天河店库存和低库存商品')
  await rbac.click('.send-btn')
  await rbac.waitForFunction(
    () => {
      const text = document.querySelector('.agent-list')?.textContent || ''
      return (
        text.includes('静安店') &&
        /(权限|仅限|无权|未返回|无法查看)/.test(text)
      )
    },
    { timeout: 60000 },
  )
  const rbacText = await rbac.$eval(
    '.agent-list',
    (element) => element.textContent,
  )
  assert(
    rbacText.includes('天河店') && rbacText.includes('静安店'),
    '店长跨店查询应说明数据范围仅限本店',
  )
  await rbac.screenshot({ path: path.join(shots, 'agent-rbac-desktop.png') })
} finally {
  await browser.close()
}

assert(consoleErrors.length === 0, `控制台错误：${consoleErrors.join('; ')}`)
console.log('E2E PASS')
