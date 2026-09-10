import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type AppDatabase } from '../../src/db/database.js';
import { seedProducts } from '../../src/db/seed.js';
import { InsufficientStockError } from '../../src/errors.js';
import { placeOrder } from '../../src/services/orderService.js';

let db: AppDatabase;

beforeEach(() => {
  db = createDatabase(':memory:');
  seedProducts(db);
});

function stockOf(productId: string): number {
  const row = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as { stock: number };
  return row.stock;
}

function orderCount(): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number };
  return row.n;
}

describe('placeOrder', () => {
  it('下单成功：扣减库存、写入订单，remainingStock 为扣减完成时刻的快照', () => {
    const result = placeOrder(db, { requestId: 'req-1', productId: 'p-1', quantity: 3 });

    expect(result.created).toBe(true);
    expect(result.order).toMatchObject({ productId: 'p-1', quantity: 3, remainingStock: 7 });
    expect(result.order.orderId).toMatch(/^ord-/);
    expect(stockOf('p-1')).toBe(7);
    expect(orderCount()).toBe(1);
  });

  it('恰好买空：购买数量等于库存时成功，剩余库存为 0', () => {
    const result = placeOrder(db, { requestId: 'req-2', productId: 'p-3', quantity: 1 });

    expect(result.order.remainingStock).toBe(0);
    expect(stockOf('p-3')).toBe(0);
  });

  it('库存不足：抛 InsufficientStockError，事务回滚——库存不变、不产生订单', () => {
    expect(() => placeOrder(db, { requestId: 'req-3', productId: 'p-3', quantity: 2 })).toThrow(
      InsufficientStockError,
    );

    expect(stockOf('p-3')).toBe(1);
    expect(orderCount()).toBe(0);
  });

  it('库存为 0 时下单失败，库存保持为 0 不为负', () => {
    placeOrder(db, { requestId: 'req-4', productId: 'p-3', quantity: 1 });

    expect(() => placeOrder(db, { requestId: 'req-5', productId: 'p-3', quantity: 1 })).toThrow(
      InsufficientStockError,
    );
    expect(stockOf('p-3')).toBe(0);
  });
});
