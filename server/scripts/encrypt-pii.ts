import 'reflect-metadata'
import dataSource from '../src/database/data-source'
import { encryptPii, isEncryptedPii } from '../src/common/pii'

const dryRun = process.argv.includes('--dry-run')

type MemberRow = { id: string; phone: string }
type SupplierRow = { id: string; contact: string; phone: string }

async function main() {
  await dataSource.initialize()

  const members = (await dataSource.query(
    'SELECT id, phone FROM members',
  )) as MemberRow[]
  let memberUpdates = 0
  for (const row of members) {
    if (!row.phone || isEncryptedPii(row.phone)) continue
    memberUpdates += 1
    if (dryRun) continue
    await dataSource.query('UPDATE members SET phone = ? WHERE id = ?', [
      encryptPii(row.phone),
      row.id,
    ])
  }

  const suppliers = (await dataSource.query(
    'SELECT id, contact, phone FROM suppliers',
  )) as SupplierRow[]
  let supplierUpdates = 0
  for (const row of suppliers) {
    const contact = String(row.contact || '')
    const phone = String(row.phone || '')
    const nextContact = contact && !isEncryptedPii(contact)
      ? encryptPii(contact)
      : contact
    const nextPhone = phone && !isEncryptedPii(phone)
      ? encryptPii(phone)
      : phone
    if (nextContact === contact && nextPhone === phone) continue
    supplierUpdates += 1
    if (dryRun) continue
    await dataSource.query(
      'UPDATE suppliers SET contact = ?, phone = ? WHERE id = ?',
      [nextContact, nextPhone, row.id],
    )
  }

  console.log(
    JSON.stringify({
      dryRun,
      members: members.length,
      memberUpdates,
      suppliers: suppliers.length,
      supplierUpdates,
    }),
  )
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'pii_backfill_failed',
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    process.exitCode = 1
  })
  .finally(async () => {
    if (dataSource.isInitialized) await dataSource.destroy()
  })
