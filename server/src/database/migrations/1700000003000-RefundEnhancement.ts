import { MigrationInterface, QueryRunner } from 'typeorm'

export class RefundEnhancement1700000003000 implements MigrationInterface {
  name = 'RefundEnhancement1700000003000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`sales_orders\`
        ADD COLUMN \`refunded_amount\` decimal(12,2) NOT NULL DEFAULT 0 AFTER \`status\`,
        ADD COLUMN \`refund_reason\` varchar(255) NULL AFTER \`refunded_amount\`
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`sales_orders\`
        DROP COLUMN \`refund_reason\`,
        DROP COLUMN \`refunded_amount\`
    `)
  }
}
