import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

/**
 * Redis 分布式锁：SET NX PX 加锁 + Lua 校验持有者原子释放。
 *
 * 释放必须带 token 校验：锁可能已过期被别人重拿，
 * 无脑 DEL 会误删他人的锁。Lua 保证「比较 + 删除」原子执行。
 */
@Injectable()
export class RedisLockService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * 尝试加锁，成功返回持有凭证 token，失败返回 null（不阻塞、不自旋）。
   * 调用方负责在 finally 里 release，ttlMs 是进程崩溃时的最后兜底。
   */
  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    try {
      const ok = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
      return ok === 'OK' ? token : null;
    } catch {
      return null; // Redis 故障时视为抢锁失败，快速失败比误放行安全
    }
  }

  /** 释放锁：仅当锁仍由该 token 持有时才删除，返回是否真正释放 */
  async release(key: string, token: string): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then
           return redis.call("del", KEYS[1])
         else return 0 end`,
        1,
        key,
        token,
      );
      return result === 1;
    } catch {
      return false; // 释放失败靠 TTL 兜底过期
    }
  }

  /** 读取当前持有者 token，供 MQ 消费者判断是否仍是同一次持有 */
  async getToken(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }
}
