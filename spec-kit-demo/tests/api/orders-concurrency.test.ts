import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { createDatabase } from '../../src/db/database.js';
import { seedProducts } from '../../src/db/seed.js';

let app: FastifyInstance;

beforeEach(async () => {
  const db = createDatabase(':memory:');
  seedProducts(db);
  app = buildApp(db);
  await app.ready();
});

// better-sqlite3 为同步驱动，并发请求在事件循环中串行执行；
// 本测试验证的是条件更新在并发语义下的正确性（等价于串行化后的防超卖保证）
async function race(productId: string, total: number) {
  return Promise.all(
    Array.from({ length: total }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/orders',
        headers: { 'idempotency-key': `race-${productId}-${i}` },
        payload: { productId, quantity: 1 },
      }),
    ),
  );
}

describe('POST /api/orders 并发抢购', () => {
  it('库存为 1 时 100 并发：恰好 1 个 201、99 个 409，最终库存为 0 不为负', async () => {
    const results = await race('p-3', 100);

    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(99);
    for (const r of results.filter((r) => r.statusCode === 409)) {
      expect(r.json().error.code).toBe('INSUFFICIENT_STOCK');
    }

    const product = await app.inject({ method: 'GET', url: '/api/products/p-3' });
    expect(product.json().stock).toBe(0);
  });

  it('库存为 5 时 10 并发：恰好 5 成功 5 失败，最终库存为 0', async () => {
    const results = await race('p-2', 10);

    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(5);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(5);

    const product = await app.inject({ method: 'GET', url: '/api/products/p-2' });
    expect(product.json().stock).toBe(0);
  });
});
