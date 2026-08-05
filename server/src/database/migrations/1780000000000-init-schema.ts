import { MigrationInterface, QueryRunner } from 'typeorm';

// 初始表结构：与实体定义保持一致，生产环境以 migration 为准
export class InitSchema1780000000000 implements MigrationInterface {
  name = 'InitSchema1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
        name VARCHAR(64) NOT NULL COMMENT '用户名',
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_users_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表'
    `);

    await queryRunner.query(`
      CREATE TABLE conversations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会话ID',
        user_id BIGINT UNSIGNED NOT NULL COMMENT '所属用户ID',
        title VARCHAR(128) NOT NULL DEFAULT '新对话' COMMENT '会话标题',
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
          ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
        PRIMARY KEY (id),
        KEY idx_conversations_user_updated (user_id, updated_at),
        CONSTRAINT fk_conversations_user
          FOREIGN KEY (user_id) REFERENCES users (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会话表'
    `);

    await queryRunner.query(`
      CREATE TABLE messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '消息ID',
        conversation_id BIGINT UNSIGNED NOT NULL COMMENT '所属会话ID',
        role VARCHAR(16) NOT NULL COMMENT '角色: user/assistant/tool/system',
        content TEXT NOT NULL COMMENT '消息内容',
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
        PRIMARY KEY (id),
        KEY idx_messages_conversation_id (conversation_id, id),
        CONSTRAINT fk_messages_conversation
          FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
        CONSTRAINT chk_messages_role
          CHECK (role IN ('user', 'assistant', 'tool', 'system'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS messages');
    await queryRunner.query('DROP TABLE IF EXISTS conversations');
    await queryRunner.query('DROP TABLE IF EXISTS users');
  }
}
