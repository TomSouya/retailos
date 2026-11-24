import 'reflect-metadata'
import dataSource from '../src/database/data-source'
import { rotatePiiValue } from '../src/common/pii'

const dryRun = process.argv.includes('--dry-run')
const confirmed = process.argv.includes('--yes')

type MemberRow = { id: string; phone: string }
type SupplierRow = { id: string; contact: string; phone: string }

async function main() {
  if (!String(process.env.PII_ENCRYPTION_KEY || '').trim()) {
    throw new Error('请先设置 PII_ENCRYPTION_KEY，不能使用开发默认密钥轮换')
  }
  if (!dryRun && !confirmed) {
    throw new Error('该命令会重写 PII 密文，请追加 --yes 确认')
  }

  await dataSource.initialize()

  const members = (await dataSource.query(
    'SELECT id, phone FROM members',
  )) as MemberRow[]
  let memberUpdates = 0
  let memberFailures = 0
  for (const row of members) {
    if (!row.phone) continue
    try {
      const next = rotatePiiValue(row.phone)
      if (next === row.phone) continue
      memberUpdates += 1
      if (!dryRun) {
        await dataSource.query('UPDATE members SET phone = ? WHERE id = ?', [
          next,
          row.id,
        ])
      }
    } catch {
      memberFailures += 1
    }
  }

  const suppliers = (await dataSource.query(
    'SELECT id, contact, phone FROM suppliers',
  )) as SupplierRow[]
  let supplierUpdates = 0
  let supplierFailures = 0
  for (const row of suppliers) {
    try {
      const contact = row.contact ? rotatePiiValue(row.contact) : row.contact
      const phone = row.phone ? rotatePiiValue(row.phone) : row.phone
      if (contact === row.contact && phone === row.phone) continue
      supplierUpdates += 1
      if (!dryRun) {
        await dataSource.query(
          'UPDATE suppliers SET contact = ?, phone = ? WHERE id = ?',
          [contact, phone, row.id],
        )
      }
    } catch {
      supplierFailures += 1
    }
  }

  console.log(
    JSON.stringify({
      dryRun,
      members: members.length,
      memberUpdates,
      memberFailures,
      suppliers: suppliers.length,
      supplierUpdates,
      supplierFailures,
    }),
  )

  if (memberFailures || supplierFailures) {
    throw new Error('存在无法解密的记录，请检查 PII_ENCRYPTION_OLD_KEYS')
  }
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'pii_rotate_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    process.exitCode = 1
  })
  .finally(async () => {
    if (dataSource.isInitialized) await dataSource.destroy()
  })
