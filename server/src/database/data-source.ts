import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { InitSchema1780000000000 } from './migrations/1780000000000-init-schema';
import { AddReasoningToMessages1780000000100 } from './migrations/1780000000100-add-reasoning-to-messages';

try {
  process.loadEnvFile();
} catch {
  // .env 不存在时使用系统环境变量
}

// TypeORM CLI 入口：pnpm migration:run / migration:revert
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'agent_demo',
  entities: [User, Conversation, Message],
  migrations: [InitSchema1780000000000, AddReasoningToMessages1780000000100],
  synchronize: false,
});
