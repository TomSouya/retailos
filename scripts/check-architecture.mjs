import fs from 'node:fs'
import path from 'node:path'

/**
 * 架构守卫：Agent 层只允许编排业务服务与契约，禁止直接访问数据库。
 * 业务事实（权限、事务、审计、数据）必须留在 NestJS 业务域。
 */
const agentDir = path.resolve('server/src/agent')

const RULES = [
  {
    pattern: /from\s+['"]typeorm['"]/,
    reason: 'Agent 层禁止直接依赖 TypeORM',
  },
  {
    pattern: /from\s+['"][^'"]*database\/entities/,
    reason: 'Agent 层禁止直接引用数据库实体',
  },
  {
    pattern: /from\s+['"][^'"]*data-source/,
    reason: 'Agent 层禁止直接引用 DataSource',
  },
  {
    pattern: /getRepository\s*\(|createQueryBuilder\s*\(/,
    reason: 'Agent 层禁止直接读写数据库',
  },
]

if (!fs.existsSync(agentDir)) {
  console.error(`未找到 Agent 目录：${agentDir}`)
  process.exit(1)
}

const violations = []
for (const file of fs.readdirSync(agentDir)) {
  if (!file.endsWith('.ts')) continue
  const fullPath = path.join(agentDir, file)
  const source = fs.readFileSync(fullPath, 'utf8')
  const lines = source.split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations.push(`${file}:${index + 1} ${rule.reason}`)
      }
    }
  })
}

if (violations.length) {
  console.error('架构守卫失败：Agent 层越过了业务事实层')
  violations.forEach((item) => console.error(`- ${item}`))
  process.exit(1)
}

console.log('ARCH_GUARD PASS：Agent 层未直接访问数据库')
