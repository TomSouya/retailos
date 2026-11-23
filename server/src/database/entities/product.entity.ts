import { Column, Entity, PrimaryColumn } from 'typeorm'
import { decimalTransformer } from './decimal.transformer'

@Entity('products')
export class ProductEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ type: 'varchar', length: 128 })
  name: string

  @Column({ type: 'varchar', length: 32 })
  category: string

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number

  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  costPrice: number

  @Column({ type: 'varchar', length: 16 })
  unit: string

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: string

  @Column({ name: 'safety_stock', type: 'int', default: 0 })
  safetyStock: number

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date
}
