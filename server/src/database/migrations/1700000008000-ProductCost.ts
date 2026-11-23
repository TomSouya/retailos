import { MigrationInterface, QueryRunner } from 'typeorm'

export class ProductCost1700000008000 implements MigrationInterface {
  name = 'ProductCost1700000008000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const products = await queryRunner.getTable('products')
    if (!products?.findColumnByName('cost_price')) {
      await queryRunner.query(
        'ALTER TABLE `products` ADD COLUMN `cost_price` decimal(10,2) NOT NULL DEFAULT 0 AFTER `price`',
      )
      await queryRunner.query(
        'UPDATE `products` SET `cost_price` = ROUND(`price` * 0.65, 2) WHERE `cost_price` = 0',
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const products = await queryRunner.getTable('products')
    if (products?.findColumnByName('cost_price')) {
      await queryRunner.query(
        'ALTER TABLE `products` DROP COLUMN `cost_price`',
      )
    }
  }
}
