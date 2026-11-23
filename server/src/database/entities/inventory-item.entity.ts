import { Column, Entity, PrimaryColumn } from 'typeorm'
import { decimalTransformer } from './decimal.transformer'

@Entity('inventory_items')
export class InventoryItemEntity {
  @PrimaryColumn({ name: 'store_id', type: 'varchar', length: 16 })
  storeId: string

  @PrimaryColumn({ type: 'varchar', length: 32 })
  sku: string

  @Column({ type: 'varchar', length: 128 })
  name: string

  @Column({ type: 'varchar', length: 32 })
  category: string

  @Column({ type: 'int', default: 0 })
  stock: number

  @Column({ name: 'safety_stock', type: 'int', default: 0 })
  safetyStock: number

  @Column({ type: 'varchar', length: 16 })
  unit: string

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date
}
