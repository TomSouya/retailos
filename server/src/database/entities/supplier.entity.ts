import { Column, Entity, PrimaryColumn } from 'typeorm'
import { piiTransformer } from '../../common/pii'

@Entity('suppliers')
export class SupplierEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ type: 'varchar', length: 64 })
  name: string

  @Column({
    type: 'varchar',
    length: 255,
    transformer: piiTransformer,
  })
  contact: string

  @Column({
    type: 'varchar',
    length: 255,
    transformer: piiTransformer,
  })
  phone: string

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: string
}
