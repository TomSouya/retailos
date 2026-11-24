export type RoleKey = string

export interface Actor {
  key: RoleKey
  label: string
  name: string
  region: string
  storeId: string | null
  scope: string
}

export interface Store {
  id: string
  name: string
  city: string
  region: string
  sales: number
  orders: number
  aov: number
  delta: number
  status: string
  manager: string
}

export interface InventoryItem {
  id: string
  name: string
  category: string
  storeId: string
  stock: number
  safetyStock: number
  unit: string
  price: number
}

export interface Anomaly {
  id: string
  store: string
  region: string
  type: string
  detail: string
  severity: 'high' | 'medium' | 'low'
  time: string
}

export type ApprovalStatus =
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled'

export type Risk = 'low' | 'medium' | 'high'

export interface ApprovalItem {
  sku: string
  name: string
  quantity: number
}

export interface Approval {
  id: string
  type: 'replenishment' | 'refund'
  storeId: string
  storeName: string
  requester: string
  risk: Risk
  status: ApprovalStatus
  createdAt: string
  items: ApprovalItem[]
  summary?: string
  params?: Record<string, any>
  expiresAt?: string
  decidedAt?: string
  decidedBy?: string
}

export interface ConfirmationMeta {
  label: string
  value: string
}

export type ConfirmationKind =
  | 'purchase_order'
  | 'purchase_order_action'
  | 'approval_decision'
  | 'refund_request'
  | 'store_create'
  | 'member_create'
  | 'product_create'

export interface Confirmation {
  id: string
  kind: ConfirmationKind
  status: 'pending' | 'done' | 'cancelled' | 'failed'
  title: string
  summary: string
  risk: Risk
  storeId?: string
  storeName?: string
  meta: ConfirmationMeta[]
  items: Array<{
    sku: string
    name: string
    quantity: number
    unitPrice?: number
  }>
  payload: Record<string, any>
  expiresAt?: string
  doneText?: string
}

export interface AuditRecord {
  id: string
  timestamp: string
  actor: string
  role: string
  action: string
  object: string
  result: string
  approvalId: string
  traceId?: string
}

export interface UiNode {
  type: string
  props?: Record<string, any>
  children?: UiNode[]
}

export interface ToolSpec {
  name: string
  label: string
  input: Record<string, any>
  duration: number
}

export interface Scenario {
  plan: string
  tools: ToolSpec[]
  reply: string
  ui: UiNode
  approval?: Approval
  confirmation?: Confirmation
}

export interface SalesSummary {
  sales: number
  orders: number
  aov: number
  delta: number
  stores: number
  scope: string
}

export interface SalesTrend {
  labels: string[]
  sales: number[]
  scope: string
}

export interface AgentEvent {
  type: string
  [key: string]: any
}
