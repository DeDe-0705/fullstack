import { Global, Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../database/entities/message.entity';
import { MqService } from './mq.service';
import { LockReleaseConsumer } from './lock-release.consumer';

@Global()
@Module({
  imports: [
    // 消费者需要查 messages 表判断回复是否落库
    TypeOrmModule.forFeature([Message]),
    // forRootAsync：模块装饰器求值早于 main.ts 的 .env 加载，配置延迟到运行时读取
    RabbitMQModule.forRootAsync({
      useFactory: () => ({
        exchanges: [
          // 业务事件交换机：消费者订阅在这里
          { name: 'app.events', type: 'direct' },
          // 延迟入口交换机：配合 lock-release.delay 队列的 TTL+DLX 实现延迟投递
          { name: 'app.delay', type: 'direct' },
        ],
        uri: process.env.RABBITMQ_URL ?? 'amqp://127.0.0.1:5672',
        // MQ 挂了不阻塞应用启动，后台自动重连；锁的兜底不依赖单一组件
        connectionInitOptions: { wait: false },
      }),
    }),
  ],
  providers: [MqService, LockReleaseConsumer],
  exports: [MqService],
})
export class MqModule {}
