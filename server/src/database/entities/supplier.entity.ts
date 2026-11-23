import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('suppliers')
export class SupplierEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ type: 'varchar', length: 64 })
  name: string

  @Column({ type: 'varchar', length: 32 })
  contact: string

  @Column({ type: 'varchar', length: 32 })
  phone: string

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: string
}
