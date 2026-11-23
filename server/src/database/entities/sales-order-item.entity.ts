import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { decimalTransformer } from './decimal.transformer'
import { SalesOrderEntity } from './sales-order.entity'

@Entity('sales_order_items')
export class SalesOrderItemEntity {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => SalesOrderEntity, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: SalesOrderEntity

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
