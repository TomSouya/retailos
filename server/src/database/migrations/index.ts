import { InitialSchema1700000000000 } from './1700000000000-InitialSchema'
import { Phase2Schema1700000001000 } from './1700000001000-Phase2Schema'
import { InventoryLedger1700000002000 } from './1700000002000-InventoryLedger'
import { RefundEnhancement1700000003000 } from './1700000003000-RefundEnhancement'
import { WidenOrderStatus1700000004000 } from './1700000004000-WidenOrderStatus'
import { StoresMembers1700000005000 } from './1700000005000-StoresMembers'
import { SystemAccounts1700000006000 } from './1700000006000-SystemAccounts'
import { TokenVersion1700000007000 } from './1700000007000-TokenVersion'
import { ProductCost1700000008000 } from './1700000008000-ProductCost'
import { RolePermissions1700000009000 } from './1700000009000-RolePermissions'
import { AuditTrace1700000010000 } from './1700000010000-AuditTrace'
import { LoginSecurity1700000011000 } from './1700000011000-LoginSecurity'
import { PurchaseOrderSource1700000012000 } from './1700000012000-PurchaseOrderSource'
import { PiiEncryption1700000013000 } from './1700000013000-PiiEncryption'

export const MIGRATIONS = [
  InitialSchema1700000000000,
  Phase2Schema1700000001000,
  InventoryLedger1700000002000,
  RefundEnhancement1700000003000,
  WidenOrderStatus1700000004000,
  StoresMembers1700000005000,
  SystemAccounts1700000006000,
  TokenVersion1700000007000,
  ProductCost1700000008000,
  RolePermissions1700000009000,
  AuditTrace1700000010000,
  LoginSecurity1700000011000,
  PurchaseOrderSource1700000012000,
  PiiEncryption1700000013000,
]
