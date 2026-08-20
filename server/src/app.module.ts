import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConversationModule } from './conversation/conversation.module';
import { ToolsModule } from './tools/tools.module';
import { AgentModule } from './agent/agent.module';
import { McpModule } from './mcp/mcp.module';
import { TokenGuard } from './guards/token.guard';
import { LoggerMiddleware } from './middleware/logger.middleware';

@Module({
  imports: [DatabaseModule, ConversationModule, ToolsModule, AgentModule, McpModule],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局守卫：所有接口都需要 Authorization: Bearer <token>
    { provide: APP_GUARD, useClass: TokenGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 日志中间件挂在所有路由上，在 guard 之前执行
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
