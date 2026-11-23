const numberFormatter = new Intl.NumberFormat('zh-CN')

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value))
}

export function formatCurrency(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `¥${formatNumber(value, digits)}`
}

export function formatCompact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)} 亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)} 万`
  return formatNumber(n)
}

export function formatDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(digits)}%`
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatClock(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function statusLabel(status) {
  const map = {
    normal: '正常',
    low: '低库存',
    out: '缺货',
    warning: '预警',
    dormant: '沉睡',
    danger: '高风险',
    high: '高',
    medium: '中',
    offline: '离线',
    approved: '已通过',
    rejected: '已驳回',
    pending: '待审批',
    submitted: '已提交',
    success: '成功',
    failed: '失败',
    active: '在售',
    inactive: '已下架',
    draft: '草稿',
    received: '已入库',
    cancelled: '已取消',
    paid: '已支付',
    partially_refunded: '部分退款',
    refunded: '已退款',
  }
  return map[status] || status || '—'
}

export function statusTone(status) {
  const map = {
    normal: 'success',
    low: 'warning',
    out: 'danger',
    warning: 'warning',
    dormant: 'info',
    danger: 'danger',
    high: 'danger',
    medium: 'warning',
    offline: 'info',
    approved: 'success',
    rejected: 'danger',
    pending: 'warning',
    submitted: 'info',
    success: 'success',
    failed: 'danger',
    active: 'success',
    inactive: 'info',
    draft: 'info',
    received: 'success',
    cancelled: 'info',
    paid: 'success',
    partially_refunded: 'warning',
    refunded: 'warning',
  }
  return map[status] || 'info'
}
