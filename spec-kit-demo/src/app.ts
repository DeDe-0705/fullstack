import Fastify, { type FastifyInstance } from 'fastify';
import type { AppDatabase } from './db/database.js';
import { AppError, toErrorBody } from './errors.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerProductRoutes } from './routes/products.js';

// buildApp 与 server.ts 的 listen 分离：测试用 app.inject() 不起端口（研究 D6）
export function buildApp(db: AppDatabase): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send(toErrorBody(err));
    }
    // 未知错误统一兜底，不向调用方泄露内部细节
    return reply
      .code(500)
      .send({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } });
  });

  registerProductRoutes(app, db);
  registerOrderRoutes(app, db);
  return app;
}
