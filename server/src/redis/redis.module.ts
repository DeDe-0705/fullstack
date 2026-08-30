import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisLockService } from './lock.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT };

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      // 与 DatabaseModule 同理：useFactory 延迟到运行时读取 .env 加载后的环境变量
      useFactory: () => {
        const client = new Redis({
          host: process.env.REDIS_HOST ?? '127.0.0.1',
          port: Number(process.env.REDIS_PORT ?? 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          // 连接失败不重试风暴：缓存是加速器不是依赖，挂了要能降级回 DB
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => Math.min(times * 200, 2000),
          // 断线时命令立即报错而不是排队等重连：缓存命令挂住会拖慢整个请求，
          // 快速失败才能配合熔断器及时降级
          enableOfflineQueue: false,
          lazyConnect: false,
        });
        client.on('error', (err) => {
          // 必须挂 error 监听，否则 ioredis 连接失败会以未捕获异常崩进程
          console.warn('[Redis] 连接异常，缓存读写将降级为直连数据库:', err.message);
        });
        return client;
      },
    },
    RedisLockService,
  ],
  exports: [REDIS_CLIENT, RedisLockService],
})
export class RedisModule {}
