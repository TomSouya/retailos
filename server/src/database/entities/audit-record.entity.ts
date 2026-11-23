import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('audit_records')
export class AuditRecordEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ type: 'datetime', precision: 3 })
  timestamp: Date

  @Column({ type: 'varchar', length: 32 })
  actor: string

  @Column({ type: 'varchar', length: 32 })
  role: string

  @Column({ type: 'varchar', length: 128 })
  action: string

  @Column({ type: 'varchar', length: 128 })
  object: string

  @Column({ type: 'varchar', length: 32 })
  result: string

  @Column({ name: 'approval_id', type: 'varchar', length: 32 })
  approvalId: string

  @Column({
    name: 'trace_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  traceId: string | null
}
