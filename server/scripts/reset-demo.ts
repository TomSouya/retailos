/**
 * 演示数据重置：清空业务数据后，复用各 Service 的 OnModuleInit 种子恢复演示基线。
 *
 * 保留：users / roles / migrations（4 个演示账号、角色权限与迁移记录）
 * 清空：其余全部业务表（订单、库存、采购、审批、门店、会员、审计等）
 *
 * 用法：npm run reset:demo -- --yes
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import dataSource from '../src/database/data-source'
import { AppModule } from '../src/app.module'

const PRESERVED_TABLES = new Set(['users', 'roles', 'migrations'])

const TABLE_NOTES: Record<string, string> = {
  categories: '商品分类',
  products: '商品',
  suppliers: '供应商',
  purchase_orders: '采购单',
  purchase_order_items: '采购单明细',
  sales_orders: '销售订单',
  sales_order_items: '订单明细',
  inventory_items: '库存',
  stock_movements: '库存流水',
  stores: '门店',
  members: '会员',
  approvals: '审批单',
  approval_items: '审批明细',
  audit_records: '审计记录',
}

function businessTables() {
  return dataSource.entityMetadatas
    .map((meta) => meta.tableName)
    .filter((table) => !PRESERVED_TABLES.has(table))
    .sort()
}

async function countRows(dataSourceRef: DataSource, table: string) {
  const rows = await dataSourceRef.query(
    `SELECT COUNT(*) AS count FROM \`${table}\``,
  )
  return Number(rows?.[0]?.count ?? 0)
}

async function reportCounts(dataSourceRef: DataSource, tables: string[]) {
  const lines: string[] = []
  for (const table of tables) {
    const count = await countRows(dataSourceRef, table)
    lines.push(`  ${table.padEnd(22)} ${String(count).padStart(6)}  ${TABLE_NOTES[table] || ''}`)
  }
  return lines.join('\n')
}

async function truncateBusinessTables(tables: string[]) {
  if (!dataSource.isInitialized) await dataSource.initialize()
  const runner = dataSource.createQueryRunner()
  await runner.connect()
  try {
    // 会话级关闭外键检查，避免明细表与主表互相引用导致 TRUNCATE 失败
    await runner.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const table of tables) {
      await runner.query(`TRUNCATE TABLE \`${table}\``)
    }
  } finally {
    await runner.query('SET FOREIGN_KEY_CHECKS = 1')
    await runner.release()
    await dataSource.destroy()
  }
}

async function main() {
  const confirmed = process.argv.includes('--yes')
  const options = dataSource.options as {
    host?: string
    port?: number
    database?: string
  }

  console.log(
    `目标数据库：${options.host}:${options.port}/${options.database}`,
  )
  console.log(`保留表：${[...PRESERVED_TABLES].join('、')}`)

  if (!confirmed) {
    console.error('\n未执行任何清理：该命令会清空演示业务数据。')
    console.error('确认执行请追加 --yes，例如：npm run reset:demo -- --yes')
    process.exitCode = 1
    return
  }

  console.log('\n重置前数据量：')
  await dataSource.initialize()
  const tables = businessTables()
  console.log(await reportCounts(dataSource, tables))
  await dataSource.destroy()

  console.log('\n正在清空业务表…')
  await truncateBusinessTables(tables)
  console.log(`已清空 ${tables.length} 张表。`)

  console.log('\n正在通过应用种子恢复演示数据…')
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  })
  const seedDataSource = app.get(DataSource)
  console.log('\n重置后数据量：')
  console.log(await reportCounts(seedDataSource, tables))
  console.log(
    `  ${'users'.padEnd(22)} ${String(await countRows(seedDataSource, 'users')).padStart(6)}  演示账号（保留）`,
  )
  console.log(
    `  ${'roles'.padEnd(22)} ${String(await countRows(seedDataSource, 'roles')).padStart(6)}  角色权限（保留）`,
  )
  await app.close()

  console.log('\n演示数据重置完成。')
  console.log(
    '提示：若后端正在运行且期间新建过门店，请重启后端，让内存门店表与数据库重新同步。',
  )
}

main().catch((error) => {
  console.error('\n重置失败：', error)
  process.exitCode = 1
})
