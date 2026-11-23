import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`roles\` (
        \`key\` varchar(32) NOT NULL,
        \`name\` varchar(32) NOT NULL,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` varchar(36) NOT NULL,
        \`username\` varchar(64) NOT NULL,
        \`password_hash\` varchar(255) NOT NULL,
        \`name\` varchar(32) NOT NULL,
        \`role_key\` varchar(32) NOT NULL,
        \`region\` varchar(32) NOT NULL,
        \`store_id\` varchar(16) NULL,
        \`scope\` varchar(64) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_users_username\` (\`username\`),
        KEY \`IDX_users_role_key\` (\`role_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`approvals\` (
        \`id\` varchar(32) NOT NULL,
        \`type\` varchar(16) NOT NULL,
        \`store_id\` varchar(16) NOT NULL,
        \`store_name\` varchar(64) NOT NULL,
        \`requester\` varchar(32) NOT NULL,
        \`risk\` varchar(16) NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`summary\` varchar(255) NULL,
        \`params\` json NULL,
        \`expires_at\` varchar(64) NULL,
        \`decided_at\` datetime(3) NULL,
        \`decided_by\` varchar(32) NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`approval_items\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`approval_id\` varchar(32) NOT NULL,
        \`sku\` varchar(32) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`quantity\` int NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_approval_items_approval_id\` (\`approval_id\`),
        CONSTRAINT \`FK_approval_items_approval\` FOREIGN KEY (\`approval_id\`) REFERENCES \`approvals\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`audit_records\` (
        \`id\` varchar(32) NOT NULL,
        \`timestamp\` datetime(3) NOT NULL,
        \`actor\` varchar(32) NOT NULL,
        \`role\` varchar(32) NOT NULL,
        \`action\` varchar(128) NOT NULL,
        \`object\` varchar(128) NOT NULL,
        \`result\` varchar(32) NOT NULL,
        \`approval_id\` varchar(32) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `approval_items`')
    await queryRunner.query('DROP TABLE IF EXISTS `approvals`')
    await queryRunner.query('DROP TABLE IF EXISTS `audit_records`')
    await queryRunner.query('DROP TABLE IF EXISTS `users`')
    await queryRunner.query('DROP TABLE IF EXISTS `roles`')
  }
}
