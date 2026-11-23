import { UiNode } from '../domain/types'

export const UI_SCHEMA_VERSION = '1.0'

const ALLOWED_TYPES = new Set([
  'card',
  'metricGrid',
  'chart',
  'table',
  'form',
  'callout',
])

const MAX_DEPTH = 6
const MAX_NODES = 200
const MAX_TABLE_ROWS = 50

interface SanitizeState {
  nodes: number
  errors: string[]
}

function isObject(value: any) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeChildren(
  children: any,
  depth: number,
  state: SanitizeState,
): UiNode[] {
  if (!Array.isArray(children)) return []
  return children
    .map((child) => sanitizeNode(child, depth + 1, state))
    .filter((child): child is UiNode => Boolean(child))
}

function sanitizeNode(
  node: any,
  depth: number,
  state: SanitizeState,
): UiNode | null {
  if (state.nodes >= MAX_NODES) {
    state.errors.push('node_budget_exceeded')
    return null
  }
  if (depth > MAX_DEPTH) {
    state.errors.push('depth_exceeded')
    return null
  }
  if (!isObject(node) || !ALLOWED_TYPES.has(node.type)) {
    state.errors.push(`unsupported_type:${node?.type || 'unknown'}`)
    return null
  }

  state.nodes += 1
  const props = isObject(node.props) ? { ...node.props } : {}
  const next: UiNode = { type: node.type, props }

  if (node.type === 'card') {
    next.children = sanitizeChildren(node.children, depth, state)
  } else if (node.type === 'metricGrid') {
    const items = Array.isArray(props.items) ? props.items : []
    next.props.items = items
      .filter((item: any) => isObject(item) && item.label !== undefined)
      .slice(0, 12)
    if (!next.props.items.length) return null
  } else if (node.type === 'table') {
    const columns = Array.isArray(props.columns) ? props.columns : []
    const rows = Array.isArray(props.rows) ? props.rows : []
    next.props.columns = columns.filter(
      (column: any) => isObject(column) && column.key && column.label,
    )
    next.props.rows = rows.slice(0, MAX_TABLE_ROWS)
    if (!next.props.columns.length) return null
  } else if (node.type === 'chart') {
    const series = Array.isArray(props.series) ? props.series : []
    next.props.series = series.filter((item: any) => isObject(item))
    if (!next.props.series.length) return null
  } else if (node.type === 'form') {
    const fields = Array.isArray(props.fields) ? props.fields : []
    next.props.fields = fields.filter((field: any) => isObject(field))
    if (!next.props.fields.length) return null
  } else if (node.type === 'callout') {
    if (!props.title && !props.text && !props.content) {
      state.errors.push('callout_empty')
      return null
    }
  }

  return next
}

/**
 * 服务端出口校验：只允许声明式节点，并裁剪数量，
 * 防止工具输出膨胀或意外注入非白名单组件。
 */
export function sanitizeUiPayload(schema: any): UiNode | undefined {
  if (!isObject(schema)) return undefined
  const state: SanitizeState = { nodes: 0, errors: [] }
  const sanitized = sanitizeNode(schema, 1, state)
  if (!sanitized) return undefined
  return { ...sanitized, version: UI_SCHEMA_VERSION } as UiNode
}
