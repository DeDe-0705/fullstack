# NestJS + Redis 实战场景题

> 理论八股（数据结构/持久化/集群/锁原理）见 [Redis高频考点大全](./Redis高频考点大全.md)，
> 本文专注**落地**：NestJS 里怎么接 Redis、缓存代码怎么写、场景题怎么答出"具体方案"。
> 所有代码取自 `server/` 真实实现（ioredis + cache-aside）。

---

## 0. NestJS 接 Redis 的三种方式与选型

| 方式 | 适用场景 | 本项目选择 |
|---|---|---|
| 自建 `@Global()` 模块注入 `ioredis` 客户端 | 需要精细控制（缓存模式、锁、Lua），面试能讲透 | ✅ |
| `@nestjs/cache-manager` + redis store | 只要"方法级缓存注解"，不关心细节 | 适合快速业务 |
| BullMQ（底层强制 ioredis） | 队列/延迟任务/幂等消费 | 后续可加 |

**为什么选 ioredis 而不是官方 `redis` 包**：TypeORM 的 peer 依赖就是 ioredis（避免 node_modules 里两套客户端）；NestJS 生态（BullMQ 等）事实标准是 ioredis；Cluster/Sentinel 支持成熟。官方 node-redis 赢在 Redis 新特性跟进速度，纯新项目选它也成立。

### 全局模块（server/src/redis/redis.module.ts）

```ts
export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [{
    provide: REDIS_CLIENT,
    useFactory: () => {
      const client = new Redis({
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
        maxRetriesPerRequest: 1,                    // 不重试风暴：缓存是加速器不是依赖
        retryStrategy: (times) => Math.min(times * 200, 2000),
      });
      // 必须挂 error 监听，否则 ioredis 连接失败会以未捕获异常崩进程
      client.on('error', (err) => console.warn('[Redis] 降级直连DB:', err.message));
      return client;
    },
  }],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
```

要点（都能当追问答案）：

- `useFactory` 而不是直接 `new`：模块装饰器求值早于 `main.ts` 的 `.env` 加载，异步工厂保证读到环境变量（和 TypeORM `forRootAsync` 同一个坑）。
- `@Global()` 只保证客户端全局可注入；注入点用 `@Inject(REDIS_CLIENT)`。
- `error` 监听不挂会**崩进程**，这是 ioredis 和 node 流式客户端的通用规则。

---

## 1. 场景题：缓存三兄弟（穿透/击穿/雪崩）

> 2026 大厂必问，且一定追问"你项目里怎么做的"（[2026 Redis 高频题](https://blog.csdn.net/dl962454/article/details/160742612)）。

### 1.1 缓存穿透：查不存在的数据

**题面**：有人用随机 ID 刷你的 `GET /api/conversations/:id`，每次缓存都不命中，请求全打到 MySQL。

**方案一：空值缓存（最常用）**

```ts
async getConversationById(id: string): Promise<Conversation> {
  const key = `cache:conv-detail:${id}`;
  const cached = await this.redis.get(key);
  if (cached) {
    if (cached === 'NULL') throw new NotFoundException('会话不存在'); // 空值标记
    return JSON.parse(cached);
  }
  const conversation = await this.conversationRepo.findOne({ where: { id } });
  if (!conversation) {
    // 不存在也缓存，但 TTL 要短（30~60s）：防穿透的同时容忍"刚创建就被查"的短期不一致
    await this.redis.set(key, 'NULL', 'EX', 30);
    throw new NotFoundException('会话不存在');
  }
  await this.redis.set(key, JSON.stringify(conversation), 'EX', 60);
  return conversation;
}
```

**方案二：布隆过滤器**（数据量大、非法 key 占比高时）：启动时把所有合法 ID 布进布隆过滤器，请求先过过滤器，"一定不存在"直接拒绝。代价：有误判率、删除麻烦（计数布隆/Cuckoo）。

**话术**：小流量恶意请求用空值缓存就够，成本低；布隆过滤器是"key 空间远大于真实数据"时的方案，比如短链系统。两个都要能讲。

### 1.2 缓存击穿：热点 key 过期瞬间

**题面**：某个百万阅读的会话详情缓存到期，瞬间几千个请求同时回源 MySQL。

**方案：互斥重建锁（SET NX + double check）**

```ts
async getHotConversation(id: string) {
  const key = `cache:conv-detail:${id}`;
  const lockKey = `lock:conv-detail:${id}`;

  const cached = await this.redis.get(key);
  if (cached) return JSON.parse(cached);

  // 只允许一个请求回源重建，其他请求短暂自旋后重读缓存
  const locked = await this.redis.set(lockKey, '1', 'EX', 5, 'NX');
  if (locked) {
    try {
      const data = await this.conversationRepo.findOne({ where: { id } });
      await this.redis.set(key, JSON.stringify(data), 'EX', 60);
      return data;
    } finally {
      await this.redis.del(lockKey);
    }
  }
  // 没抢到锁：等 50ms 重读（演示级实现；生产用逻辑过期更优雅）
  await new Promise((r) => setTimeout(r, 50));
  const retry = await this.redis.get(key);
  if (retry) return JSON.parse(retry);
  return this.conversationRepo.findOne({ where: { id } }); // 兜底回源
}
```

**追问"还有别的方案吗"**：逻辑过期——缓存不設 TTL，value 里带逻辑过期时间，发现过期后由**一个线程**异步重建，其他线程先返回旧数据。优点是无等待，缺点是容忍短暂旧数据，适合排行榜/Feed 这类场景。

### 1.3 缓存雪崩：大批 key 同时失效 / Redis 整体故障

**两个成因，两种药方**：

1. **大量 key 同一时刻过期** → TTL 加随机抖动。本项目已实现：

```ts
const ttl = 60 + Math.floor(Math.random() * 10); // 60~70s 错峰过期
await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
```

2. **Redis 实例宕机** → 缓存层不能成为单点依赖。本项目所有缓存操作 try/catch 降级直连 DB：

```ts
private async cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // Redis 故障降级为直连 DB
  }
}
```

**话术**："我项目里的设计假设是 Redis 随时会挂——所有缓存读写都有降级路径，接口在 Redis 宕机时功能不变只是变慢。高可用靠哨兵/集群（理论见考点大全第八章），代码层靠降级兜底。"

---

## 2. 场景题：缓存与 DB 一致性

**题面**：用户改了会话标题，怎么保证缓存不脏？

**本项目方案：Cache Aside + 写后删缓存**

```ts
async editConversation(id: string, userId: string, title: string) {
  // 1. 先更 DB（criteria 带 userId，affected=0 天然防越权）
  const result = await this.conversationRepo.update({ id, userId }, { title });
  if (result.affected === 0) throw new NotFoundException('会话不存在或无权限');
  // 2. 再删缓存（删而不是改：下次读时重建，避免并发写写乱序）
  await this.cacheDel(`cache:conv-detail:${id}`, `cache:conv-list:${userId}`);
  return this.getConversationById(id);
}
```

必背追问（理论细节见考点大全第七章）：

- **为什么删缓存而不是更新缓存**：并发写时两个线程更新缓存的顺序无法保证，会留下脏数据；删除是幂等的。
- **为什么先更 DB 再删缓存**：反过来有"删完缓存、DB 还没更、另一线程把旧值读进缓存"的窗口。
- **删缓存失败怎么办**：延迟双删（更 DB → 删缓存 → 延迟 500ms 再删一次）、或者把删除动作发 MQ 重试、或者靠 TTL 兜底（本项目策略，演示级可接受）。
- **要强一致呢**：缓存方案做不到强一致，强一致就上分布式锁把读写串行化——但那样缓存就失去意义了。面试要敢下这个结论。

---

## 3. 场景题：分布式锁（NestJS + ioredis 实现）

**题面**：防止同一个会话被并发创建/同一个任务被重复执行。

```ts
// 加锁：一条命令原子完成 SET NX + 过期时间
const token = randomUUID(); // 锁的持有者标识，防止误删别人的锁
const ok = await this.redis.set(`lock:task:${taskId}`, token, 'EX', 30, 'NX');
if (!ok) throw new BusinessException(10002, '任务正在执行中');

try {
  await doWork();
} finally {
  // 释放锁必须用 Lua 保证"判断持有者 + 删除"原子性：
  // 分开写成 GET + DEL，中间锁过期被别人抢走就会误删
  await this.redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
       return redis.call("del", KEYS[1])
     else return 0 end`,
    1, `lock:task:${taskId}`, token,
  );
}
```

追问准备（原理细节见考点大全第九章）：

- **锁过期了任务还没跑完**：Redisson 看门狗（默认 30s，每 10s 续期）；ioredis 要自己实现续期定时器。
- **Redis 主从切换丢锁**：锁写在 master 还没同步到 slave 时 master 宕机，新 master 没这把锁 → 同一把锁被两个客户端持有。引出 RedLock（多节点半数以上加锁）及其争议（Martin Kleppmann 的时钟漂移质疑），工程上多数人用"主从 +  fencing token"或直接用 etcd/ZK 做强一致锁。
- **可重入**：Redisson 用 Hash 结构（field=线程标识，value=重入次数）实现。

### 3.1 进阶：MQ 延迟消息做锁的「卡死兜底」（本项目已实现）

**场景**：同一会话同时只允许一个进行中的 AI 回复（`lock:conv:{id}:reply`）。进程崩溃时 `finally` 不执行，锁要等 TTL 过期才释放——TTL 设短了怕误伤长回复，设长了崩溃后会话被锁死很久。

**方案：三层释放机制**

```
1. 主释放：finally 里 Lua 脚本（token 校验 + 原子删除）——正常路径
2. MQ 兜底：加锁时发一条延迟消息（TTL+DLX 实现），到点后消费者
   带业务检查（查 DB：回复落库了吗？）再决定强制释放——比 TTL 早、比 TTL 聪明
3. Redis TTL：最后防线，前两层全失效也能自愈
```

关键代码（`server/src/mq/`，完整可运行）：

```ts
// 生产者：加锁成功后登记延迟检查（TTL+DLX：消息挂 TTL 进 delay 队列，
// 无人消费，过期后由死信交换机转发到真实队列）
await this.amqp.publish('app.delay', 'lock.release',
  { lockKey, token, conversationId, acquiredAt: Date.now() },
  { expiration: String(delayMs), persistent: true });

// 消费者：校验 token 仍是同一次持有，再查 DB 区分「完成但没释放」和「崩溃僵死」
@RabbitSubscribe({ exchange: 'app.events', routingKey: 'lock.release', queue: 'lock-release' })
async handleLockReleaseCheck(msg: LockReleaseMessage) {
  if (await this.lockService.getToken(msg.lockKey) !== msg.token) return; // 已正常释放
  const finished = await this.messageRepo.exists({ where: { conversationId: msg.conversationId, ... } });
  await this.lockService.release(msg.lockKey, msg.token); // 带日志区分两种异常
}
```

**面试要点**：

- MQ 兜底不是无脑删锁——消息是「检查」不是「命令」，到点先校验 token 再做业务判断；正常释放过的锁收到消息只是空转一次
- 崩溃检测逻辑活在 broker 里：发消息的应用实例死了，任何存活实例的消费者都能完成检测（本项目实测：kill -9 后重启任意实例，60s 后锁被强制释放）
- 延迟消息的实现：RabbitMQ 用 TTL+DLX（或 x-delayed-message 插件），RocketMQ 原生支持 18 个延迟级别，Kafka 没有原生延迟（要自研时间轮或借助外部组件）
- 已知限制：回复生成超过检查延迟会误判，生产要么把延迟设得大于 P99 耗时，要么加心跳续期

**实测踩到的坑（高价值）**：全局 `APP_GUARD`（TokenGuard）和 `APP_INTERCEPTOR`（ResponseInterceptor）会对 RabbitMQ 消费者生效，而 RPC 上下文没有 HTTP request/response，`switchToHttp().getRequest()` 返回 undefined 直接抛异常 → 消息处理失败无限重投。**解法：守卫和拦截器开头判断 `context.getType() !== 'http'` 直接放行**。这是 NestJS 接 MQ 的经典暗坑。

---

## 4. 场景题：接口限流（Guard + Redis）

**题面**：AI 对话接口贵，要求"每用户每分钟最多 20 条消息"。

```ts
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const key = `rate:addMessage:${req.body.userId}:${Math.floor(Date.now() / 60000)}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 70); // 第一次才设过期，留 10s 余量
    if (count > 20) throw new HttpException('请求过于频繁', 429);
    return true;
  }
}
```

**追问"固定窗口的临界问题"**：窗口边界处可能 1 秒内通过 2 倍配额（59s 打满 20 + 下一秒打满 20）。升级方案：

- **滑动窗口**：ZSet 存时间戳，`ZREMRANGEBYSCORE` 清窗口外 + `ZCARD` 计数，用 Lua 原子执行；
- **令牌桶**：Lua 脚本实现，或直接用 `@nest-lab/throttler` 这类现成库，面试讲清原理即可。

---

## 5. 场景题：登录态 / Token 存储

**方案**：登录成功发 accessToken（JWT，短效 2h）+ refreshToken（随机串，存 Redis 30 天）：

```
SET session:{refreshToken} {userId} EX 2592000
```

- 退出登录 = `DEL session:{token}`，立即生效（纯 JWT 做不到主动失效）；
- 续期 = 刷新时 `EXPIRE` 重置 TTL（滑动过期）；
- 单点登录互踢 = `SET login:{userId} {token}`，每次请求比对，旧 token 失效。

**本项目现状**：演示用固定 token（`TokenGuard`），接真实用户体系时换 JWT + Redis refresh 方案，这是面试时讲"演进路径"的好素材。

---

## 6. 场景题：Redis 挂了怎么办（降级设计）

面试官想听的是**你默认它会挂**：

1. **代码层**：所有缓存操作 try/catch，miss 即回源（本项目已实现，实测停掉 Redis 容器接口正常返回）；
2. **架构层**：主从 + 哨兵自动故障转移；客户端 `retryStrategy` 控制重连节奏不雪崩；
3. **保护 DB**：降级瞬间流量全打 DB，要给 DB 侧留保护——本项目已实现两层：TypeORM 连接池上限（`extra: { connectionLimit }`）+ 应用层并发信号量（见下），外加接口限流（见第 4 节）；
4. **观测**：缓存命中率、Redis 延迟要进监控（演示项目可在 LoggerMiddleware 里记 hit/miss 日志）。

### 6.1 DB 并发信号量（本项目已实现，server/src/database/db-semaphore.ts）

连接池只限制"物理连接数"，不限制"排队等待的请求数"——Redis 失效洪峰回源时，请求会在连接池前无限堆积。信号量在应用层挡洪峰：

```ts
// 核心：名额满了排队，排队超时快速失败（比无限堆积强）
export class DbSemaphore {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();       // 有名额直接放行，否则排队（带超时）
    try { return await fn(); }
    finally { this.release(); } // 释放名额，唤醒队列下一个
  }
}
```

配套设计（都能当追问答案）：

- **信号量 max 与连接池 connectionLimit 保持一致**（默认 20，`DB_MAX_CONCURRENCY` 可配）：信号量放行多少并发，连接池就得供得起多少连接，否则名额白排队；
- **排队超时快速失败**（3s）：抛 `DbConcurrencyLimitError`，业务层转成 `BusinessException(50300)`，客户端早收到失败还能重试，比 hang 住强；
- **ConversationService 所有 DB 访问统一过 `this.db(fn)`**，写突发（save + update + 查 owner 三条 SQL）共享一次名额申请；
- 实测：`DB_MAX_CONCURRENCY=3` 下 20 并发打到空缓存，日志出现 `并发已满(3)，排队中`，请求全部正常返回；单元验证超时路径能正确快速失败。

---

## 7. 其他高频小场景（一句话方案 + 数据结构）

| 场景 | 数据结构 | 关键命令 |
|---|---|---|
| 排行榜（token 消耗榜/活跃用户） | ZSet | `ZINCRBY` / `ZREVRANGE` |
| 会话列表"最新消息"预览 | String(JSON) | 写消息时同步更新 `conv-preview:{id}` |
| 工具调用去重/幂等键 | String | `SET idem:{key} 1 NX EX 86400` |
| 延迟任务（30min 未支付关闭） | ZSet(score=执行时间) | `ZRANGEBYSCORE` 轮询，或 BullMQ delayed job |
| 分布式计数（阅读数） | String | `INCR`，定期落库 |
| 关注关系/共同好友 | Set | `SINTER` / `SISMEMBER` |

---

## 8. 面试话术模板（被问"你项目里 Redis 怎么用的"）

> "我在 NestJS 里用 `@Global()` 模块全局注入 ioredis 客户端，会话层做了 cache-aside 旁路缓存：列表、历史、详情三个热点读接口缓存默认第一页，TTL 60 秒加随机抖动防雪崩；写路径上先更 DB 再删对应 key。设计上我假设 Redis 随时会挂——所有缓存操作都有降级路径直连 DB，DB 侧再用「连接池 + 并发信号量」双层保护：信号量挡洪峰、排队超时快速失败，实测停掉 Redis 服务接口功能不受影响。分页只缓存第一页是刻意的取舍：这样失效时只需 DEL 固定 key，不用 SCAN；要缓存全部分页就得换版本号 key 方案。一致性上我接受秒级最终一致，靠 TTL 兜底，因为会话场景对实时性不敏感；如果做库存这类场景我会改成延迟双删 + 消息队列重试。"

这段话覆盖了：接入方式、缓存模式、三大问题、一致性、降级、取舍理由、演进方向——面试官的追问基本都在射程内。
