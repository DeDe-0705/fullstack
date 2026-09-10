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

function postOrder(payload: unknown, requestId = 'req-test-1') {
  return app.inject({
    method: 'POST',
    url: '/api/orders',
    headers: { 'idempotency-key': requestId },
    payload: payload as Record<string, unknown>,
  });
}

describe('POST /api/orders', () => {
  it('首次下单成功返回 201，响应体符合契约', async () => {
    const res = await postOrder({ productId: 'p-1', quantity: 2 });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ productId: 'p-1', quantity: 2, remainingStock: 8 });
    expect(body.orderId).toMatch(/^ord-/);
    expect(typeof body.createdAt).toBe('string');
  });

  it('恰好买空返回 remainingStock = 0', async () => {
    const res = await postOrder({ productId: 'p-3', quantity: 1 });

    expect(res.statusCode).toBe(201);
    expect(res.json().remainingStock).toBe(0);
  });

  it('库存不足返回 409 INSUFFICIENT_STOCK，message 为「库存不足」，且库存不变', async () => {
    const res = await postOrder({ productId: 'p-3', quantity: 2 });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'INSUFFICIENT_STOCK', message: '库存不足' } });

    const product = await app.inject({ method: 'GET', url: '/api/products/p-3' });
    expect(product.json().stock).toBe(1);
  });

  it.each([0, -1, 1.5, 'abc'])('非法购买数量 %s 返回 400 INVALID_QUANTITY', async (quantity) => {
    const res = await postOrder({ productId: 'p-1', quantity });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_QUANTITY');
  });

  it('商品不存在返回 404 PRODUCT_NOT_FOUND', async () => {
    const res = await postOrder({ productId: 'p-999', quantity: 1 });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('GET /api/orders/:id', () => {
  it('返回订单详情（商品、数量、扣减后剩余库存快照）', async () => {
    const created = await postOrder({ productId: 'p-1', quantity: 3 });
    const { orderId } = created.json();

    const res = await app.inject({ method: 'GET', url: `/api/orders/${orderId}` });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ orderId, productId: 'p-1', quantity: 3, remainingStock: 7 });
  });

  it('订单不存在返回 404 ORDER_NOT_FOUND', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orders/ord-nope' });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('ORDER_NOT_FOUND');
  });
});
