// 启动期配置校验：生产环境禁止弱 JWT 密钥。
import { logWarn } from './logger'
import { assertPiiKey } from './pii'

const WEAK_SECRETS = new Set([
  'retailos-dev-jwt-secret',
  'retailos-prod-secret',
  'ci-jwt-secret',
  'change-me',
  'secret',
])

export function assertSecureConfig() {
  const secret = String(process.env.JWT_SECRET || '')
  const isProduction = process.env.NODE_ENV === 'production'

  const piiKey = String(process.env.PII_ENCRYPTION_KEY || '').trim()
  if (!piiKey) {
    if (isProduction) {
      throw new Error(
        '生产环境必须配置 PII_ENCRYPTION_KEY（32 字节 hex 或 base64）',
      )
    }
    logWarn('config_warning', {
      message: '未配置 PII_ENCRYPTION_KEY，使用开发默认密钥',
    })
  } else {
    assertPiiKey()
  }

  if (!secret) {
    if (isProduction) {
      throw new Error('生产环境必须配置 JWT_SECRET（至少 32 位随机字符串）')
    }
    logWarn('config_warning', {
      message: '未配置 JWT_SECRET，当前使用开发默认值',
    })
    return
  }

  const weak = secret.length < 32 || WEAK_SECRETS.has(secret)
  if (!weak) return

  if (isProduction) {
    throw new Error(
      '生产环境 JWT_SECRET 至少 32 位，且不能使用默认或示例值',
    )
  }
  logWarn('config_warning', {
    message: 'JWT_SECRET 过弱，仅限本地开发使用',
  })
}
