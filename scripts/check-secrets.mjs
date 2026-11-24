// 密钥扫描：只检查 git 已跟踪的文本文件，命中后仅输出文件与行号，不回显密钥内容。
// 本地用法：npm run check:secrets
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const MAX_BYTES = 2 * 1024 * 1024
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|eot|mp4|mp3|svg)$/i

const RULES = [
  {
    name: 'ModelScope Key',
    pattern:
      /\bms-(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[A-Za-z0-9]{24,})\b/i,
  },
  {
    name: 'OpenAI 风格 Key',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    name: '私钥块',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'AWS Access Key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'GitHub Token',
    pattern: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  {
    name: '非空 LLM_API_KEY',
    pattern: /^\s*LLM_API_KEY\s*=\s*(?!\s*$)(?!\$\{)[^\s#]+/,
  },
  {
    name: '非空 JWT_SECRET',
    pattern: /^\s*JWT_SECRET\s*=\s*(?!\s*$)(?!\$\{)(?!change-me)[^\s#]+/,
  },
]

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const findings = []

for (const file of files) {
  if (BINARY_EXT.test(file)) continue
  const stat = fs.statSync(file)
  if (stat.size > MAX_BYTES) continue

  const text = fs.readFileSync(file, 'utf8')
  if (text.includes('\0')) continue

  text.split(/\r?\n/).forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push(`${file}:${index + 1} [${rule.name}]`)
      }
    }
  })
}

if (findings.length) {
  console.error('SECRET_SCAN FAIL')
  for (const finding of findings) {
    console.error(`  ${finding}`)
  }
  process.exit(1)
}

console.log(`SECRET_SCAN PASS（已检查 ${files.length} 个跟踪文件）`)
