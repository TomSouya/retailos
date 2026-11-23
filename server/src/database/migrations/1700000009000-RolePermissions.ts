import { MigrationInterface, QueryRunner } from 'typeorm'

export class RolePermissions1700000009000 implements MigrationInterface {
  name = 'RolePermissions1700000009000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roles = await queryRunner.getTable('roles')
    if (!roles?.findColumnByName('builtin')) {
      await queryRunner.query(
        "ALTER TABLE `roles` ADD COLUMN `builtin` tinyint NOT NULL DEFAULT 0",
      )
    }
    if (!roles?.findColumnByName('scope_type')) {
      await queryRunner.query(
        "ALTER TABLE `roles` ADD COLUMN `scope_type` varchar(16) NOT NULL DEFAULT 'region'",
      )
    }
    if (!roles?.findColumnByName('description')) {
      await queryRunner.query(
        "ALTER TABLE `roles` ADD COLUMN `description` varchar(160) NOT NULL DEFAULT ''",
      )
    }
    if (!roles?.findColumnByName('permissions')) {
      await queryRunner.query(
        'ALTER TABLE `roles` ADD COLUMN `permissions` text NULL',
      )
    }

    await queryRunner.query(
      "UPDATE `roles` SET `builtin` = 1, `scope_type` = 'global' WHERE `key` = 'owner'",
    )
    await queryRunner.query(
      "UPDATE `roles` SET `builtin` = 1, `scope_type` = 'region' WHERE `key` IN ('regional_manager', 'warehouse')",
    )
    await queryRunner.query(
      "UPDATE `roles` SET `builtin` = 1, `scope_type` = 'store' WHERE `key` = 'store_manager'",
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['builtin', 'scope_type', 'description', 'permissions']) {
      const roles = await queryRunner.getTable('roles')
      if (roles?.findColumnByName(column)) {
        await queryRunner.query(
          `ALTER TABLE \`roles\` DROP COLUMN \`${column}\``,
        )
      }
    }
  }
}
