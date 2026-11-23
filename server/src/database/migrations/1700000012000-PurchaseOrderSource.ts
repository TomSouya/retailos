import { MigrationInterface, QueryRunner } from 'typeorm'

export class PurchaseOrderSource1700000012000
  implements MigrationInterface
{
  name = 'PurchaseOrderSource1700000012000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('purchase_orders')
    if (!table?.findColumnByName('source_approval_id')) {
      await queryRunner.query(
        'ALTER TABLE `purchase_orders` ADD COLUMN `source_approval_id` varchar(32) NULL',
      )
    }

    const updated = await queryRunner.getTable('purchase_orders')
    const hasIndex = updated?.indices.some(
      (index) => index.name === 'IDX_purchase_orders_source_approval',
    )
    if (!hasIndex) {
      await queryRunner.query(
        'ALTER TABLE `purchase_orders` ADD UNIQUE INDEX `IDX_purchase_orders_source_approval` (`source_approval_id`)',
      )
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('purchase_orders')
    if (
      table?.indices.some(
        (index) => index.name === 'IDX_purchase_orders_source_approval',
      )
    ) {
      await queryRunner.query(
        'ALTER TABLE `purchase_orders` DROP INDEX `IDX_purchase_orders_source_approval`',
      )
    }
    if (table?.findColumnByName('source_approval_id')) {
      await queryRunner.query(
        'ALTER TABLE `purchase_orders` DROP COLUMN `source_approval_id`',
      )
    }
  }
}
