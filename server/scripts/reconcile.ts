// 只读对账：检查订单退款、库存、采购状态与库存流水的一致性。
// 用法：ts-node scripts/reconcile.ts
import dataSource from '../src/database/data-source'

const CHECKS = [
  {
    name: '退款金额超过订单金额',
    sql: `SELECT id, amount, refunded_amount
          FROM sales_orders
          WHERE refunded_amount > amount + 0.001
          LIMIT 20`,
  },
  {
    name: '退款状态与金额不一致',
    sql: `SELECT id, status, amount, refunded_amount
          FROM sales_orders
          WHERE (status = 'refunded' AND refunded_amount + 0.001 < amount)
             OR (status = 'partially_refunded' AND refunded_amount <= 0)
          LIMIT 20`,
  },
  {
    name: '库存为负',
    sql: `SELECT store_id, sku, stock
          FROM inventory_items
          WHERE stock < 0
          LIMIT 20`,
  },
  {
    name: '采购单状态缺少时间戳',
    sql: `SELECT id, status, approved_at, received_at
          FROM purchase_orders
          WHERE (status IN ('approved', 'received') AND approved_at IS NULL)
             OR (status = 'received' AND received_at IS NULL)
          LIMIT 20`,
  },
  {
    name: '库存流水前后值不一致',
    sql: `SELECT id, before_stock, after_stock, quantity
          FROM stock_movements
          WHERE after_stock - before_stock <> quantity
          LIMIT 20`,
  },
]

async function main() {
  const instance = await dataSource.initialize()
  let failed = 0

  try {
    for (const check of CHECKS) {
      const rows: Array<Record<string, unknown>> = await instance.query(
        check.sql,
      )
      if (!rows.length) {
        console.log(`PASS ${check.name}`)
        continue
      }
      failed += 1
      console.error(`FAIL ${check.name}（${rows.length} 条，最多显示 20）`)
      for (const row of rows) {
        console.error(`  ${JSON.stringify(row)}`)
      }
    }
  } finally {
    await instance.destroy()
  }

  if (failed) {
    console.error(`RECONCILE FAIL：${failed} 项不一致`)
    process.exit(1)
  }
  console.log('RECONCILE PASS')
}

main().catch((error) => {
  console.error('RECONCILE ERROR：', error.message)
  process.exit(1)
})
