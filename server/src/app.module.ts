import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AppController } from './app.controller'
import { AnalyticsController } from './analytics/analytics.controller'
import { AnalyticsService } from './analytics/analytics.service'
import { DemoOrdersSeeder } from './analytics/demo-orders.seeder'
import { ExportsController } from './exports/exports.controller'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { PermissionService } from './auth/permission.service'
import { JwtAuthGuard } from './auth/jwt-auth.guard'
import { AgentController } from './agent/agent.controller'
import { AgentService } from './agent/agent.service'
import { AgentToolsService } from './agent/agent-tools.service'
import { LlmService } from './agent/llm.service'
import { ApprovalsController } from './approvals/approvals.controller'
import { ApprovalsService } from './approvals/approvals.service'
import { AuditController } from './audit/audit.controller'
import { AuditService } from './audit/audit.service'
import { CatalogController } from './catalog/catalog.controller'
import { CatalogService } from './catalog/catalog.service'
import { ProcurementController } from './procurement/procurement.controller'
import { ProcurementService } from './procurement/procurement.service'
import { OrdersController } from './orders/orders.controller'
import { OrdersService } from './orders/orders.service'
import { InventoryController } from './inventory/inventory.controller'
import { InventoryService } from './inventory/inventory.service'
import { StoresController } from './stores/stores.controller'
import { StoresService } from './stores/stores.service'
import { MembersController } from './members/members.controller'
import { MembersService } from './members/members.service'
import { SystemController } from './system/system.controller'
import { SystemService } from './system/system.service'
import { ApprovalEntity } from './database/entities/approval.entity'
import { ApprovalItemEntity } from './database/entities/approval-item.entity'
import { AuditRecordEntity } from './database/entities/audit-record.entity'
import { RoleEntity } from './database/entities/role.entity'
import { UserEntity } from './database/entities/user.entity'
import { CategoryEntity } from './database/entities/category.entity'
import { ProductEntity } from './database/entities/product.entity'
import { SupplierEntity } from './database/entities/supplier.entity'
import { PurchaseOrderEntity } from './database/entities/purchase-order.entity'
import { PurchaseOrderItemEntity } from './database/entities/purchase-order-item.entity'
import { SalesOrderEntity } from './database/entities/sales-order.entity'
import { SalesOrderItemEntity } from './database/entities/sales-order-item.entity'
import { InventoryItemEntity } from './database/entities/inventory-item.entity'
import { StockMovementEntity } from './database/entities/stock-movement.entity'
import { StoreEntity } from './database/entities/store.entity'
import { MemberEntity } from './database/entities/member.entity'
import { InitialSchema1700000000000 } from './database/migrations/1700000000000-InitialSchema'
import { Phase2Schema1700000001000 } from './database/migrations/1700000001000-Phase2Schema'
import { InventoryLedger1700000002000 } from './database/migrations/1700000002000-InventoryLedger'
import { RefundEnhancement1700000003000 } from './database/migrations/1700000003000-RefundEnhancement'
import { WidenOrderStatus1700000004000 } from './database/migrations/1700000004000-WidenOrderStatus'
import { StoresMembers1700000005000 } from './database/migrations/1700000005000-StoresMembers'
import { SystemAccounts1700000006000 } from './database/migrations/1700000006000-SystemAccounts'
import { TokenVersion1700000007000 } from './database/migrations/1700000007000-TokenVersion'
import { ProductCost1700000008000 } from './database/migrations/1700000008000-ProductCost'
import { RolePermissions1700000009000 } from './database/migrations/1700000009000-RolePermissions'
import { AuditTrace1700000010000 } from './database/migrations/1700000010000-AuditTrace'
import { LoginSecurity1700000011000 } from './database/migrations/1700000011000-LoginSecurity'
import { PurchaseOrderSource1700000012000 } from './database/migrations/1700000012000-PurchaseOrderSource'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'retailos-dev-jwt-secret'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(config.get<string>('DB_PORT', '3306')),
        username: config.get<string>('DB_USER', 'retailos'),
        password: config.get<string>('DB_PASSWORD', 'retailos_dev'),
        database: config.get<string>('DB_NAME', 'retailos'),
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
        migrationsRun:
          config.get<string>('DB_MIGRATIONS_RUN', 'true') === 'true',
        synchronize:
          config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
        retryAttempts: 1,
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([
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
    ]),
  ],
  controllers: [
    AppController,
    AnalyticsController,
    ExportsController,
    AuthController,
    AgentController,
    ApprovalsController,
    AuditController,
    CatalogController,
    ProcurementController,
    OrdersController,
    InventoryController,
    StoresController,
    MembersController,
    SystemController,
  ],
  providers: [
    AnalyticsService,
    AgentService,
    AgentToolsService,
    LlmService,
    ApprovalsService,
    AuthService,
    JwtAuthGuard,
    AuditService,
    CatalogService,
    ProcurementService,
    OrdersService,
    InventoryService,
    StoresService,
    MembersService,
    DemoOrdersSeeder,
    SystemService,
    PermissionService,
  ],
})
export class AppModule {}
