import { MigrationInterface, QueryRunner } from 'typeorm'

export class LoginSecurity1700000011000 implements MigrationInterface {
  name = 'LoginSecurity1700000011000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users')
    if (!users?.findColumnByName('failed_login_attempts')) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `failed_login_attempts` int NOT NULL DEFAULT 0',
      )
    }
    if (!users?.findColumnByName('locked_until')) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `locked_until` datetime(3) NULL',
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['failed_login_attempts', 'locked_until']) {
      const users = await queryRunner.getTable('users')
      if (users?.findColumnByName(column)) {
        await queryRunner.query(
          `ALTER TABLE \`users\` DROP COLUMN \`${column}\``,
        )
      }
    }
  }
}
