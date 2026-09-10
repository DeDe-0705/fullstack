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

describe('GET /api/products', () => {
  it('返回全部商品及各自当前库存', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products' });

    expect(res.statusCode).toBe(200);
    const { products } = res.json();
    expect(products).toHaveLength(3);
    expect(products).toContainEqual({ id: 'p-1', name: '机械键盘', stock: 10 });
    expect(products).toContainEqual({ id: 'p-3', name: '限量手办', stock: 1 });
  });
});

describe('GET /api/products/:id', () => {
  it('返回单个商品的当前库存', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products/p-2' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: 'p-2', name: '降噪耳机', stock: 5 });
  });

  it('下单后再查，库存为扣减后的最新值', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'idempotency-key': 'req-read-after-write' },
      payload: { productId: 'p-1', quantity: 4 },
    });

    const res = await app.inject({ method: 'GET', url: '/api/products/p-1' });
    expect(res.json().stock).toBe(6);
  });

  it('商品不存在返回 404 PRODUCT_NOT_FOUND', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products/p-999' });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('PRODUCT_NOT_FOUND');
  });
});
