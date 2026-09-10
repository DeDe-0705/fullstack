import type { FastifyInstance } from 'fastify';
import type { AppDatabase } from '../db/database.js';
import { MissingRequestIdError } from '../errors.js';
import { getOrderById, placeOrder } from '../services/orderService.js';

interface CreateOrderBody {
  productId?: unknown;
  quantity?: unknown;
}

export function registerOrderRoutes(app: FastifyInstance, db: AppDatabase): void {
  app.post('/api/orders', async (req, reply) => {
    // 缺标识即拒绝（FR-010）：服务端不代生成，否则无法区分新请求与重试，幂等失效
    const requestId = req.headers['idempotency-key'];
    if (typeof requestId !== 'string' || requestId.length === 0) {
      throw new MissingRequestIdError();
    }

    const body = (req.body ?? {}) as CreateOrderBody;
    const result = placeOrder(db, {
      requestId,
      productId: typeof body.productId === 'string' ? body.productId : '',
      // 非数字一律按 NaN 交给 service 判定为 INVALID_QUANTITY，路由不做业务规则
      quantity: typeof body.quantity === 'number' ? body.quantity : NaN,
    });

    // 201 = 首次创建；200 = 幂等重放（契约 D7：让客户端可感知「这是重放」）
    return reply.code(result.created ? 201 : 200).send(result.order);
  });

  app.get('/api/orders/:id', async (req) => {
    const { id } = req.params as { id: string };
    return getOrderById(db, id);
  });
}
