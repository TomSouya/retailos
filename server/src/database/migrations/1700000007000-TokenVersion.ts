import { MigrationInterface, QueryRunner } from 'typeorm'

export class TokenVersion1700000007000 implements MigrationInterface {
  name = 'TokenVersion1700000007000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users')
    if (!users?.findColumnByName('token_version')) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `token_version` int NOT NULL DEFAULT 0',
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const users = await queryRunner.getTable('users')
    if (users?.findColumnByName('token_version')) {
      await queryRunner.query('ALTER TABLE `users` DROP COLUMN `token_version`')
    }
  }
}
