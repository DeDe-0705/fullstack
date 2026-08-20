import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * 请求日志中间件：记录方法、路径、状态码、耗时。
 * 注意 NestJS 生命周期顺序：middleware → guard → interceptor → pipe，
 * 所以日志能看到所有请求（包括被 guard 拦下的 401）
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const start = Date.now();

    // finish 事件在响应写完后触发，此时才能拿到状态码和真实耗时
    res.on('finish', () => {
      const ms = Date.now() - start;
      this.logger.log(`${method} ${originalUrl} ${res.statusCode} +${ms}ms`);
    });

    next();
  }
}
