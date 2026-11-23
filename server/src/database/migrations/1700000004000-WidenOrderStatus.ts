import { MigrationInterface, QueryRunner } from 'typeorm'

export class WidenOrderStatus1700000004000 implements MigrationInterface {
  name = 'WidenOrderStatus1700000004000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`sales_orders\`
        MODIFY COLUMN \`status\` varchar(24) NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`sales_orders\`
        MODIFY COLUMN \`status\` varchar(16) NOT NULL
    `)
  }
}
