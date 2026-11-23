import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('categories')
export class CategoryEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string

  @Column({ type: 'varchar', length: 32 })
  name: string

  @Column({ type: 'int', default: 0 })
  sort: number
}
