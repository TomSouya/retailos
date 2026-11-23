export const AUDIT_RESULT = Object.freeze({
  SUCCESS: 'success',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FAILED: 'failed',
})

/**
 * @typedef {Object} AuditRecord
 * @property {string} id
 * @property {string} timestamp
 * @property {string} actor
 * @property {string} role
 * @property {string} action
 * @property {string} object
 * @property {'success'|'submitted'|'approved'|'rejected'|'failed'} result
 * @property {string} approvalId
 */
