# TypeORM 读写优化与幂等方案

> NestJS + TypeORM 场景下，解决两个高频问题：**查得快**（读优化）和**写不重**（幂等 / 防重复写入）。核心结论一句话：
>
> **读得快靠「索引 + 缓存 + 读写分离」，写幂等靠「数据库唯一约束兜底 + 业务幂等键」。**

---

## 一、读优化（查找速度快）

### 1.1 索引 —— 永远的第一优先级

慢查询 90% 靠索引解决。TypeORM 这样建：

```typescript
@Entity()
@Index(['userId', 'status'])   // 联合索引：注意最左前缀
export class Order {
  @PrimaryGeneratedColumn() id: number;

  @Column()
  @Index()                     // 单列索引
  orderNo: string;

  @Column() userId: number;
  @Column() status: string;
}
```

要点（与《MySQL 高频考点与手写 SQL》呼应）：

- WHERE / JOIN / ORDER BY 的字段建索引；
- 联合索引按查询模式设计顺序，遵循**最左前缀**；
- 只查索引里有的字段走**覆盖索引**，避免回表（TypeORM 用 `select` 指定字段）；
- 别在索引列上套函数、隐式转换、`LIKE '%x'`，会导致索引失效。

### 1.2 Redis 缓存 —— 扛高并发读

热点数据别每次都打 DB，采用 **Cache-Aside** 模式（先读缓存，未命中再查库并回填）：

```typescript
const cached = await redis.get(`product:${id}`);
if (cached) return JSON.parse(cached);

const product = await repo.findOne({ where: { id } });
await redis.set(`product:${id}`, JSON.stringify(product), 'EX', 300);
return product;
```

必须防住三兄弟（面试必考）：

| 问题 | 场景 | 方案 |
|---|---|---|
| 穿透 | 查不存在的 key，请求直达 DB | 缓存空值（短 TTL）/ 布隆过滤器 |
| 击穿 | 热点 key 过期瞬间大量请求打 DB | 互斥锁重建 / 逻辑过期 |
| 雪崩 | 大量 key 同时过期 | 过期时间加随机值 / 多级缓存 |

多级缓存进阶：本地缓存（Caffeine/Guava 思路）+ Redis Cluster，热点 key 分散。

### 1.3 读写分离

读多写少时，读走从库、写走主库。TypeORM 配 `replication`：

```typescript
TypeOrmModule.forRoot({
  type: 'mysql',
  replication: {
    master: { host: '主库', /* ... */ },
    slaves: [{ host: '从库1', /* ... */ }],
  },
})
```

注意：主从有**复制延迟**，强一致场景（刚写完马上读）必须走主库，否则读到旧数据。

### 1.4 避免 N+1 —— TypeORM 最典型的坑

N+1 = 查 N 条主记录，再为每条发起 1 次关联查询，共 N+1 次 DB 请求。

```typescript
// ❌ 懒加载导致 N+1
const users = await userRepo.find();
// 访问每个 user.posts 时再查一次 → 101 次请求

// ✅ 预加载，一次 JOIN 查出来
const users = await userRepo.find({ relations: ['posts'] });

// ✅ 显式连接，灵活且不加载多余数据
const users = await userRepo.createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'posts')
  .getMany();
```

原则：**优先显式连接（`leftJoinAndSelect`），谨慎全局 eager 加载**，避免加载不必要数据。GraphQL 场景可配合 DataLoader 批量合并查询。

### 1.5 深分页优化

`LIMIT 100000, 20` 会扫过前 10 万行。改用**游标分页**（记录上次主键/时间，`WHERE id > lastId`）替代 offset 深翻，或用「延迟关联」先查 id 再回表。

---

## 二、写幂等 / 防重复写入（重点）

防重复的本质一句话：**靠数据库唯一约束从根上杜绝，而不是靠「先查再插」。**

### 2.1 唯一约束 —— 最可靠，必须有

无论业务怎么做，最终都要在 DB 层建唯一约束兜底，否则并发下必翻车。

```typescript
@Entity()
@Unique(['userId', 'date'])   // 一个用户一天只能签到一次
export class SignInRecord {
  @PrimaryGeneratedColumn() id: number;

  @Column() userId: number;

  @Column({ type: 'date' }) date: string;
}
```

对应数据库唯一索引 `UNIQUE KEY (userId, date)`。「订单号唯一」「同一用户同一活动只能预约一次」都是这个套路。

### 2.2 onConflict / orIgnore —— 幂等写入

冲突了「忽略」或「更新」，重复请求不报错、天然幂等：

```typescript
// 冲突则忽略（INSERT IGNORE / ON CONFLICT DO NOTHING）
await repo.createQueryBuilder()
  .insert().into(SignInRecord)
  .values({ userId, date })
  .orIgnore()
  .execute();

// 冲突则更新（ON DUPLICATE KEY UPDATE / ON CONFLICT DO UPDATE）
await repo.createQueryBuilder()
  .insert().into(SignInRecord)
  .values({ userId, date })
  .orUpdate(['date'], ['userId', 'date'])
  .execute();
```

MySQL 底层是 `INSERT ... ON DUPLICATE KEY UPDATE`，PostgreSQL 是 `ON CONFLICT ... DO UPDATE/NOTHING`。

### 2.3 为什么「先查再插」不行

```typescript
// ❌ 有并发漏洞
const exist = await repo.findOne({ where: { userId, date } });
if (!exist) {
  await repo.save({ userId, date });
}
```

两个请求同时进来，都 `findOne` 查不到、都 `save` → 重复插入。因为「查」和「插」不是原子的，中间有窗口。**唯一约束才是真正的兜底**，先查再插只能做「快速失败」的优化，不能当防线。

### 2.4 业务幂等键（接口层幂等）

适用于「支付回调」「重复点击提交」。两种实现：

**① 幂等 Token（防重复提交）**

```typescript
// 进入表单页：后端生成 token 存 Redis
await redis.set(`token:${token}`, '1', 'EX', 300, 'NX');

// 提交时：原子地校验并消费 token（GETDEL，避免「判断+删除」两步非原子）
const consumed = await redis.getdel(`token:${token}`);
if (!consumed) {
  throw new ConflictException('重复提交');
}
// 处理业务...
```

**② Redis SETNX 分布式锁（幂等键）**

```typescript
const ok = await redis.set(`idem:${idempotencyKey}`, '1', 'EX', 300, 'NX');
if (!ok) {
  return 已处理的结果;   // 后续重复请求直接返回
}
// 处理业务...
```

**关键提醒**：Redis `SETNX` 只是**第一道防线**，不能当唯一防线——TTL 过期后、或高并发原子性边界下仍可能重复。**最终必须配合 DB 唯一约束（2.1）兜底**。这也是社区文章反复强调的：光靠 Redis 做幂等是「probably broken」。

### 2.5 乐观锁（更新场景的并发控制）

注意区分两个概念：**幂等**是「同一请求执行多次结果相同」（防重复插入/重复扣款）；**乐观锁**是「防并发更新互相覆盖」（防丢失更新）。二者都是并发控制，但解决不同问题。

TypeORM 用 `@VersionColumn`：

```typescript
@Entity()
export class Order {
  @PrimaryGeneratedColumn() id: number;

  @Column() status: string;

  @VersionColumn() version: number;   // 更新时自动 +1
}

// 更新时带 version 条件，version 不匹配说明被并发改过，抛出 OptimisticLockError
await repo.update({ id, version }, { status: 'paid' });
```

### 2.6 消息队列消费幂等

MQ 可能重复投递，消费端用**去重表**：消息 ID 存唯一键，消费前先插，冲突说明已处理过则跳过。

```typescript
await dataSource.transaction(async (manager) => {
  await manager.insert(ConsumeRecord, { msgId });   // 唯一键兜底
  // 再处理业务，冲突则回滚并跳过
});
```

---

## 三、经典场景对照

| 场景 | 方案 |
|---|---|
| 用户一天只能签到一次 | `@Unique(['userId','date'])` + `orIgnore` |
| 订单号不可重复 | 唯一索引 + `orIgnore` 幂等写入 |
| 支付回调不重复扣款 | 支付单号唯一键 + 去重表 + 事务 |
| 前端重复点击提交 | 幂等 Token（Redis GETDEL） |
| 同一人同一时段重复预约 | `@Unique(['userId','timeSlot'])` 兜底 |
| 并发改同一条记录 | `@VersionColumn` 乐观锁 |
| MQ 重复消费 | 去重表（消息 ID 唯一键） |

---

## 四、面试话术（直接背）

> **读性能**：索引解决慢查询（联合索引 + 覆盖索引），Redis 缓存扛热点（防穿透/击穿/雪崩），读写分离扛流量（注意主从延迟），并避免 N+1（显式 join 预加载）。
>
> **写幂等**：数据库唯一约束兜底（`@Unique` + `onConflict/orIgnore`），接口层用幂等键（Redis `SETNX`/`GETDEL`），MQ 用去重表。核心是「**并发下靠 DB 约束保证，不是靠先查再插**」，Redis 只是第一道防线。

---

## 五、来源

- TypeORM 官方文档《Performance Optimization》：N+1 问题与 `leftJoinAndSelect` / `innerJoinAndSelect`
- nestarc.dev《Why Your NestJS Idempotency Implementation Is Probably Broken》：Redis SET NX 的局限、IETF Idempotency-Key 草案、DB 唯一约束兜底
- advanced-java《分布式系统幂等性》：不能重复扣款/重复插入/统计值多加 1
- 腾讯云开发者社区《如何避免订单重复提交》：幂等 Token 生成、校验、高并发原子性
- CSDN《后端开发面试高频场景题》：接口幂等性保障方案（网络重试、前端重复提交、消息重发）
- 阿里后端面经：支付回调「不重复支付」、消费场景幂等
