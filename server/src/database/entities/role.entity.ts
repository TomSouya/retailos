import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('roles')
export class RoleEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  key: string

  @Column({ type: 'varchar', length: 32 })
  name: string

  @Column({ type: 'tinyint', default: 0 })
  builtin: number

  @Column({ name: 'scope_type', type: 'varchar', length: 16, default: 'region' })
  scopeType: string

  @Column({ type: 'varchar', length: 160, default: '' })
  description: string

  @Column({ type: 'text', nullable: true })
  permissions: string | null
}
