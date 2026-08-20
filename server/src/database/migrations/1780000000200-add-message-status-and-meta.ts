import { MigrationInterface, QueryRunner } from 'typeorm';

// assistant 消息补充状态与元信息：
// - status 区分完成/用户中断/异常，中断落库的半截回复不再与正常回复混淆
// - token_usage / thinking_ms / model / tool_calls 落库后，刷新页面仍能展示用量、耗时与工具轨迹
// 注意：USAGE 是 MySQL 保留字，列名用 token_usage 规避
export class AddMessageStatusAndMeta1780000000200 implements MigrationInterface {
  name = 'AddMessageStatusAndMeta1780000000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
        ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'completed'
          COMMENT '消息状态: completed(完成)/aborted(用户中断)/error(异常)' AFTER reasoning,
        ADD COLUMN token_usage JSON NULL
          COMMENT 'token 用量（assistant 消息，JSON）' AFTER status,
        ADD COLUMN thinking_ms INT UNSIGNED NULL
          COMMENT '思考耗时（毫秒）：首次 reasoning 增量到首次 content 增量' AFTER token_usage,
        ADD COLUMN model VARCHAR(64) NULL
          COMMENT '生成该消息的模型' AFTER thinking_ms,
        ADD COLUMN tool_calls JSON NULL
          COMMENT '本轮工具调用轨迹（JSON 数组）' AFTER model
    `);

    await queryRunner.query(`
      ALTER TABLE messages
        ADD CONSTRAINT chk_messages_status
          CHECK (status IN ('completed', 'aborted', 'error'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE messages DROP CONSTRAINT chk_messages_status',
    );
    await queryRunner.query(`
      ALTER TABLE messages
        DROP COLUMN status,
        DROP COLUMN token_usage,
        DROP COLUMN thinking_ms,
        DROP COLUMN model,
        DROP COLUMN tool_calls
    `);
  }
}
