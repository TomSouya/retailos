// 审计归档：把 N 天前的审计记录导出为 JSONL，再从库中删除。
// 用法：ts-node scripts/archive-audit.ts --days 90 [--dry-run]
import fs from 'node:fs'
import path from 'node:path'
import dataSource from '../src/database/data-source'

function argValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  return process.argv[index + 1] || fallback
}

async function main() {
  const days = Number(argValue('--days', '90'))
  const dryRun = process.argv.includes('--dry-run')

  if (!Number.isFinite(days) || days < 7) {
    throw new Error('--days 不能小于 7，避免误删近期审计记录')
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const dataSourceInstance = await dataSource.initialize()

  try {
    const rows: Array<Record<string, unknown>> = await dataSourceInstance.query(
      'SELECT * FROM audit_records WHERE timestamp < ? ORDER BY timestamp ASC',
      [cutoff],
    )

    if (!rows.length) {
      console.log(`ARCHIVE EMPTY：${cutoff.toISOString()} 之前没有审计记录`)
      return
    }

    const outputDir = path.resolve(__dirname, '../../backups')
    fs.mkdirSync(outputDir, { recursive: true })
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14)
    const file = path.join(outputDir, `audit-archive-${stamp}.jsonl`)
    fs.writeFileSync(
      file,
      `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
      'utf8',
    )

    if (!dryRun) {
      await dataSourceInstance.query(
        'DELETE FROM audit_records WHERE timestamp < ?',
        [cutoff],
      )
    }

    console.log(
      `${dryRun ? 'DRY_RUN' : 'ARCHIVED'} ${rows.length} 条 -> ${file}`,
    )
  } finally {
    await dataSourceInstance.destroy()
  }
}

main().catch((error) => {
  console.error('ARCHIVE FAIL：', error.message)
  process.exit(1)
})
