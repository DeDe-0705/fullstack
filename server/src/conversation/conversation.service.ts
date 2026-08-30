import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { DbSemaphore, DbConcurrencyLimitError } from '../database/db-semaphore';
import { CircuitBreaker } from '../common/circuit-breaker';
import { User } from '../database/entities/user.entity';
import { Conversation } from '../database/entities/conversation.entity';
import { Message } from '../database/entities/message.entity';
import { BusinessException } from '../exceptions/business.exception';
import {
  AddMessageInput,
  Page,
  PaginationOptions,
} from './interfaces/conversation.types';

export type { AddMessageInput, Page } from './interfaces/conversation.types';

// 缓存 TTL 基础秒数；加随机抖动防缓存雪崩（大量 key 同一时刻失效回源 DB）
const CACHE_TTL_SECONDS = 60;
const cacheKey = {
  conversationList: (userId: string) => `cache:conv-list:${userId}`,
  conversationDetail: (conversationId: string) => `cache:conv-detail:${conversationId}`,
  history: (conversationId: string) => `cache:conv-history:${conversationId}`,
};

@Injectable()
export class ConversationService {
  // Redis 熔断：挂了之后跳过缓存直连 DB，省掉每次连接失败的开销；
  // DB 熔断：持续故障时立即失败，不再排队等 3s（与 DbSemaphore 的快速失败互补）
  private readonly redisBreaker = new CircuitBreaker('redis', 3, 10_000);
  private readonly dbBreaker = new CircuitBreaker('mysql', 5, 10_000);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly dbSemaphore: DbSemaphore,
  ) { }

  // 只有「基础设施故障」才算熔断依据；SQL 语义错误（唯一键冲突等）是业务失败，不代表 DB 病了
  private isDbInfraError (err: unknown): boolean {
    if (err instanceof DbConcurrencyLimitError) return true;
    const code = (err as { code?: string })?.code ?? '';
    return ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'EPIPE'].includes(code);
  }

  // 所有 DB 访问统一过「熔断 + 并发池」：熔断挡持续故障，并发池挡瞬时洪峰
  private async db<T> (fn: () => Promise<T>): Promise<T> {
    if (!this.dbBreaker.canPass()) {
      throw new BusinessException(50301, '数据库熔断中，请稍后重试');
    }
    try {
      const result = await this.dbSemaphore.run(fn);
      this.dbBreaker.onSuccess();
      return result;
    } catch (err) {
      if (this.isDbInfraError(err)) this.dbBreaker.onFailure();
      if (err instanceof DbConcurrencyLimitError) {
        throw new BusinessException(50300, err.message);
      }
      throw err;
    }
  }

  // 缓存只加速默认第一页的读请求（覆盖 90%+ 场景）；带自定义分页参数的直接回源 DB。
  // 这样失效时只需 DEL 固定 key，避免 SCAN 全库清缓存。
  private async cacheGet<T> (key: string): Promise<T | null> {
    if (!this.redisBreaker.canPass()) return null; // 熔断中：跳过 Redis 直连 DB
    try {
      const raw = await this.redis.get(key);
      this.redisBreaker.onSuccess();
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      this.redisBreaker.onFailure();
      return null; // Redis 故障降级为直连 DB，缓存绝不能成为单点依赖
    }
  }

  private async cacheSet (key: string, value: unknown): Promise<void> {
    if (!this.redisBreaker.canPass()) return;
    try {
      const ttl = CACHE_TTL_SECONDS + Math.floor(Math.random() * 10);
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
      this.redisBreaker.onSuccess();
    } catch {
      this.redisBreaker.onFailure();
    }
  }

  private async cacheDel (...keys: string[]): Promise<void> {
    if (!this.redisBreaker.canPass()) return;
    try {
      if (keys.length > 0) await this.redis.del(...keys);
      this.redisBreaker.onSuccess();
    } catch {
      this.redisBreaker.onFailure();
    }
  }

  // 显式注册：用户名已存在时返回业务码 10001，不允许静默复用
  async createUser (name: string): Promise<User> {
    const trimmed = name.trim();
    const existing = await this.userRepo.findOne({ where: { name: trimmed } });
    if (existing) throw new BusinessException(10001, '用户名已存在');
    return this.userRepo.save(this.userRepo.create({ name: trimmed }));
  }

  async findUserById (id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  // 存在性校验下沉到 service：controller 只接线，不判断
  async getUserById (id: string): Promise<User> {
    const user = await this.findUserById(id);
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async getUserByName (name: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { name } });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async listConversations (
    userId: string,
    pagination: PaginationOptions = {},
  ): Promise<Page<Conversation>> {
    const { limit = 20, offset = 0 } = pagination;
    const useCache = limit === 20 && offset === 0;
    const key = cacheKey.conversationList(userId);
    if (useCache) {
      const cached = await this.cacheGet<Page<Conversation>>(key);
      if (cached) return cached;
    }
    const [items, total] = await this.db(() => this.conversationRepo.findAndCount({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: limit,
      skip: offset,
    }));
    const page = { items, total };
    if (useCache) await this.cacheSet(key, page);
    return page;
  }

  async createConversation (userId: string, title?: string): Promise<Conversation> {
    // 会话必须挂在真实用户下
    await this.getUserById(userId);
    const conversation = await this.db(() => this.conversationRepo.save(
      this.conversationRepo.create({ userId, title: title?.trim() || '新对话' }),
    ));
    // 写后失效：新增会话会让该用户的会话列表缓存过期
    await this.cacheDel(cacheKey.conversationList(userId));
    return conversation;
  }

  async editConversation (conversationId: string, userId: string, title: string): Promise<Conversation> {
    // criteria 带上 userId：条件不匹配就 affected=0，天然防越权改他人会话
    const result = await this.db(() => this.conversationRepo.update(
      { id: conversationId, userId },
      { title: title.trim() }
    ));

    if (result.affected === 0) {
      throw new NotFoundException('会话不存在或无权限');
    }
    // 写后失效：标题变了，详情与列表缓存都要清
    await this.cacheDel(
      cacheKey.conversationDetail(conversationId),
      cacheKey.conversationList(userId),
    );
    // update 只发 UPDATE 不返回实体，raw 是驱动层结果；重新查一次返回给前端
    return this.getConversationById(conversationId);
  }

  async getConversationById (id: string): Promise<Conversation> {
    const key = cacheKey.conversationDetail(id);
    const cached = await this.cacheGet<Conversation>(key);
    if (cached) return cached;
    const conversation = await this.db(() => this.conversationRepo.findOne({ where: { id } }));
    if (!conversation) throw new NotFoundException('会话不存在');
    await this.cacheSet(key, conversation);
    return conversation;
  }

  async getHistory (
    conversationId: string,
    pagination: PaginationOptions = {},
  ): Promise<Page<Message>> {
    const { limit = 50, offset = 0 } = pagination;
    const useCache = limit === 50 && offset === 0;
    const key = cacheKey.history(conversationId);
    if (useCache) {
      const cached = await this.cacheGet<Page<Message>>(key);
      if (cached) return cached;
    }
    // 先按 id 倒序取最近一段，再反转为正序返回，顺序稳定且天然支持分页
    const [rows, total] = await this.db(() => this.messageRepo.findAndCount({
      where: { conversationId },
      order: { id: 'DESC' },
      take: limit,
      skip: offset,
    }));
    const page = { items: rows.reverse(), total };
    if (useCache) await this.cacheSet(key, page);
    return page;
  }

  async addMessage (input: AddMessageInput): Promise<Message> {
    // 一次写突发只占一个并发名额：save + 刷新 updatedAt + 查 owner 三条 SQL 共享同一次申请
    const { message, owner } = await this.db(async () => {
      const message = await this.messageRepo.save(
        this.messageRepo.create({
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          reasoning: input.reasoning ?? null,
          status: input.status ?? 'completed',
          tokenUsage: input.tokenUsage ?? null,
          thinkingMs: input.thinkingMs ?? null,
          provider: input.provider ?? null,
          model: input.model ?? null,
          toolCalls: input.toolCalls ?? null,
        }),
      );
      // 会话列表按 updated_at 倒序，新消息刷新会话的更新时间
      await this.conversationRepo.update(
        { id: input.conversationId },
        { updatedAt: new Date() },
      );
      const owner = await this.conversationRepo.findOne({
        where: { id: input.conversationId },
        select: { userId: true },
      });
      return { message, owner };
    });
    // 写后失效：历史、详情（updatedAt 变了）、所属用户的会话列表都过期
    await this.cacheDel(
      cacheKey.history(input.conversationId),
      cacheKey.conversationDetail(input.conversationId),
      ...(owner ? [cacheKey.conversationList(owner.userId)] : []),
    );
    return message;
  }
}
