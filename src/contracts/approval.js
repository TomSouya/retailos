export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
})

export const APPROVAL_RISK = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
})

/**
 * @typedef {Object} ApprovalItem
 * @property {string} sku
 * @property {string} name
 * @property {number} quantity
 */

/**
 * @typedef {Object} ApprovalRequest
 * @property {string} id
 * @property {'replenishment'} type
 * @property {string} storeId
 * @property {string} storeName
 * @property {'low'|'medium'|'high'} risk
 * @property {string} summary
 * @property {ApprovalItem[]} items
 * @property {Object} [params]
 * @property {string} [expiresAt]
 * @property {'pending'|'submitted'|'approved'|'rejected'|'cancelled'} status
 */

/**
 * @param {Omit<ApprovalRequest, 'status'> & { status?: string }} input
 * @returns {ApprovalRequest}
 */
export function createApprovalRequest(input) {
  return {
    ...input,
    status: input.status || APPROVAL_STATUS.PENDING,
  }
}
