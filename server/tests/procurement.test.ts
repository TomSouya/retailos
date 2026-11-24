import { describe, expect, it } from 'vitest'
import { nextPurchaseStatus } from '../src/procurement/transitions'

describe('nextPurchaseStatus', () => {
  it('按 draft → pending → approved → received 流转', () => {
    const pending = nextPurchaseStatus('draft', 'submit')
    const approved = nextPurchaseStatus(pending, 'approve')
    const received = nextPurchaseStatus(approved, 'receive')
    expect([pending, approved, received]).toEqual([
      'pending',
      'approved',
      'received',
    ])
  })

  it('拒绝越级提交', () => {
    expect(() => nextPurchaseStatus('approved', 'submit')).toThrow(
      '只有草稿采购单可以提交',
    )
  })

  it('拒绝重复验收', () => {
    expect(() => nextPurchaseStatus('received', 'receive')).toThrow(
      '只有已通过采购单可以验收',
    )
  })

  it('拒绝重复审批', () => {
    expect(() => nextPurchaseStatus('approved', 'approve')).toThrow(
      '只有待审批采购单可以审批',
    )
  })
})
