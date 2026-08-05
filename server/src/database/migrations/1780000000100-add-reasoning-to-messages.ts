import { MigrationInterface, QueryRunner } from 'typeorm';

// thinking 模式：assistant 的思考过程单独存一列，和历史正文一起返回，刷新后仍可展示
export class AddReasoningToMessages1780000000100 implements MigrationInterface {
  name = 'AddReasoningToMessages1780000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
        ADD COLUMN reasoning TEXT NULL COMMENT 'assistant 思考过程（thinking 模式）' AFTER content
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE messages DROP COLUMN reasoning');
  }
}
