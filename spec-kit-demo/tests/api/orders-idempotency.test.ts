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

function postOrder(payload: Record<string, unknown>, requestId?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/orders',
    headers: requestId ? { 'idempotency-key': requestId } : {},
    payload,
  });
}

describe('POST /api/orders 幂等', () => {
  it('未携带 Idempotency-Key 返回 400 MISSING_REQUEST_ID（FR-010）', async () => {
    const res = await postOrder({ productId: 'p-1', quantity: 1 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('MISSING_REQUEST_ID');
  });

  it('同标识同请求体重放：返回 200 + 与首次完全相同的响应体，库存只扣一次', async () => {
    const first = await postOrder({ productId: 'p-1', quantity: 2 }, 'req-replay');
    expect(first.statusCode).toBe(201);

    const replay1 = await postOrder({ productId: 'p-1', quantity: 2 }, 'req-replay');
    const replay2 = await postOrder({ productId: 'p-1', quantity: 2 }, 'req-replay');

    expect(replay1.statusCode).toBe(200);
    expect(replay2.statusCode).toBe(200);
    expect(replay1.json()).toEqual(first.json());
    expect(replay2.json()).toEqual(first.json());

    const product = await app.inject({ method: 'GET', url: '/api/products/p-1' });
    expect(product.json().stock).toBe(8); // 10 - 2，仅扣一次
  });

  it('同标识不同请求体返回 409 REQUEST_ID_MISMATCH', async () => {
    await postOrder({ productId: 'p-1', quantity: 2 }, 'req-mismatch');

    const res = await postOrder({ productId: 'p-1', quantity: 3 }, 'req-mismatch');

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('REQUEST_ID_MISMATCH');
  });

  it('首次库存不足失败后，同标识重放返回相同的失败结果（库存只减不增，重放必然同败）', async () => {
    const first = await postOrder({ productId: 'p-3', quantity: 2 }, 'req-fail-replay');
    expect(first.statusCode).toBe(409);

    const replay = await postOrder({ productId: 'p-3', quantity: 2 }, 'req-fail-replay');

    expect(replay.statusCode).toBe(409);
    expect(replay.json()).toEqual(first.json());

    const product = await app.inject({ method: 'GET', url: '/api/products/p-3' });
    expect(product.json().stock).toBe(1); // 两次失败均未扣库存
  });
});
