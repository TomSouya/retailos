import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm'
import { ApprovalItemEntity } from './approval-item.entity'

@Entity('approvals')
export class ApprovalEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ type: 'varchar', length: 16 })
  type: string

  @Column({ name: 'store_id', type: 'varchar', length: 16 })
  storeId: string

  @Column({ name: 'store_name', type: 'varchar', length: 64 })
  storeName: string

  @Column({ type: 'varchar', length: 32 })
  requester: string

  @Column({ type: 'varchar', length: 16 })
  risk: string

  @Column({ type: 'varchar', length: 16 })
  status: string

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date

  @Column({ type: 'varchar', length: 255, nullable: true })
  summary: string

  @Column({ type: 'json', nullable: true })
  params: Record<string, any>

  @Column({ name: 'expires_at', type: 'varchar', length: 64, nullable: true })
  expiresAt: string

  @Column({
    name: 'decided_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  decidedAt: Date

  @Column({ name: 'decided_by', type: 'varchar', length: 32, nullable: true })
  decidedBy: string

  @OneToMany(() => ApprovalItemEntity, (item) => item.approval, {
    cascade: true,
    eager: true,
  })
  items: ApprovalItemEntity[]
}
