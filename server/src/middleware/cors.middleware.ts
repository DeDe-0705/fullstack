import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * 手写 CORS 中间件：演示跨域的完整机制（生产环境建议直接用 Nest 内置的 enableCors）。
 * 必须注册在 guard 之前：浏览器的预检请求（OPTIONS）不带自定义头，
 * 若被 TokenGuard 拦截返回 401，跨域请求会在预检阶段就失败
 */
@Injectable()
export class CorsMiddleware implements NestMiddleware {
  // 白名单从环境变量读，未配置时仅允许本地前端开发地址
  private readonly origins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());

  use(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;

    // 只有浏览器跨域请求才带 Origin 头；curl/服务端调用不带，直接放行
    if (origin && this.origins.includes(origin)) {
      // 回具体的 origin 而不是 *：白名单语义更明确，未来要携带 Cookie 时 * 也不合法
      res.setHeader('Access-Control-Allow-Origin', origin);
      // 响应随 Origin 不同而不同，告知 CDN/浏览器缓存按 Origin 区分
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      );
      // 覆盖业务实际用到的头：JSON body + token 鉴权
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // 预检请求只问"允不允许"，直接 204 结束，不进 guard 和业务逻辑
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  }
}
