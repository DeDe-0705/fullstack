import type { AppDatabase } from './database.js';

const SEED_PRODUCTS = [
  { id: 'p-1', name: '机械键盘', stock: 10 },
  { id: 'p-2', name: '降噪耳机', stock: 5 },
  { id: 'p-3', name: '限量手办', stock: 1 }, // 库存为 1：专供并发抢购与库存不足场景
] as const;

// INSERT OR IGNORE：种子只在空库时生效，重启服务不会覆盖已扣减的库存
export function seedProducts(db: AppDatabase): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO products (id, name, stock) VALUES (?, ?, ?)',
  );
  for (const p of SEED_PRODUCTS) {
    insert.run(p.id, p.name, p.stock);
  }
}
