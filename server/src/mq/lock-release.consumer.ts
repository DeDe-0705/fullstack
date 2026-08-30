import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Message } from '../database/entities/message.entity';
import { RedisLockService } from '../redis/lock.service';
import type { LockReleaseMessage } from './mq.service';

/**
 * 锁释放检查消费者：延迟消息到点后触发。
 *
 * 与 Redis TTL 的分工：TTL 是「无脑到点过期」的最后防线，
 * 这里的检查带有业务判断——查 DB 确认回复是否真的落库了，
 * 能区分两种异常：回复完成但 finally 释放失败 / 持有者崩溃回复中断。
 *
 * 已知限制：若回复生成时间超过检查延迟（演示 60s），会误判为僵死而
 * 提前释放。生产上要么把延迟设得大于回复 P99 耗时，要么给锁加心跳续期。
 */
@Injectable()
export class LockReleaseConsumer {
  constructor(
    private readonly lockService: RedisLockService,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
  ) {}

  @RabbitSubscribe({
    exchange: 'app.events',
    routingKey: 'lock.release',
    queue: 'lock-release',
  })
  async handleLockReleaseCheck(msg: LockReleaseMessage): Promise<void> {
    // 锁已正常释放或被新持有者重拿：消息只是空转，直接确认
    const current = await this.lockService.getToken(msg.lockKey);
    if (current !== msg.token) return;

    // 锁仍挂在原持有者手里：查 DB 看加锁之后是否有 assistant 回复落库
    const finished = await this.messageRepo.exists({
      where: {
        conversationId: msg.conversationId,
        role: 'assistant',
        createdAt: MoreThan(new Date(msg.acquiredAt)),
      },
    });

    await this.lockService.release(msg.lockKey, msg.token);
    console.warn(
      `[MQ] 锁超时未释放，已强制释放: ${msg.lockKey}（${
        finished
          ? '回复已落库，属 finally 释放失败'
          : '回复未落库，持有者大概率崩溃/僵死'
      }）`,
    );
  }
}
