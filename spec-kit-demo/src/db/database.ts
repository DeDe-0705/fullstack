import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type AppDatabase = Database.Database;

// 业务不变量（宪法 III）的数据库层兜底集中在这里：
// stock CHECK >= 0（库存永不为负）、quantity CHECK > 0、request_id UNIQUE（幂等兜底）
export function createDatabase(path: string): AppDatabase {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK (stock >= 0)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      remaining_stock INTEGER NOT NULL CHECK (remaining_stock >= 0),
      created_at TEXT NOT NULL
    );
  `);
  return db;
}
