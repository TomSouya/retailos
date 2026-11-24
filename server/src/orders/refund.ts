import { BadRequestException } from '@nestjs/common'

export interface RefundComputation {
  total: number
  refunded: number
  refundable: number
  amount: number
  nextRefunded: number
  nextStatus: 'refunded' | 'partially_refunded'
}

/**
 * 退款金额与状态计算：默认退全部可退金额，禁止超额与非法金额。
 * 状态校验由调用方在事务内完成。
 */
export function computeRefund(
  totalInput: number,
  refundedInput: number,
  requested?: number | null,
): RefundComputation {
  const total = Number(totalInput)
  const refunded = Number(refundedInput || 0)
  const refundable = Math.round((total - refunded) * 100) / 100
  const amount =
    requested === undefined || requested === null
      ? refundable
      : Number(requested)

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException('退款金额不合法')
  }
  if (amount > refundable + 0.001) {
    throw new BadRequestException(`退款金额不能超过可退金额 ¥${refundable}`)
  }

  const nextRefunded = Math.round((refunded + amount) * 100) / 100
  return {
    total,
    refunded,
    refundable,
    amount,
    nextRefunded,
    nextStatus: nextRefunded >= total ? 'refunded' : 'partially_refunded',
  }
}
