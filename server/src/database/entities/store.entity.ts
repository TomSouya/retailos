import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('stores')
export class StoreEntity {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  id: string

  @Column({ type: 'varchar', length: 64 })
  name: string

  @Column({ type: 'varchar', length: 32 })
  city: string

  @Column({ type: 'varchar', length: 16 })
  region: string

  @Column({ type: 'varchar', length: 32 })
  manager: string

  @Column({ type: 'varchar', length: 32 })
  phone: string

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  status: string

  @Column({ name: 'opened_at', type: 'varchar', length: 16 })
  openedAt: string

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date
}
