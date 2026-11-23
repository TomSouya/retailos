import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm'
import { decimalTransformer } from './decimal.transformer'
import { SalesOrderItemEntity } from './sales-order-item.entity'

@Entity('sales_orders')
export class SalesOrderEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ name: 'store_id', type: 'varchar', length: 16 })
  storeId: string

  @Column({ name: 'store_name', type: 'varchar', length: 64 })
  storeName: string

  @Column({ name: 'member_name', type: 'varchar', length: 32 })
  memberName: string

  @Column({ name: 'item_count', type: 'int' })
  itemCount: number

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number

  @Column({ name: 'payment_method', type: 'varchar', length: 16 })
  paymentMethod: string

  @Column({ type: 'varchar', length: 24 })
  status: string

  @Column({
    name: 'refunded_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  refundedAmount: number

  @Column({
    name: 'refund_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  refundReason: string | null

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date

  @OneToMany(() => SalesOrderItemEntity, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: SalesOrderItemEntity[]
}
