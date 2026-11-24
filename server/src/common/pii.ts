import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import type { ValueTransformer } from 'typeorm'
import { logError } from './logger'

const PREFIX = 'enc:v1:'
const DEV_SECRET = 'retailos-dev-pii-key'
const IV_LENGTH = 12
const TAG_LENGTH = 16

let cachedKey: { source: string; key: Buffer } | null = null

function keyFromEnv() {
  const configured = String(process.env.PII_ENCRYPTION_KEY || '').trim()
  if (cachedKey?.source === configured) return cachedKey.key

  let key: Buffer
  if (!configured) {
    // 生产环境由 assertSecureConfig 拒绝空密钥，这里只服务本地开发与测试
    key = createHash('sha256').update(DEV_SECRET).digest()
  } else if (/^[0-9a-fA-F]{64}$/.test(configured)) {
    key = Buffer.from(configured, 'hex')
  } else {
    key = Buffer.from(configured, 'base64')
  }

  if (key.length !== 32) {
    throw new Error(
      'PII_ENCRYPTION_KEY 必须是 32 字节（64 位 hex 或 base64 编码）',
    )
  }
  cachedKey = { source: configured, key }
  return key
}

export function isEncryptedPii(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/** AES-256-GCM 加密，格式：enc:v1:<base64(iv|tag|ciphertext)> */
export function encryptPii(plain: string) {
  if (!plain || isEncryptedPii(plain)) return plain
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', keyFromEnv(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ])
  return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`
}

export function decryptPii(value: string) {
  if (!isEncryptedPii(value)) return value
  try {
    const payload = Buffer.from(value.slice(PREFIX.length), 'base64')
    const iv = payload.subarray(0, IV_LENGTH)
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = createDecipheriv('aes-256-gcm', keyFromEnv(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8')
  } catch (error) {
    // 不回显密文或明文，避免密钥错误时二次泄露
    logError('pii_decrypt_failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return '[解密失败]'
  }
}

export const piiTransformer: ValueTransformer = {
  to: (value) =>
    value === null || value === undefined || value === ''
      ? value
      : encryptPii(String(value)),
  from: (value) => (typeof value === 'string' ? decryptPii(value) : value),
}

export function assertPiiKey() {
  const probe = 'retailos-pii-probe'
  if (decryptPii(encryptPii(probe)) !== probe) {
    throw new Error('PII_ENCRYPTION_KEY 自检失败，请检查密钥格式')
  }
}

export function maskPhone(value: string) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length < 7) return '*'.repeat(text.length)
  return `${text.slice(0, 3)}****${text.slice(-4)}`
}

export function maskName(value: string) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length === 1) return '*'
  return `${text[0]}${'*'.repeat(Math.min(text.length - 1, 2))}`
}
