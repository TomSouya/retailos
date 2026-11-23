import { MigrationInterface, QueryRunner } from 'typeorm'

export class Phase2Schema1700000001000 implements MigrationInterface {
  name = 'Phase2Schema1700000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`categories\` (
        \`id\` varchar(32) NOT NULL,
        \`name\` varchar(32) NOT NULL,
        \`sort\` int NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`products\` (
        \`id\` varchar(32) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`category\` varchar(32) NOT NULL,
        \`price\` decimal(10,2) NOT NULL,
        \`unit\` varchar(16) NOT NULL,
        \`status\` varchar(16) NOT NULL DEFAULT 'active',
        \`safety_stock\` int NOT NULL DEFAULT 0,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_products_category\` (\`category\`),
        KEY \`IDX_products_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`suppliers\` (
        \`id\` varchar(32) NOT NULL,
        \`name\` varchar(64) NOT NULL,
        \`contact\` varchar(32) NOT NULL,
        \`phone\` varchar(32) NOT NULL,
        \`status\` varchar(16) NOT NULL DEFAULT 'active',
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`purchase_orders\` (
        \`id\` varchar(32) NOT NULL,
        \`supplier_id\` varchar(32) NOT NULL,
        \`supplier_name\` varchar(64) NOT NULL,
        \`store_id\` varchar(16) NOT NULL,
        \`store_name\` varchar(64) NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`total_amount\` decimal(12,2) NOT NULL,
        \`item_count\` int NOT NULL,
        \`created_by\` varchar(32) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`approved_by\` varchar(32) NULL,
        \`approved_at\` datetime(3) NULL,
        \`received_at\` datetime(3) NULL,
        \`note\` varchar(255) NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_purchase_orders_status\` (\`status\`),
        KEY \`IDX_purchase_orders_store_id\` (\`store_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`purchase_order_items\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`purchase_order_id\` varchar(32) NOT NULL,
        \`sku\` varchar(32) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`quantity\` int NOT NULL,
        \`unit_price\` decimal(10,2) NOT NULL,
        \`amount\` decimal(12,2) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_purchase_order_items_order_id\` (\`purchase_order_id\`),
        CONSTRAINT \`FK_purchase_order_items_order\` FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sales_orders\` (
        \`id\` varchar(32) NOT NULL,
        \`store_id\` varchar(16) NOT NULL,
        \`store_name\` varchar(64) NOT NULL,
        \`member_name\` varchar(32) NOT NULL,
        \`item_count\` int NOT NULL,
        \`amount\` decimal(12,2) NOT NULL,
        \`payment_method\` varchar(16) NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_sales_orders_status\` (\`status\`),
        KEY \`IDX_sales_orders_store_id\` (\`store_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sales_order_items\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`order_id\` varchar(32) NOT NULL,
        \`sku\` varchar(32) NOT NULL,
        \`name\` varchar(128) NOT NULL,
        \`quantity\` int NOT NULL,
        \`unit_price\` decimal(10,2) NOT NULL,
        \`amount\` decimal(12,2) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`IDX_sales_order_items_order_id\` (\`order_id\`),
        CONSTRAINT \`FK_sales_order_items_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`sales_orders\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `sales_order_items`')
    await queryRunner.query('DROP TABLE IF EXISTS `sales_orders`')
    await queryRunner.query('DROP TABLE IF EXISTS `purchase_order_items`')
    await queryRunner.query('DROP TABLE IF EXISTS `purchase_orders`')
    await queryRunner.query('DROP TABLE IF EXISTS `suppliers`')
    await queryRunner.query('DROP TABLE IF EXISTS `products`')
    await queryRunner.query('DROP TABLE IF EXISTS `categories`')
  }
}
