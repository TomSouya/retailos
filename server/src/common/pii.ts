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
const DEV_SOURCE = 'dev'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const DECRYPT_FAILED = '[解密失败]'

const keyCache = new Map<string, Buffer>()

function currentSource() {
  return String(process.env.PII_ENCRYPTION_KEY || '').trim()
}

function oldSources() {
  const current = currentSource()
  return String(process.env.PII_ENCRYPTION_OLD_KEYS || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && item !== current)
}

function parseKey(source: string, label: string) {
  const cached = keyCache.get(source)
  if (cached) return cached

  let key: Buffer
  if (!source || source === DEV_SOURCE) {
    // 生产环境由 assertSecureConfig 拒绝空密钥或 dev 哨兵，这里只服务本地开发与测试
    key = createHash('sha256').update(DEV_SECRET).digest()
  } else if (/^[0-9a-fA-F]{64}$/.test(source)) {
    key = Buffer.from(source, 'hex')
  } else {
    key = Buffer.from(source, 'base64')
  }

  if (key.length !== 32) {
    throw new Error(`${label} 必须是 32 字节（64 位 hex 或 base64 编码）`)
  }
  keyCache.set(source, key)
  return key
}

function currentKey() {
  return parseKey(currentSource(), 'PII_ENCRYPTION_KEY')
}

function decryptionKeys() {
  return [
    currentKey(),
    ...oldSources().map((source) =>
      parseKey(source, 'PII_ENCRYPTION_OLD_KEYS'),
    ),
  ]
}

export function isEncryptedPii(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/** AES-256-GCM 加密，格式：enc:v1:<base64(iv|tag|ciphertext)> */
export function encryptPii(plain: string) {
  if (!plain || isEncryptedPii(plain)) return plain
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', currentKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ])
  return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`
}

function tryDecrypt(value: string) {
  if (!isEncryptedPii(value)) return value
  let payload: Buffer
  try {
    payload = Buffer.from(value.slice(PREFIX.length), 'base64')
  } catch {
    return null
  }
  if (payload.length <= IV_LENGTH + TAG_LENGTH) return null

  const iv = payload.subarray(0, IV_LENGTH)
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)

  for (const key of decryptionKeys()) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8')
    } catch {
      // 尝试下一个旧密钥
    }
  }
  return null
}

export function decryptPii(value: string) {
  if (!isEncryptedPii(value)) return value
  const plain = tryDecrypt(value)
  if (plain !== null) return plain

  // 不回显密文或明文，避免密钥错误时二次泄露
  logError('pii_decrypt_failed', {
    message: '当前密钥与旧密钥均无法解密',
  })
  return DECRYPT_FAILED
}

/** 用当前密钥重新加密；解密失败时抛错，避免把占位符写回数据库。 */
export function rotatePiiValue(value: string) {
  if (!value) return value
  if (!isEncryptedPii(value)) return encryptPii(value)
  const plain = tryDecrypt(value)
  if (plain === null) {
    throw new Error('PII 解密失败，请检查 PII_ENCRYPTION_OLD_KEYS')
  }
  return encryptPii(plain)
}

export const piiTransformer: ValueTransformer = {
  to: (value) =>
    value === null || value === undefined || value === ''
      ? value
      : encryptPii(String(value)),
  from: (value) => (typeof value === 'string' ? decryptPii(value) : value),
}

export function assertPiiKeys() {
  if (process.env.NODE_ENV === 'production') {
    if (currentSource() === DEV_SOURCE) {
      throw new Error('生产环境 PII_ENCRYPTION_KEY 不允许使用 dev 哨兵')
    }
    if (oldSources().includes(DEV_SOURCE)) {
      throw new Error('生产环境 PII_ENCRYPTION_OLD_KEYS 不允许使用 dev 哨兵')
    }
  }
  currentKey()
  for (const source of oldSources()) {
    parseKey(source, 'PII_ENCRYPTION_OLD_KEYS')
  }
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
