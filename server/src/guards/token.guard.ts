import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

// 演示用的固定 token：前后端写死同一串，后续接入真实用户体系时换成 JWT/Session
export const DEMO_TOKEN = process.env.AUTH_TOKEN ?? 'dev-token-2024';

/**
 * Token 校验守卫：请求头携带 Authorization: Bearer <token> 才放行。
 * 在 AppModule 通过 APP_GUARD 全局注册，所有接口默认受保护
 */
@Injectable()
export class TokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // 全局守卫会拦所有上下文：RabbitMQ 消费者是 RPC 上下文，没有 HTTP 请求，
    // 必须放行，否则消息处理器会被守卫异常打断并无限重投
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (token !== DEMO_TOKEN) {
      throw new UnauthorizedException('token 无效或缺失');
    }
    return true;
  }
}
