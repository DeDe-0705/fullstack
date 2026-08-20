import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConversationModule } from './conversation/conversation.module';
import { ToolsModule } from './tools/tools.module';
import { AgentModule } from './agent/agent.module';
import { McpModule } from './mcp/mcp.module';
import { TokenGuard } from './guards/token.guard';
import { CorsMiddleware } from './middleware/cors.middleware';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { ResponseInterceptor } from './interceptors/response.interceptor';

@Module({
  imports: [DatabaseModule, ConversationModule, ToolsModule, AgentModule, McpModule],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局守卫：所有接口都需要 Authorization: Bearer <token>
    { provide: APP_GUARD, useClass: TokenGuard },
    // 全局拦截器：JSON 响应统一包装为 { code, data, message, trace_id }，SSE 除外
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 顺序即执行顺序：CORS 最前（预检请求直接短路，不进后续环节），日志随后
    consumer.apply(CorsMiddleware, LoggerMiddleware).forRoutes('*');
  }
}
