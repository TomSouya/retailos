import { describe, expect, it } from 'vitest'
import { computeRefund } from '../src/orders/refund'

describe('computeRefund', () => {
  it('默认退全部可退金额', () => {
    const result = computeRefund(100, 0)
    expect(result.amount).toBe(100)
    expect(result.nextRefunded).toBe(100)
    expect(result.nextStatus).toBe('refunded')
  })

  it('部分退款进入 partially_refunded', () => {
    const result = computeRefund(100, 20, 30)
    expect(result.refundable).toBe(80)
    expect(result.nextRefunded).toBe(50)
    expect(result.nextStatus).toBe('partially_refunded')
  })

  it('金额按分四舍五入', () => {
    const result = computeRefund(99.99, 0, 33.333)
    expect(result.nextRefunded).toBe(33.33)
    expect(result.nextStatus).toBe('partially_refunded')
  })

  it('超过可退金额被拒绝', () => {
    expect(() => computeRefund(100, 20, 80.01)).toThrow(
      '退款金额不能超过可退金额',
    )
  })

  it('非正或非数字金额被拒绝', () => {
    expect(() => computeRefund(100, 0, 0)).toThrow('退款金额不合法')
    expect(() => computeRefund(100, 0, -1)).toThrow('退款金额不合法')
    expect(() => computeRefund(100, 0, Number.NaN)).toThrow(
      '退款金额不合法',
    )
  })
})
