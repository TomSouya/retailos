import { MigrationInterface, QueryRunner } from 'typeorm'

export class AuditTrace1700000010000 implements MigrationInterface {
  name = 'AuditTrace1700000010000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('audit_records')
    if (!table?.findColumnByName('trace_id')) {
      await queryRunner.query(
        'ALTER TABLE `audit_records` ADD COLUMN `trace_id` varchar(64) NULL',
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('audit_records')
    if (table?.findColumnByName('trace_id')) {
      await queryRunner.query(
        'ALTER TABLE `audit_records` DROP COLUMN `trace_id`',
      )
    }
  }
}
