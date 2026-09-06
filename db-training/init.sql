-- ============================================================
-- 场景 1：事务与隔离级别
-- 用途：实测脏读 / 不可重复读 / 幻读
-- ============================================================

CREATE DATABASE IF NOT EXISTS train_tx
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE train_tx;

CREATE TABLE accounts (
  id      INT           NOT NULL AUTO_INCREMENT,
  name    VARCHAR(64)   NOT NULL,
  balance DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO accounts (name, balance) VALUES
  ('alice', 1000.00),
  ('bob',   1000.00);
