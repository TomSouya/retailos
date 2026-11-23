import 'reflect-metadata'
import { config } from 'dotenv'
import { DataSource } from 'typeorm'
import { ApprovalEntity } from './entities/approval.entity'
import { ApprovalItemEntity } from './entities/approval-item.entity'
import { AuditRecordEntity } from './entities/audit-record.entity'
import { RoleEntity } from './entities/role.entity'
import { UserEntity } from './entities/user.entity'
import { CategoryEntity } from './entities/category.entity'
import { ProductEntity } from './entities/product.entity'
import { SupplierEntity } from './entities/supplier.entity'
import { PurchaseOrderEntity } from './entities/purchase-order.entity'
import { PurchaseOrderItemEntity } from './entities/purchase-order-item.entity'
import { SalesOrderEntity } from './entities/sales-order.entity'
import { SalesOrderItemEntity } from './entities/sales-order-item.entity'
import { InventoryItemEntity } from './entities/inventory-item.entity'
import { StockMovementEntity } from './entities/stock-movement.entity'
import { StoreEntity } from './entities/store.entity'
import { MemberEntity } from './entities/member.entity'
import { InitialSchema1700000000000 } from './migrations/1700000000000-InitialSchema'
import { Phase2Schema1700000001000 } from './migrations/1700000001000-Phase2Schema'
import { InventoryLedger1700000002000 } from './migrations/1700000002000-InventoryLedger'
import { RefundEnhancement1700000003000 } from './migrations/1700000003000-RefundEnhancement'
import { WidenOrderStatus1700000004000 } from './migrations/1700000004000-WidenOrderStatus'
import { StoresMembers1700000005000 } from './migrations/1700000005000-StoresMembers'
import { SystemAccounts1700000006000 } from './migrations/1700000006000-SystemAccounts'
import { TokenVersion1700000007000 } from './migrations/1700000007000-TokenVersion'
import { ProductCost1700000008000 } from './migrations/1700000008000-ProductCost'
import { RolePermissions1700000009000 } from './migrations/1700000009000-RolePermissions'
import { AuditTrace1700000010000 } from './migrations/1700000010000-AuditTrace'
import { LoginSecurity1700000011000 } from './migrations/1700000011000-LoginSecurity'
import { PurchaseOrderSource1700000012000 } from './migrations/1700000012000-PurchaseOrderSource'

config()

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || 'retailos',
  password: process.env.DB_PASSWORD || 'retailos_dev',
  database: process.env.DB_NAME || 'retailos',
  charset: 'utf8mb4',
  timezone: '+08:00',
  entities: [
    ApprovalEntity,
    ApprovalItemEntity,
    AuditRecordEntity,
    RoleEntity,
    UserEntity,
    CategoryEntity,
    ProductEntity,
    SupplierEntity,
    PurchaseOrderEntity,
    PurchaseOrderItemEntity,
    SalesOrderEntity,
    SalesOrderItemEntity,
    InventoryItemEntity,
    StockMovementEntity,
    StoreEntity,
    MemberEntity,
  ],
  migrations: [
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
  ],
  synchronize: false,
  logging: false,
})
