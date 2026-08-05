import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { InitSchema1780000000000 } from './migrations/1780000000000-init-schema';
import { AddReasoningToMessages1780000000100 } from './migrations/1780000000100-add-reasoning-to-messages';

@Global()
@Module({
  imports: [
    // 用 forRootAsync 在运行时读环境变量：模块装饰器求值早于 main 里的 .env 加载
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql' as const,
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? 3306),
        username: process.env.DB_USER ?? 'root',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_NAME ?? 'agent_demo',
        entities: [User, Conversation, Message],
        migrations: [InitSchema1780000000000, AddReasoningToMessages1780000000100],
        // 表结构必须由 migration 管理，禁止自动同步
        synchronize: false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
