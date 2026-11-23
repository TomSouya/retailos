import { MigrationInterface, QueryRunner } from 'typeorm'

export class InventoryLedger1700000002000 implements MigrationInterface {
  name = 'InventoryLedger1700000002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`inventory_items\` (
        \`store_id\` varchar(16) NOT NULL,
        \`sku\` varchar(32) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`category\` varchar(32) NOT NULL,
        \`stock\` int NOT NULL DEFAULT 0,
        \`safety_stock\` int NOT NULL DEFAULT 0,
        \`unit\` varchar(16) NOT NULL,
        \`price\` decimal(10,2) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`store_id\`, \`sku\`),
        KEY \`IDX_inventory_items_sku\` (\`sku\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`stock_movements\` (
        \`id\` varchar(32) NOT NULL,
        \`store_id\` varchar(16) NOT NULL,
        \`store_name\` varchar(64) NOT NULL,
        \`sku\` varchar(32) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`type\` varchar(32) NOT NULL,
        \`quantity\` int NOT NULL,
        \`before_stock\` int NOT NULL,
        \`after_stock\` int NOT NULL,
        \`ref_id\` varchar(32) NOT NULL,
        \`operator\` varchar(32) NOT NULL,
        \`note\` varchar(255) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_stock_movements_store_sku\` (\`store_id\`, \`sku\`),
        KEY \`IDX_stock_movements_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `stock_movements`')
    await queryRunner.query('DROP TABLE IF EXISTS `inventory_items`')
  }
}
