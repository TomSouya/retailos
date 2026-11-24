import 'reflect-metadata'
import { config } from 'dotenv'
import { createConnection } from 'mysql2/promise'
import { DataSource } from 'typeorm'
import { ENTITIES } from '../src/database/entities'
import { MIGRATIONS } from '../src/database/migrations'

config()

const host = process.env.DB_HOST || '127.0.0.1'
const port = Number(process.env.DB_PORT || 3306)
const adminUser =
  process.env.DB_ADMIN_USER || process.env.DB_USER || 'retailos'
const adminPassword =
  process.env.DB_ADMIN_PASSWORD ||
  process.env.DB_PASSWORD ||
  'retailos_dev'
const database = `retailos_drill_${Date.now()}`
const REVERT_COUNT = 2

async function migrationCount(dataSource: DataSource) {
  const rows = await dataSource.query(
    'SELECT COUNT(*) AS count FROM migrations',
  )
  return Number(rows[0].count)
}

async function main() {
  const admin = await createConnection({
    host,
    port,
    user: adminUser,
    password: adminPassword,
  })

  try {
    try {
      await admin.query(
        `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      )
    } catch (error) {
      throw new Error(
        `无法创建临时库，请给 ${adminUser} 授予 CREATE/DROP DATABASE 权限，或设置 DB_ADMIN_USER / DB_ADMIN_PASSWORD：${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    const dataSource = new DataSource({
      type: 'mysql',
      host,
      port,
      username: adminUser,
      password: adminPassword,
      database,
      charset: 'utf8mb4',
      timezone: '+08:00',
      entities: ENTITIES,
      migrations: MIGRATIONS,
      synchronize: false,
      logging: false,
    })

    try {
      await dataSource.initialize()

      const applied = await dataSource.runMigrations()
      if (applied.length !== MIGRATIONS.length) {
        throw new Error(
          `迁移数量不一致：执行 ${applied.length}，预期 ${MIGRATIONS.length}`,
        )
      }
      const afterUp = await migrationCount(dataSource)

      let reverted = 0
      for (let index = 0; index < REVERT_COUNT; index += 1) {
        await dataSource.undoLastMigration()
        reverted += 1
      }
      const afterDown = await migrationCount(dataSource)
      if (afterDown !== afterUp - REVERT_COUNT) {
        throw new Error(
          `回滚记录数不正确：${afterUp} -> ${afterDown}，预期减少 ${REVERT_COUNT}`,
        )
      }

      const reapplied = await dataSource.runMigrations()
      const afterReup = await migrationCount(dataSource)
      if (afterReup !== MIGRATIONS.length) {
        throw new Error(
          `重跑迁移后记录数不正确：${afterReup}，预期 ${MIGRATIONS.length}`,
        )
      }

      const tables = await dataSource.query(
        'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ?',
        [database],
      )
      const tableCount = Number(tables[0].count)
      if (tableCount < 10) {
        throw new Error(`迁移后数据表过少：${tableCount}`)
      }

      console.log(
        JSON.stringify({
          ok: true,
          database,
          migrations: MIGRATIONS.length,
          applied: applied.length,
          reverted,
          reapplied: reapplied.length,
          tableCount,
        }),
      )
    } finally {
      if (dataSource.isInitialized) await dataSource.destroy()
    }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``)
    await admin.end()
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      event: 'migration_drill_failed',
      message: error instanceof Error ? error.message : String(error),
    }),
  )
  process.exitCode = 1
})
