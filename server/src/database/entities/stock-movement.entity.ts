import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('stock_movements')
export class StockMovementEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ name: 'store_id', type: 'varchar', length: 16 })
  storeId: string

  @Column({ name: 'store_name', type: 'varchar', length: 64 })
  storeName: string

  @Column({ type: 'varchar', length: 32 })
  sku: string

  @Column({ type: 'varchar', length: 128 })
  name: string

  @Column({ type: 'varchar', length: 32 })
  type: string

  @Column({ type: 'int' })
  quantity: number

  @Column({ name: 'before_stock', type: 'int' })
  beforeStock: number

  @Column({ name: 'after_stock', type: 'int' })
  afterStock: number

  @Column({ name: 'ref_id', type: 'varchar', length: 32 })
  refId: string

  @Column({ type: 'varchar', length: 32 })
  operator: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date
}
