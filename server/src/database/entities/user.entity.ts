import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string

  @Column({ type: 'varchar', length: 64, unique: true })
  username: string

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string

  @Column({ type: 'varchar', length: 32 })
  name: string

  @Column({ name: 'role_key', type: 'varchar', length: 32 })
  roleKey: string

  @Column({ type: 'varchar', length: 32 })
  region: string

  @Column({ name: 'store_id', type: 'varchar', length: 16, nullable: true })
  storeId: string

  @Column({ type: 'varchar', length: 64 })
  scope: string

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: string

  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number

  @Column({
    name: 'locked_until',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lockedUntil: Date | null

  @Column({
    name: 'last_login_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastLoginAt: Date | null

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date
}
