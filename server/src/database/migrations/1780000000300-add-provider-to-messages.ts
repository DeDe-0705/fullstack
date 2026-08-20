import { MigrationInterface, QueryRunner } from 'typeorm';

// 支持用户切换模型（kimi/deepseek/minimax 等）：按供应商聚合/筛选历史消息
export class AddProviderToMessages1780000000300 implements MigrationInterface {
  name = 'AddProviderToMessages1780000000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
        ADD COLUMN provider VARCHAR(32) NULL
          COMMENT '供应商：deepseek/kimi/minimax 等' AFTER thinking_ms
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE messages DROP COLUMN provider');
  }
}
