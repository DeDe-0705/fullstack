import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// 统一响应体：业务码 + 数据 + 提示 + 链路追踪 id
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
  trace_id: string;
}

/**
 * 响应拦截器：JSON 接口统一包成 ApiResponse。
 * SSE 流式接口（content-type 为 text/event-stream，或响应已开始手动写入）跳过包装。
 * 注意：异常响应不走这里（走异常过滤器层），如需错误也统一格式，再加 ExceptionFilter
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    const res = context.switchToHttp().getResponse<Response>();
    const traceId = randomUUID();
    res.setHeader('x-trace-id', traceId);

    return next.handle().pipe(
      map((data) => {
        // SSE / 手动 @Res 写流：Nest 不会再序列化返回值，原样放行
        const contentType = res.getHeader('Content-Type')?.toString() ?? '';
        if (contentType.includes('text/event-stream') || res.headersSent) {
          return data;
        }
        // code 为业务码，与 HTTP 状态码解耦：0 成功，业务异常用非 0
        return { code: 0, data, message: 'ok', trace_id: traceId };
      }),
    );
  }
}
