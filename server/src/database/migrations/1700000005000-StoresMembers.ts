import { MigrationInterface, QueryRunner } from 'typeorm'

export class StoresMembers1700000005000 implements MigrationInterface {
  name = 'StoresMembers1700000005000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`stores\` (
        \`id\` varchar(16) NOT NULL,
        \`name\` varchar(64) NOT NULL,
        \`city\` varchar(32) NOT NULL,
        \`region\` varchar(16) NOT NULL,
        \`manager\` varchar(32) NOT NULL,
        \`phone\` varchar(32) NOT NULL,
        \`status\` varchar(16) NOT NULL DEFAULT 'normal',
        \`opened_at\` varchar(16) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_stores_region\` (\`region\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`members\` (
        \`id\` varchar(32) NOT NULL,
        \`name\` varchar(32) NOT NULL,
        \`phone\` varchar(32) NOT NULL,
        \`level\` varchar(16) NOT NULL,
        \`store_id\` varchar(16) NOT NULL,
        \`points\` int NOT NULL DEFAULT 0,
        \`joined_at\` datetime(3) NOT NULL,
        \`status\` varchar(16) NOT NULL DEFAULT 'normal',
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_members_store\` (\`store_id\`),
        KEY \`IDX_members_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `members`')
    await queryRunner.query('DROP TABLE IF EXISTS `stores`')
  }
}
