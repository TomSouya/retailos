import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const shots = path.join(root, 'screenshots')
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
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
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

async function loginAs(page, username = 'owner', password = 'retailos123') {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.login-username input', { timeout: 10000 })
  await page.type('.login-username input', username)
  await page.type('.login-password input', password)
  await page.click('.login-submit')
  await waitForApp(page)
}

async function screenshot(page, name) {
  fs.mkdirSync(shots, { recursive: true })
  await page.screenshot({ path: path.join(shots, name) })
}

async function overflowReport(page) {
  return page.evaluate(() => ({
    vw: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
}

async function clickByText(page, selector, text) {
  const clicked = await page.evaluate(
    ({ selector, text }) => {
      const elements = [...document.querySelectorAll(selector)]
      const target = elements.find(
        (element) =>
          element.offsetParent !== null &&
          element.textContent.trim().includes(text),
      )
      if (!target) return false
      target.click()
      return true
    },
    { selector, text },
  )
  if (!clicked) {
    throw new Error(`Could not find ${selector} containing "${text}"`)
  }
}

async function fillField(page, dialogSelector, label, value) {
  const handle = await page.evaluateHandle(
    ({ dialogSelector, label }) => {
      const dialog = document.querySelector(dialogSelector)
      if (!dialog) return null
      const items = [...dialog.querySelectorAll('.el-form-item')]
      const item = items.find((element) =>
        element
          .querySelector('.el-form-item__label')
          ?.textContent.trim()
          .includes(label),
      )
      return item?.querySelector('input') || null
    },
    { dialogSelector, label },
  )
  const input = handle.asElement()
  if (!input) throw new Error(`Field not found: ${label}`)
  await input.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
  await input.type(String(value))
}

async function confirmDialog(page) {
  await page.waitForSelector('.el-message-box', { timeout: 5000 })
  await page.click('.el-message-box__btns .el-button--primary')
  await new Promise((resolve) => setTimeout(resolve, 900))
}

async function clickRowButton(page, keyword, label) {
  const clicked = await page.evaluate(
    ({ keyword, label }) => {
      const row = [...document.querySelectorAll('.el-table__body tr')].find(
        (element) =>
          element.offsetParent !== null &&
          element.textContent.includes(keyword),
      )
      if (!row) return false
      const button = [...row.querySelectorAll('button')].find(
        (element) => element.textContent.trim() === label,
      )
      if (!button) return false
      button.click()
      return true
    },
    { keyword, label },
  )
  if (!clicked) throw new Error(`未找到 ${keyword} 行的「${label}」按钮`)
}

async function waitRowStatus(page, keyword, status) {
  await page.waitForFunction(
    ({ keyword, status }) => {
      const row = [...document.querySelectorAll('.el-table__body tr')].find(
        (element) =>
          element.offsetParent !== null &&
          element.textContent.includes(keyword),
      )
      return Boolean(row && row.textContent.includes(status))
    },
    { timeout: 10000 },
    { keyword, status },
  )
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  attachDiagnostics(page, 'desktop')

  await loginAs(page)

  await page.goto(`${base}/products`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  const productTitle = await page.$eval('.page-title', (element) =>
    element.textContent.trim(),
  )
  assert(productTitle === '商品管理', '商品页标题不正确')
  await page.waitForSelector('.el-table__body tr', { timeout: 10000 })
  const productRows = await page.$$eval(
    '.el-table__body tr',
    (rows) => rows.length,
  )
  assert(productRows >= 10, `商品行数不足：${productRows}`)
  await screenshot(page, 'products-desktop.png')

  const sku = `SKU-E2E-${String(Date.now()).slice(-5)}`
  const productName = 'E2E 测试商品'
  await page.click('.product-create')
  await page.waitForSelector('.product-dialog', { visible: true })
  await fillField(page, '.product-dialog', 'SKU', sku)
  await fillField(page, '.product-dialog', '商品名称', productName)
  await fillField(page, '.product-dialog', '单位', '盒')
  await fillField(page, '.product-dialog', '单价', '9.9')
  await fillField(page, '.product-dialog', '安全库存', '12')
  await page.click('.product-save')
  await new Promise((resolve) => setTimeout(resolve, 900))

  const productSearch = await page.$('.search-input input')
  await productSearch.click({ clickCount: 3 })
  await productSearch.type(productName)
  await new Promise((resolve) => setTimeout(resolve, 700))
  const productText = await page.$eval(
    '.el-table__body',
    (element) => element.textContent,
  )
  assert(productText.includes(sku), '新增商品未出现在列表中')
  await screenshot(page, 'products-created-desktop.png')

  const categoryId = `CAT-E2E-${String(Date.now()).slice(-5)}`
  await page.click('.category-manage')
  await page.waitForSelector('.category-dialog', { visible: true })
  await page.click('.category-create')
  await page.waitForSelector('.category-form-dialog', { visible: true })
  await fillField(page, '.category-form-dialog', '分类编号', categoryId)
  await fillField(page, '.category-form-dialog', '分类名称', 'E2E 测试分类')
  await page.click('.category-save')
  await new Promise((resolve) => setTimeout(resolve, 800))
  const categoryDialogText = await page.$eval('.category-dialog', (element) =>
    element.textContent,
  )
  assert(categoryDialogText.includes(categoryId), '新增分类未出现在分类列表')
  await screenshot(page, 'products-categories-desktop.png')
  await page.keyboard.press('Escape')
  await new Promise((resolve) => setTimeout(resolve, 500))

  await page.goto(`${base}/stores`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  const storesTitle = await page.$eval('.page-title', (element) =>
    element.textContent.trim(),
  )
  assert(storesTitle === '门店管理', '门店页标题不正确')
  await page.waitForSelector('.el-table__body tr', { timeout: 10000 })
  const storeRows = await page.$$eval(
    '.el-table__body tr',
    (rows) => rows.length,
  )
  assert(storeRows >= 8, `门店行数不足：${storeRows}`)
  await screenshot(page, 'stores-desktop.png')

  await page.goto(`${base}/members`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  const membersTitle = await page.$eval('.page-title', (element) =>
    element.textContent.trim(),
  )
  assert(membersTitle === '会员管理', '会员页标题不正确')
  await page.waitForSelector('.el-table__body tr', { timeout: 10000 })
  const memberRows = await page.$$eval(
    '.el-table__body tr',
    (rows) => rows.length,
  )
  assert(memberRows >= 8, `会员行数不足：${memberRows}`)
  await screenshot(page, 'members-desktop.png')

  await page.goto(`${base}/procurement`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  const procurementTitle = await page.$eval('.page-title', (element) =>
    element.textContent.trim(),
  )
  assert(procurementTitle === '采购管理', '采购页标题不正确')
  await page.waitForSelector('.el-table__body tr', { timeout: 10000 })
  const poRows = await page.$$eval(
    '.el-table__body tr',
    (rows) => rows.length,
  )
  assert(poRows >= 3, `采购单行数不足：${poRows}`)
  await screenshot(page, 'procurement-desktop.png')

  await page.click('.po-create')
  await page.waitForSelector('.po-dialog', { visible: true })
  await page.click('.po-item-editor-row .item-product .el-select__wrapper')
  await new Promise((resolve) => setTimeout(resolve, 300))
  await page.keyboard.press('ArrowDown')
  await new Promise((resolve) => setTimeout(resolve, 200))
  await page.keyboard.press('Enter')
  await new Promise((resolve) => setTimeout(resolve, 300))
  await clickByText(page, '.po-item-editor-row button', '添加')
  await page.waitForSelector('.po-draft-item', { timeout: 5000 })
  await page.click('.po-save')
  await new Promise((resolve) => setTimeout(resolve, 900))
  const poText = await page.$eval(
    '.el-table__body',
    (element) => element.textContent,
  )
  assert(poText.includes('草稿'), '新建采购单未显示草稿状态')
  await screenshot(page, 'procurement-created-desktop.png')

  const supplierId = `SUP-E2E-${String(Date.now()).slice(-5)}`
  await page.click('.supplier-manage')
  await page.waitForSelector('.supplier-dialog', { visible: true })
  await page.click('.supplier-create')
  await page.waitForSelector('.supplier-form-dialog', { visible: true })
  await fillField(page, '.supplier-form-dialog', '供应商编号', supplierId)
  await fillField(page, '.supplier-form-dialog', '供应商名称', 'E2E 测试供应商')
  await fillField(page, '.supplier-form-dialog', '联系人', '测试联系人')
  await fillField(page, '.supplier-form-dialog', '联系电话', '13800001234')
  await page.click('.supplier-save')
  await new Promise((resolve) => setTimeout(resolve, 800))
  const supplierDialogText = await page.$eval('.supplier-dialog', (element) =>
    element.textContent,
  )
  assert(
    supplierDialogText.includes(supplierId),
    '新增供应商未出现在供应商列表',
  )
  await screenshot(page, 'procurement-suppliers-desktop.png')
  await page.keyboard.press('Escape')
  await new Promise((resolve) => setTimeout(resolve, 500))

  await clickByText(page, '.el-table__body button', '提交')
  await confirmDialog(page)
  const poSubmittedText = await page.$eval(
    '.el-table__body',
    (element) => element.textContent,
  )
  assert(poSubmittedText.includes('待审批'), '采购单提交后未进入待审批')
  await screenshot(page, 'procurement-submitted-desktop.png')

  const submittedRowText = await page.$eval('.el-table__body tr', (element) =>
    element.textContent,
  )
  const poMatched = submittedRowText.match(/PO-\d{8}-\d+/)
  assert(poMatched, '未找到新建采购单号')
  const poId = poMatched[0]

  await clickRowButton(page, poId, '审批')
  await confirmDialog(page)
  await waitRowStatus(page, poId, '已通过')

  await clickRowButton(page, poId, '验收')
  await confirmDialog(page)
  await waitRowStatus(page, poId, '已入库')
  await screenshot(page, 'procurement-received-desktop.png')

  await page.goto(`${base}/inventory`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  const inventoryTitle = await page.$eval('.page-title', (element) =>
    element.textContent.trim(),
  )
  assert(inventoryTitle === '库存管理', '库存页标题不正确')

  await clickByText(page, '.el-tabs__item', '库存流水')
  await new Promise((resolve) => setTimeout(resolve, 600))
  await page.waitForFunction(
    (keyword) =>
      [...document.querySelectorAll('.el-table__body tr')].some(
        (element) =>
          element.offsetParent !== null &&
          element.textContent.includes(keyword),
      ),
    { timeout: 10000 },
    poId,
  )

  const movement = await page.evaluate((keyword) => {
    const row = [...document.querySelectorAll('.el-table__body tr')].find(
      (element) =>
        element.offsetParent !== null && element.textContent.includes(keyword),
    )
    if (!row) return null
    return {
      cells: [...row.querySelectorAll('td')].map((cell) =>
        cell.textContent.trim(),
      ),
    }
  }, poId)
  assert(movement, '库存流水未出现采购入库记录')
  assert(movement.cells[3].includes('采购入库'), '流水类型应为采购入库')
  const receivedQty = Number(movement.cells[4].replace(/[^\d-]/g, ''))
  const beforeStock = Number(movement.cells[5].replace(/[^\d-]/g, ''))
  const afterStock = Number(movement.cells[6].replace(/[^\d-]/g, ''))
  assert(receivedQty === 12, `入库数量应为 12，实际 ${receivedQty}`)
  assert(
    afterStock === beforeStock + receivedQty,
    `流水库存不连续：${beforeStock} + ${receivedQty} != ${afterStock}`,
  )
  const inventorySku = movement.cells[2].match(/SKU-[A-Za-z0-9-]+/)?.[0]
  assert(inventorySku, '库存流水缺少 SKU')
  await screenshot(page, 'inventory-movements-desktop.png')

  await clickByText(page, '.el-tabs__item', '库存明细')
  await new Promise((resolve) => setTimeout(resolve, 400))
  const inventorySearch = await page.$('.search-input input')
  await inventorySearch.click({ clickCount: 3 })
  await page.keyboard.press('Backspace')
  await inventorySearch.type(inventorySku)
  await new Promise((resolve) => setTimeout(resolve, 600))
  const detailStock = await page.evaluate((sku) => {
    const row = [...document.querySelectorAll('.el-table__body tr')].find(
      (element) =>
        element.offsetParent !== null &&
        element.textContent.includes(sku),
    )
    if (!row) return null
    return row.querySelector('.stock-value')?.textContent.trim() || ''
  }, inventorySku)
  assert(detailStock !== null, '库存明细未找到入库商品')
  assert(
    Number(detailStock.replace(/[^\d]/g, '')) === afterStock,
    `库存明细 ${detailStock} 与流水变动后 ${afterStock} 不一致`,
  )

  await page.goto(`${base}/orders`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  const orderTitle = await page.$eval('.page-title', (element) =>
    element.textContent.trim(),
  )
  assert(orderTitle === '订单管理', '订单页标题不正确')
  await page.waitForSelector('.el-table__body tr', { timeout: 10000 })
  const orderRows = await page.$$eval(
    '.el-table__body tr',
    (rows) => rows.length,
  )
  assert(orderRows >= 6, `订单行数不足：${orderRows}`)
  await screenshot(page, 'orders-desktop.png')

  await clickByText(page, '.el-table__body button', '详情')
  await page.waitForSelector('.order-detail', { visible: true })
  await new Promise((resolve) => setTimeout(resolve, 400))
  const detailId = await page.$eval('.order-detail-id', (element) =>
    element.textContent.trim(),
  )
  assert(detailId.startsWith('SO-'), '订单详情缺少订单号')
  await screenshot(page, 'order-detail-desktop.png')

  await page.keyboard.press('Escape')
  await new Promise((resolve) => setTimeout(resolve, 600))

  await page.click('.ai-trigger')
  await page.waitForSelector('.agent-shell', { visible: true, timeout: 8000 })
  await page.waitForSelector('.composer-box textarea', { visible: true })
  await page.type('.composer-box textarea', '查询采购单')
  await page.click('.send-btn')
  await page.waitForSelector('.generated-view', { timeout: 20000 })
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const agentText = await page.$eval('.generated-view', (element) =>
    element.textContent,
  )
  assert(agentText.includes('采购单查询结果'), '助手应返回采购单查询卡片')
  assert(agentText.includes(poId), '助手采购单结果应包含刚验收的采购单')
  const agentToolCount = await page.$$eval(
    '.tool-card.is-succeeded',
    (elements) => elements.length,
  )
  assert(agentToolCount >= 1, '助手应至少成功调用一个工具')
  await screenshot(page, 'agent-purchase-query-desktop.png')

  await page.keyboard.press('Escape')
  await new Promise((resolve) => setTimeout(resolve, 700))

  await page.evaluate(() => {
    const select = [...document.querySelectorAll('.page-head-actions .filter-select')][1]
    select?.querySelector('.el-select__wrapper')?.click()
  })
  await new Promise((resolve) => setTimeout(resolve, 400))
  const paidFilterSelected = await page.evaluate(() => {
    const option = [...document.querySelectorAll('.el-select-dropdown__item')].find(
      (item) => item.textContent.trim() === '已支付',
    )
    if (!option) return false
    option.click()
    return true
  })
  assert(paidFilterSelected, '未找到已支付筛选选项')
  await new Promise((resolve) => setTimeout(resolve, 700))

  const refundTarget = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.el-table__body tr')].filter(
      (row) => row.offsetParent !== null && row.textContent.includes('已支付'),
    )
    for (const row of rows) {
      const button = [...row.querySelectorAll('button')].find(
        (element) => element.textContent.trim() === '退款',
      )
      if (button) {
        const orderId = row.querySelector('td')?.textContent?.trim() || ''
        button.click()
        return orderId
      }
    }
    return ''
  })
  assert(refundTarget, '未找到可退款订单')

  await page.waitForSelector('.refund-dialog', { visible: true })
  await page.evaluate(() => {
    const input = document.querySelector('.refund-form .el-input-number input')
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    ).set
    setter.call(input, '5')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.type('.refund-form textarea', 'E2E 退款流程验证')
  await page.click('.refund-submit')
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const refundMessage = await page
    .$eval('.el-message', (element) => element.textContent)
    .catch(() => '')
  assert(refundMessage.includes('退款申请已提交'), '退款申请未提交')

  await page.goto(`${base}/inventory`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  await clickByText(page, '.el-tabs__item', '待审批')
  await new Promise((resolve) => setTimeout(resolve, 800))
  const approvalText = await page.evaluate(() =>
    [...document.querySelectorAll('.el-table__body')]
      .filter((table) => table.offsetParent !== null)
      .map((table) => table.textContent)
      .join(' '),
  )
  assert(approvalText.includes('退款'), '退款审批未出现在待审批列表')
  await screenshot(page, 'inventory-refund-approval-desktop.png')

  const refundApproved = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.el-table__body tr')].find(
      (element) =>
        element.offsetParent !== null && element.textContent.includes('退款'),
    )
    if (!row) return false
    const button = [...row.querySelectorAll('button')].find(
      (element) => element.textContent.trim() === '通过',
    )
    if (!button) return false
    button.click()
    return true
  })
  assert(refundApproved, '未找到退款审批的通过按钮')
  await new Promise((resolve) => setTimeout(resolve, 1200))

  await page.goto(`${base}/orders`, { waitUntil: 'networkidle2' })
  await waitForApp(page)
  await page.type('.orders-page .search-input input', refundTarget)
  await page.waitForFunction(
    (keyword) =>
      document
        .querySelector('.orders-page .el-table__body')
        ?.textContent.includes(keyword),
    { timeout: 10000 },
    refundTarget,
  )
  const ordersText = await page.$eval('.el-table__body', (element) =>
    element.textContent,
  )
  assert(ordersText.includes('部分退款'), '退款审批通过后订单未显示部分退款')
  await screenshot(page, 'orders-partial-refund-desktop.png')

  const mobile = await browser.newPage()
  await mobile.setViewport({ width: 390, height: 844 })
  attachDiagnostics(mobile, 'mobile')
  await mobile.goto(`${base}/products`, { waitUntil: 'networkidle2' })
  await waitForApp(mobile)
  const mobileOverflow = await overflowReport(mobile)
  assert(
    mobileOverflow.docScrollWidth <= 390,
    `移动端商品页溢出：${mobileOverflow.docScrollWidth}`,
  )
  await screenshot(mobile, 'products-mobile.png')

  assert(
    consoleErrors.length === 0,
    `控制台错误：${consoleErrors.join(' | ')}`,
  )

  console.log(`PRODUCT_ROWS ${productRows}`)
  console.log(`PRODUCT_CREATED ${sku}`)
  console.log(`PO_ROWS ${poRows}`)
  console.log(`PO_RECEIVED ${poId}`)
  console.log(
    `INVENTORY ${inventorySku} ${beforeStock} -> ${afterStock} (+${receivedQty})`,
  )
  console.log(`ORDER_ROWS ${orderRows}`)
  console.log(`PLAN_2 E2E PASS`)
} finally {
  await browser.close()
}
