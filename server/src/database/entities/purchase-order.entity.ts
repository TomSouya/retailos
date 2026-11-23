import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm'
import { decimalTransformer } from './decimal.transformer'
import { PurchaseOrderItemEntity } from './purchase-order-item.entity'

@Entity('purchase_orders')
export class PurchaseOrderEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ name: 'supplier_id', type: 'varchar', length: 32 })
  supplierId: string

  @Column({ name: 'supplier_name', type: 'varchar', length: 64 })
  supplierName: string

  @Column({ name: 'store_id', type: 'varchar', length: 16 })
  storeId: string

  @Column({ name: 'store_name', type: 'varchar', length: 64 })
  storeName: string

  @Column({ type: 'varchar', length: 16 })
  status: string

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: number

  @Column({ name: 'item_count', type: 'int' })
  itemCount: number

  @Column({ name: 'created_by', type: 'varchar', length: 32 })
  createdBy: string

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date

  @Column({
    name: 'approved_by',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  approvedBy: string

  @Column({
    name: 'approved_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  approvedAt: Date

  @Column({
    name: 'received_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  receivedAt: Date

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string

  @Column({
    name: 'source_approval_id',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  sourceApprovalId: string

  @OneToMany(() => PurchaseOrderItemEntity, (item) => item.purchaseOrder, {
    cascade: true,
    eager: true,
  })
  items: PurchaseOrderItemEntity[]
}
