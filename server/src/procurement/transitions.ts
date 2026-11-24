import { BadRequestException } from '@nestjs/common'

export type PurchaseAction = 'submit' | 'approve' | 'receive'

/**
 * 采购单状态机：只允许 draft → pending → approved → received。
 * 重复或越级操作直接拒绝，保证幂等入口一致。
 */
export function nextPurchaseStatus(
  status: string,
  action: PurchaseAction,
): 'pending' | 'approved' | 'received' {
  if (action === 'submit') {
    if (status !== 'draft') {
      throw new BadRequestException('只有草稿采购单可以提交')
    }
    return 'pending'
  }
  if (action === 'approve') {
    if (status !== 'pending') {
      throw new BadRequestException('只有待审批采购单可以审批')
    }
    return 'approved'
  }
  if (action === 'receive') {
    if (status !== 'approved') {
      throw new BadRequestException('只有已通过采购单可以验收')
    }
    return 'received'
  }
  throw new BadRequestException('未知操作')
}
