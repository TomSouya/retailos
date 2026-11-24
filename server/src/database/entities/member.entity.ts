import { Column, Entity, PrimaryColumn } from 'typeorm'
import { piiTransformer } from '../../common/pii'

@Entity('members')
export class MemberEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ type: 'varchar', length: 32 })
  name: string

  @Column({
    type: 'varchar',
    length: 255,
    transformer: piiTransformer,
  })
  phone: string

  @Column({ type: 'varchar', length: 16 })
  level: string

  @Column({ name: 'store_id', type: 'varchar', length: 16 })
  storeId: string

  @Column({ type: 'int', default: 0 })
  points: number

  @Column({ name: 'joined_at', type: 'datetime', precision: 3 })
  joinedAt: Date

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  status: string

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date
}
