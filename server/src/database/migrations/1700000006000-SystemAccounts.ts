import { MigrationInterface, QueryRunner } from 'typeorm'

export class SystemAccounts1700000006000 implements MigrationInterface {
  name = 'SystemAccounts1700000006000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users')
    if (!users?.findColumnByName('status')) {
      await queryRunner.query(
        "ALTER TABLE `users` ADD COLUMN `status` varchar(16) NOT NULL DEFAULT 'active'",
      )
    }
    if (!users?.findColumnByName('last_login_at')) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `last_login_at` datetime(3) NULL',
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users')
    if (users?.findColumnByName('last_login_at')) {
      await queryRunner.query('ALTER TABLE `users` DROP COLUMN `last_login_at`')
    }
    if (users?.findColumnByName('status')) {
      await queryRunner.query('ALTER TABLE `users` DROP COLUMN `status`')
    }
  }
}
