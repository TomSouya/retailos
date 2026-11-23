/**
 * 生成式 UI 负载契约（A2UI 风格，自建 Vue 渲染路径）。
 * 只允许声明式节点，不允许模型直接返回 HTML/CSS/JS。
 */
export const UI_SCHEMA_VERSION = '1.0'

export const UI_NODE = Object.freeze({
  CARD: 'card',
  METRIC_GRID: 'metricGrid',
  CHART: 'chart',
  TABLE: 'table',
  FORM: 'form',
  CALLOUT: 'callout',
})

export const UI_LIMITS = Object.freeze({
  maxDepth: 6,
  maxNodes: 200,
  maxTableRows: 50,
})

const ALLOWED_TYPES = new Set(Object.values(UI_NODE))

export function createCard({ title = '', subtitle = '', children = [] } = {}) {
  return {
    version: UI_SCHEMA_VERSION,
    type: UI_NODE.CARD,
    props: { title, subtitle },
    children,
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeChildren(children, depth, state) {
  if (!Array.isArray(children)) return []
  return children
    .map((child) => sanitizeNode(child, depth + 1, state))
    .filter(Boolean)
}

function sanitizeNode(node, depth, state) {
  if (state.nodes >= UI_LIMITS.maxNodes) {
    state.errors.push('node_budget_exceeded')
    return null
  }
  if (depth > UI_LIMITS.maxDepth) {
    state.errors.push('depth_exceeded')
    return null
  }
  if (!isObject(node) || !ALLOWED_TYPES.has(node.type)) {
    state.errors.push(`unsupported_type:${node?.type || 'unknown'}`)
    return null
  }

  state.nodes += 1
  const props = isObject(node.props) ? { ...node.props } : {}
  const next = { type: node.type, props }

  if (node.type === UI_NODE.CARD) {
    next.children = sanitizeChildren(node.children, depth, state)
  } else if (node.type === UI_NODE.METRIC_GRID) {
    const items = Array.isArray(props.items) ? props.items : []
    next.props.items = items
      .filter((item) => isObject(item) && item.label !== undefined)
      .slice(0, 12)
    if (!next.props.items.length) return null
  } else if (node.type === UI_NODE.TABLE) {
    const columns = Array.isArray(props.columns) ? props.columns : []
    const rows = Array.isArray(props.rows) ? props.rows : []
    next.props.columns = columns.filter(
      (column) => isObject(column) && column.key && column.label,
    )
    next.props.rows = rows.slice(0, UI_LIMITS.maxTableRows)
    if (!next.props.columns.length) return null
  } else if (node.type === UI_NODE.CHART) {
    const series = Array.isArray(props.series) ? props.series : []
    next.props.series = series.filter((item) => isObject(item))
    if (!next.props.series.length) return null
  } else if (node.type === UI_NODE.FORM) {
    const fields = Array.isArray(props.fields) ? props.fields : []
    next.props.fields = fields.filter((field) => isObject(field))
    if (!next.props.fields.length) return null
  } else if (node.type === UI_NODE.CALLOUT) {
    if (!props.title && !props.text && !props.content) {
      state.errors.push('callout_empty')
      return null
    }
  }

  return next
}

/**
 * 校验并清洗后端返回的 UI 负载。
 * 非法节点会被丢弃，合法节点会被裁剪到白名单与数量上限内。
 */
export function validateUiPayload(schema) {
  if (!isObject(schema)) {
    return { ok: false, schema: null, errors: ['payload_not_object'], dropped: 0 }
  }

  const incomingMajor = String(schema.version || '').split('.')[0]
  const expectedMajor = UI_SCHEMA_VERSION.split('.')[0]
  if (incomingMajor && incomingMajor !== expectedMajor) {
    return {
      ok: false,
      schema: null,
      errors: [`unsupported_version:${schema.version}`],
      dropped: 0,
    }
  }

  const state = { nodes: 0, errors: [] }
  const sanitized = sanitizeNode(schema, 1, state)
  if (!sanitized) {
    return {
      ok: false,
      schema: null,
      errors: state.errors.length ? state.errors : ['empty_payload'],
      dropped: state.nodes,
    }
  }

  return {
    ok: true,
    schema: { ...sanitized, version: UI_SCHEMA_VERSION },
    errors: state.errors,
    dropped: Math.max(state.nodes - 1, 0),
  }
}
