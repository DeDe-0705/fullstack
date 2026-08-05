-- ============================================================
-- agent_demo 数据库初始化脚本（MySQL 8.0+）
-- 说明：
--   1. 生产环境表结构以 TypeORM migration 为准（pnpm migration:run）；
--      本脚本用于首次建库或 DBA 手工初始化，结构保持一致。
--   2. 脚本幂等：表已存在时不会重建，不写入任何种子数据。
-- 执行方式：
--   mysql -u root -p < agent-demo-init.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS agent_demo
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE agent_demo;

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  name       VARCHAR(64)     NOT NULL                COMMENT '用户名',
  created_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_name (name)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='用户表';

-- ============================================================
-- 2. 会话表
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会话ID',
  user_id    BIGINT UNSIGNED NOT NULL                COMMENT '所属用户ID',
  title      VARCHAR(128)    NOT NULL DEFAULT '新对话' COMMENT '会话标题',
  created_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  updated_at DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                             ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_conversations_user_updated (user_id, updated_at),
  CONSTRAINT fk_conversations_user
    FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='会话表';

-- ============================================================
-- 3. 消息表
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  conversation_id BIGINT UNSIGNED NOT NULL                COMMENT '所属会话ID',
  role            VARCHAR(16)     NOT NULL                COMMENT '角色: user/assistant/tool/system',
  content         TEXT            NOT NULL                COMMENT '消息内容',
  created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_messages_conversation_id (conversation_id, id),
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT chk_messages_role
    CHECK (role IN ('user', 'assistant', 'tool', 'system'))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='消息表';
