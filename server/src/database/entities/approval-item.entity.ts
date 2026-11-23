import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { ApprovalEntity } from './approval.entity'

@Entity('approval_items')
export class ApprovalItemEntity {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => ApprovalEntity, (approval) => approval.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'approval_id' })
  approval: ApprovalEntity

  @Column({ type: 'varchar', length: 32 })
  sku: string

  @Column({ type: 'varchar', length: 128 })
  name: string

  @Column({ type: 'int' })
  quantity: number
}
