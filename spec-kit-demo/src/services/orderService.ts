import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/database.js';
import {
  InsufficientStockError,
  InvalidQuantityError,
  OrderNotFoundError,
  ProductNotFoundError,
  RequestIdMismatchError,
} from '../errors.js';

export interface OrderDetail {
  orderId: string;
  productId: string;
  quantity: number;
  remainingStock: number;
  createdAt: string;
}

export interface PlaceOrderInput {
  requestId: string;
  productId: string;
  quantity: number;
}

export interface PlaceOrderResult {
  order: OrderDetail;
  /** true = 本次新建（HTTP 201）；false = 幂等重放（HTTP 200） */
  created: boolean;
}

interface OrderRow {
  id: string;
  request_id: string;
  product_id: string;
  quantity: number;
  remaining_stock: number;
  created_at: string;
}

function toDetail(row: OrderRow): OrderDetail {
  return {
    orderId: row.id,
    productId: row.product_id,
    quantity: row.quantity,
    remainingStock: row.remaining_stock,
    createdAt: row.created_at,
  };
}

export function placeOrder(db: AppDatabase, input: PlaceOrderInput): PlaceOrderResult {
  const { requestId, productId, quantity } = input;

  // 幂等第一道防线「先查」：常规重放（首单已提交后的双击/重试）在这里直接返回首单结果。
  // 只查成功订单即可——失败请求不产生订单，重放时会重新执行；
  // 库存只减不增，同一请求体的失败重放必然得到相同的失败结果（spec US3 场景 2）
  const existing = db
    .prepare('SELECT * FROM orders WHERE request_id = ?')
    .get(requestId) as OrderRow | undefined;
  if (existing) {
    if (existing.product_id !== productId || existing.quantity !== quantity) {
      throw new RequestIdMismatchError();
    }
    return { order: toDetail(existing), created: false };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InvalidQuantityError();
  }
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  try {
    // 扣库存 + 建订单必须在同一事务：任一步失败整体回滚，
    // 杜绝「扣了库存没订单」的中间态（研究 D5）
    return db.transaction((): PlaceOrderResult => {
      // 防超卖核心：单条条件 UPDATE 原子完成「校验 + 扣减」，
      // 不存在先 SELECT 再 UPDATE 的 check-then-act 竞态窗口；
      // 影响行数为 0 即库存不足（与 MySQL 场景题的原子扣减同一方案，研究 D3）
      const deducted = db
        .prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')
        .run(quantity, productId, quantity);
      if (deducted.changes === 0) {
        throw new InsufficientStockError();
      }

      // 快照语义：remaining_stock 取本订单扣减完成时刻的库存（FR-009），非实时库存
      const { stock } = db
        .prepare('SELECT stock FROM products WHERE id = ?')
        .get(productId) as { stock: number };

      const row: OrderRow = {
        id: `ord-${randomUUID()}`,
        request_id: requestId,
        product_id: productId,
        quantity,
        remaining_stock: stock,
        created_at: new Date().toISOString(),
      };
      db.prepare(
        `INSERT INTO orders (id, request_id, product_id, quantity, remaining_stock, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(row.id, row.request_id, row.product_id, row.quantity, row.remaining_stock, row.created_at);

      return { order: toDetail(row), created: true };
    })();
  } catch (err) {
    // 幂等第二道防线「唯一约束兜底」：并发下同标识两个请求同时穿透先查时，
    // 只有一个事务能插入成功；另一个事务整体回滚（库存不丢），
    // 在这里捕获冲突并重放胜者的结果（研究 D4）
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed: orders.request_id')) {
      const winner = db
        .prepare('SELECT * FROM orders WHERE request_id = ?')
        .get(requestId) as OrderRow | undefined;
      if (winner && winner.product_id === productId && winner.quantity === quantity) {
        return { order: toDetail(winner), created: false };
      }
      throw new RequestIdMismatchError();
    }
    throw err;
  }
}

export function getOrderById(db: AppDatabase, orderId: string): OrderDetail {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as OrderRow | undefined;
  if (!row) {
    throw new OrderNotFoundError(orderId);
  }
  return toDetail(row);
}
