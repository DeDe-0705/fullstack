import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BusinessException } from '../exceptions/business.exception';

// 统一响应体：业务码 + 数据 + 提示 + 链路追踪 id
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
  trace_id: string;
}

/**
 * 响应拦截器：JSON 接口统一包成 ApiResponse，成功与失败同构。
 * - 成功：code 0 + data
 * - BusinessException：HTTP 200 + 业务码 + 错误信息
 * - 其他 HttpException（ValidationPipe 400 等）：保持 HTTP 状态码，body 同构
 * - 未知异常：500 + 通用文案（细节只进服务端日志，不透给前端）
 * SSE 流式接口（text/event-stream 或响应已开始手动写入）跳过包装。
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T | null> | T>
{
  private readonly logger = new Logger('ResponseInterceptor');

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T | null> | T> {
    // RabbitMQ 等 RPC 上下文没有 HTTP 响应对象，原样放行（与 TokenGuard 同理）
    if (context.getType() !== 'http') return next.handle();
    const res = context.switchToHttp().getResponse<Response>();
    const traceId = randomUUID();
    res.setHeader('x-trace-id', traceId);

    // SSE / 手动 @Res 写流：Nest 不会再序列化返回值，成功与失败都原样放行
    const isSse = () => {
      const contentType = res.getHeader('Content-Type')?.toString() ?? '';
      return contentType.includes('text/event-stream') || res.headersSent;
    };

    return next.handle().pipe(
      map((data) => {
        if (isSse()) return data;
        // code 为业务码，与 HTTP 状态码解耦：0 成功，业务异常用非 0
        return { code: 0, data, message: 'ok', trace_id: traceId };
      }),
      catchError((error: unknown) => {
        if (isSse()) throw error;

        if (error instanceof BusinessException) {
          res.status(error.httpStatus);
          return of({
            code: error.bizCode,
            data: null,
            message: error.message,
            trace_id: traceId,
          });
        }

        if (error instanceof HttpException) {
          const status = error.getStatus();
          res.status(status);
          return of({
            code: status,
            data: null,
            // ValidationPipe 抛的 BadRequestException，message 是数组，拼成一句话
            message: this.extractMessage(error),
            trace_id: traceId,
          });
        }

        // 未知异常：记录完整堆栈供排查，前端只给通用文案 + trace_id
        this.logger.error(`未捕获异常 trace_id=${traceId}`, error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR);
        return of({
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          data: null,
          message: '服务器内部错误，请稍后再试',
          trace_id: traceId,
        });
      }),
    );
  }

  private extractMessage(error: HttpException): string {
    const body = error.getResponse();
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message: unknown }).message;
      if (Array.isArray(message)) return message.join('；');
      if (typeof message === 'string') return message;
    }
    return error.message;
  }
}
