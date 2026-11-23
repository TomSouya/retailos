import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { decimalTransformer } from './decimal.transformer'
import { PurchaseOrderEntity } from './purchase-order.entity'

@Entity('purchase_order_items')
export class PurchaseOrderItemEntity {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => PurchaseOrderEntity, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrderEntity

  @Column({ type: 'varchar', length: 32 })
  sku: string

  @Column({ type: 'varchar', length: 128 })
  name: string

  @Column({ type: 'int' })
  quantity: number

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice: number

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number
}
