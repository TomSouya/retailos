import { MigrationInterface, QueryRunner } from 'typeorm'

export class PiiEncryption1700000013000 implements MigrationInterface {
  name = 'PiiEncryption1700000013000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // AES-GCM 密文长于明文，扩容到 255；存量数据由 npm run pii:encrypt 回填
    await queryRunner.query(
      'ALTER TABLE `members` MODIFY `phone` varchar(255) NOT NULL',
    )
    await queryRunner.query(
      'ALTER TABLE `suppliers` MODIFY `contact` varchar(255) NOT NULL',
    )
    await queryRunner.query(
      'ALTER TABLE `suppliers` MODIFY `phone` varchar(255) NOT NULL',
    )
  }

  public async down(): Promise<void> {
    // 有意的空回滚：缩回 32 会截断已加密数据。
    // 如需回退请使用备份恢复，或先运行解密脚本再手动收缩字段。
  }
}
