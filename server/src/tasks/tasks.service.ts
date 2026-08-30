import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../database/entities/conversation.entity';
import { Message } from '../database/entities/message.entity';
import { RedisLockService } from '../redis/lock.service';

/**
 * 定时任务 demo：每 30 秒统计一次会话/消息总量。
 *
 * 关键教学点：多实例部署时，每个实例的 cron 都会到点触发，
 * 任务会被重复执行 N 次（N=实例数）。解法是执行前抢分布式锁，
 * 没抢到的实例直接跳过——锁的 TTL 只需覆盖任务最长执行时间。
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger('TasksService');

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly lockService: RedisLockService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async collectConversationStats(): Promise<void> {
    const lockKey = 'lock:cron:conversation-stats';
    // 60s TTL > 任务执行时间，进程崩溃也能自愈
    const token = await this.lockService.acquire(lockKey, 60_000);
    if (!token) {
      this.logger.log('其他实例正在执行本次统计，跳过');
      return;
    }
    try {
      const [conversations, messages] = await Promise.all([
        this.conversationRepo.count(),
        this.messageRepo.count(),
      ]);
      this.logger.log(
        `[实例 ${process.pid}] 统计完成：会话 ${conversations} 个，消息 ${messages} 条`,
      );
    } finally {
      await this.lockService.release(lockKey, token);
    }
  }
}
