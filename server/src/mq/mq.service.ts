import { Injectable, OnModuleInit } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { Channel } from 'amqplib';

export interface LockReleaseMessage {
  lockKey: string;
  token: string;
  conversationId: string;
  acquiredAt: number;
}

@Injectable()
export class MqService implements OnModuleInit {
  constructor(private readonly amqp: AmqpConnection) {}

  // TTL + 死信交换机（DLX）实现延迟消息，RabbitMQ 原生没有延迟队列：
  // 消息先进 delay 队列（无人消费，挂着消息级 TTL），过期后由 DLX
  // 转发到 app.events 的真实队列，消费者在那里收到。
  // addSetup 保证断线重连后拓扑自动重建
  async onModuleInit(): Promise<void> {
    await this.amqp.managedChannel.addSetup(async (channel: Channel) => {
      await channel.assertQueue('lock-release.delay', {
        durable: true,
        deadLetterExchange: 'app.events',
        deadLetterRoutingKey: 'lock.release',
      });
      await channel.bindQueue('lock-release.delay', 'app.delay', 'lock.release');
    });
  }

  /**
   * 发布"锁释放检查"的延迟消息。
   * 注意语义：这是检查而非命令——到点后消费者会校验锁是否仍由
   * 原持有者拿着，正常释放过的锁收到消息只是空转一次。
   * MQ 故障不影响主流程：锁还有 Redis TTL 兜底。
   */
  async publishDelayedLockRelease(
    msg: LockReleaseMessage,
    delayMs: number,
  ): Promise<void> {
    try {
      await this.amqp.publish('app.delay', 'lock.release', msg, {
        expiration: String(delayMs), // 消息级 TTL，到点未消费则进入死信
        persistent: true,
      });
    } catch (err) {
      console.warn('[MQ] 延迟释放消息发送失败，锁将依赖 TTL 兜底过期', err);
    }
  }
}
