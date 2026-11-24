import { describe, expect, it } from 'vitest'
import { normalizeClientError } from '../src/common/client-error'

describe('normalizeClientError', () => {
  it('保留合法字段并裁剪空白', () => {
    const event = normalizeClientError({
      source: 'vue',
      message: '  渲染失败\n 详情 ',
      stack: 'Error: boom\n    at App.vue:1:1',
      url: 'http://127.0.0.1:4173/orders',
      route: '/orders',
      userAgent: 'Chrome',
      traceId: 'trace-001',
      context: 'render',
      happenedAt: '2026-11-24T08:00:00.000Z',
    })

    expect(event).toEqual({
      source: 'vue',
      message: '渲染失败 详情',
      stack: 'Error: boom\n at App.vue:1:1',
      url: 'http://127.0.0.1:4173/orders',
      route: '/orders',
      userAgent: 'Chrome',
      traceId: 'trace-001',
      context: 'render',
      happenedAt: '2026-11-24T08:00:00.000Z',
    })
  })

  it('缺少 message 或非对象时返回 null', () => {
    expect(normalizeClientError(null)).toBeNull()
    expect(normalizeClientError('boom')).toBeNull()
    expect(normalizeClientError({})).toBeNull()
    expect(normalizeClientError({ message: '   ' })).toBeNull()
  })

  it('未知来源归为 unknown，并限制文本长度', () => {
    const event = normalizeClientError({
      source: 'injected-source',
      message: 'x'.repeat(600),
      stack: 'y'.repeat(5000),
    })

    expect(event?.source).toBe('unknown')
    expect(event?.message).toHaveLength(500)
    expect(event?.stack).toHaveLength(4000)
  })

  it('拒绝不安全的 traceId，非法时间回退到当前时间', () => {
    const event = normalizeClientError({
      message: 'boom',
      traceId: 'bad\nid',
      happenedAt: 'not-a-date',
    })

    expect(event?.traceId).toBeUndefined()
    expect(Number.isNaN(Date.parse(event?.happenedAt || ''))).toBe(false)
  })
})
