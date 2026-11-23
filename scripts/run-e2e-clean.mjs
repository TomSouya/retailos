// 在 e2e 前后自动重置演示数据，避免测试单据、审批与库存调整污染演示环境。
// 用法：node scripts/run-e2e-clean.mjs scripts/verify-phase2.mjs
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const serverDir = path.join(root, 'server')
const tsNodeBin = path.join(serverDir, 'node_modules', 'ts-node', 'dist', 'bin.js')

function step(label, args, cwd) {
  console.log(`\n[e2e-clean] ${label}`)
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    const reason = result.signal
      ? `signal ${result.signal}`
      : `exit ${result.status}`
    throw new Error(`${label} 失败（${reason}）`)
  }
}

const target = process.argv[2]
if (!target) {
  console.error('用法：node scripts/run-e2e-clean.mjs scripts/verify.mjs')
  process.exit(1)
}

const targetPath = path.resolve(root, target)
if (!fs.existsSync(targetPath)) {
  console.error(`未找到 e2e 脚本：${targetPath}`)
  process.exit(1)
}

function resetDemoData() {
  step('重置演示数据', [tsNodeBin, 'scripts/reset-demo.ts', '--yes'], serverDir)
}

let failure = null
try {
  resetDemoData()
  step(`执行 ${target}`, [targetPath], root)
} catch (error) {
  failure = error
} finally {
  try {
    resetDemoData()
  } catch (error) {
    if (!failure) failure = error
  }
}

if (failure) {
  console.error(`\n[e2e-clean] ${failure.message}`)
  process.exit(1)
}

console.log('\n[e2e-clean] 测试通过，演示数据已恢复基线。')
