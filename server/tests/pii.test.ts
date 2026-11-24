import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  decryptPii,
  encryptPii,
  isEncryptedPii,
  maskName,
  maskPhone,
  piiTransformer,
} from '../src/common/pii'

const KEY_A = 'a'.repeat(64)
const KEY_B = 'b'.repeat(64)

describe('PII 加密与脱敏', () => {
  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = KEY_A
  })

  it('AES-GCM 往返一致且每次密文不同', () => {
    const first = encryptPii('13800138000')
    const second = encryptPii('13800138000')
    expect(isEncryptedPii(first)).toBe(true)
    expect(first).not.toBe(second)
    expect(decryptPii(first)).toBe('13800138000')
    expect(decryptPii(second)).toBe('13800138000')
  })

  it('空值与明文原样返回', () => {
    expect(encryptPii('')).toBe('')
    expect(decryptPii('plain')).toBe('plain')
    expect(isEncryptedPii('plain')).toBe(false)
  })

  it('transformer 对读写透明加解密', () => {
    const stored = piiTransformer.to('13800138000', {} as any)
    expect(isEncryptedPii(stored)).toBe(true)
    expect(piiTransformer.from(stored, {} as any)).toBe('13800138000')
  })

  it('密钥不匹配时返回占位符且不抛错', () => {
    const encrypted = encryptPii('secret-value')
    process.env.PII_ENCRYPTION_KEY = KEY_B
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(decryptPii(encrypted)).toBe('[解密失败]')
    errorSpy.mockRestore()
    process.env.PII_ENCRYPTION_KEY = KEY_A
  })

  it('手机号与姓名脱敏', () => {
    expect(maskPhone('13800138000')).toBe('138****8000')
    expect(maskPhone('123')).toBe('***')
    expect(maskPhone('')).toBe('')
    expect(maskName('张三')).toBe('张*')
    expect(maskName('欧阳娜娜')).toBe('欧**')
    expect(maskName('李')).toBe('*')
  })
})
