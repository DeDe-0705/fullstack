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

**InnoDB 索引结构（回表的本质）**：聚簇索引（主键 B+ 树）叶子存整行，「索引即数据」；二级索引叶子存「索引列 + 主键 id」——那个 id 就是回表的车票：二级索引查到 id 后，若需要的列不在索引上，得再去聚簇索引按 id 捞整行。没建主键时 InnoDB 找第一个「唯一非空」索引顶上，再没有就用隐藏 6 字节 row_id。

**建索引决策清单（面试直接背）**

索引不是越多越好（读快是拿写慢换的：N 个二级索引 = 每次写入维护 N+1 棵 B+ 树；还占空间、干扰优化器选错），单表一般 ≤ 5~6 个。**按查询建索引，不是按列建索引**：

1. 先看查询再建索引，低频筛选（一年查一次）不配拥有索引；
2. 高区分度列优先（city 几十个值 > gender 两个值，后者优化器常直接放弃索引）；
3. 联合索引 > 多个单列索引（一次查询基本只走一棵索引树，两个单列索引 ≠ 两个条件都用上）；
4. 口诀：**等值在前、范围/排序在后**；范围列之后的索引列用不上；
5. 共享左前缀的查询合并成一个索引；建了 `(a,b,c)` 后单列 `(a)` 索引是冗余要删；
6. SELECT 的列塞进联合索引尾巴做覆盖索引，`Using index` 零回表；
7. 建完用 EXPLAIN 验证，不看执行计划等于没建。

**练习（orders 表设计索引）**：`orders(id, user_id, status, amount, created_at)`，高频查询：

```
① WHERE user_id = ? ORDER BY created_at DESC      （某用户订单列表）
② WHERE user_id = ? AND status = 'pending'        （某用户待支付）
③ WHERE status = 'paid' AND created_at >= 今天     （运营查今日已支付）
```

答案：**2 个索引**——

- `idx_user_status_time (user_id, status, created_at)`：② 双等值完美命中；① 走 user_id 前缀定位，排序不能完美用索引序（中间夹着 status），但单用户订单量小，内存 filesort 可接受（主动说出这个权衡是加分项）；
- `idx_status_time (status, created_at)`：等值 status 定位后 created_at 有序范围扫。只建 created_at 的话要扫「今天全部订单」再逐条回表判 status，明显更差。

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

**先会数**：查 20 条订单，每条再查 user + product → `1 + 20×2 = 41` 条 SQL。41 次网络往返 + 41 次连接占用，QPS 一上来连接池瞬间打满，RT 暴涨——典型的「代码没问题，系统被打死」。

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

**解法二：IN 批量查**（关系没配 / 跨库时的兜底）——41 条 → 3 条：

```typescript
const orders = await orderRepo.find({ take: 20, order: { createdAt: 'DESC' } });
const userIds = [...new Set(orders.map(o => o.userId))];  // 去重是细节：20 单可能只有 5 个用户
const users = await userRepo.findBy({ id: In(userIds) });  // WHERE id IN (...)
// 内存里 map 组装
```

原则：**优先显式连接（`leftJoinAndSelect`），谨慎全局 eager 加载**，避免加载不必要数据。GraphQL 场景可配合 DataLoader 批量合并查询（自动把同一 tick 的 findOne 合并成一次 IN，REST 用得少）。

**坑：JOIN + 分页**。JOIN 一对多关系时，`LIMIT 20` 限制的是 JOIN 后的行数而非主表条数（1 个订单 3 条明细占 3 行，可能只查出 7 个订单）。TypeORM 的 `take()` 遇到 to-many JOIN 会自动拆成「先查主表 id 再拉全量」两条 SQL；手写原生 SQL 必须自己处理。另外 IN 列表别塞上万个 id，要分批（约 500 个/批），防超 `max_allowed_packet`。

### 1.5 深分页优化

`LIMIT 100000, 20` 慢在哪？**OFFSET 不是「跳过去」，是「数过去」**——MySQL 从第 1 行数到第 100020 行，前 100000 行全部扔掉。耗时随页码线性增长（翻书比喻：找第 5000 页只能一页页翻）。排序字段没索引还要先 filesort，雪上加霜。

**解法一：游标分页 / Keyset（面试官最想听的）**——不数页码，记住「上次看到哪」：

```sql
-- 下一页：带上一页最后一条的 (created_at, id)
SELECT * FROM `order`
WHERE (created_at, id) < ('2026-09-01 10:00:00', 12345)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

直接命中索引只扫 20 行，第 1 页和第 5000 页一样快。`id` 是决胜条件（tiebreaker）：同一秒多单时防止漏/重。代价是不能跳页——所以抖音/朋友圈全是无限下滑，产品形态就是为游标分页设计的。

**解法二：延迟关联**（必须跳页时）——先用覆盖索引定位 20 个 id，再回表：

```sql
SELECT o.* FROM `order` o
JOIN (SELECT id FROM `order` ORDER BY created_at DESC LIMIT 100000, 20) t
  ON o.id = t.id;
```

子查询只扫索引不回表，数 10 万个索引项远快于数 10 万行完整数据，只回表 20 次。快 5-10 倍但治标。

**解法三：产品限深**。淘宝/谷歌翻到 100 页就不让翻了——真实用户翻不到，深翻的都是爬虫。

---

### 1.6 列表筛选：谓词下推与动态条件

后台列表页一堆筛选项，**99% 在数据库过滤（谓词下推），是必须而不是应该**。应用层过滤的灾难：

```typescript
// ❌ 全表捞到 Node 内存再 filter：网络几秒 + OOM + 索引全废 + 先 LIMIT 再 filter 页数全错
const all = await this.employeeRepo.find();
return all.filter(e => e.city === '北京' && e.salary > 10000);
```

DB 过滤顺序天然正确：`WHERE → ORDER BY → LIMIT`，先筛完再翻页。

**动态条件标准写法**（QueryBuilder 条件拼接，参数全走绑定防注入）：

```typescript
const qb = this.employeeRepo.createQueryBuilder('e');
if (query.city)      qb.andWhere('e.city = :city', { city: query.city });
if (query.minSalary) qb.andWhere('e.salary >= :min', { min: query.minSalary });
if (query.keyword)   qb.andWhere('e.name LIKE :kw', { kw: `${query.keyword}%` }); // 前缀模糊才能走索引
return qb.orderBy('e.id', 'DESC')
         .skip((query.page - 1) * query.size).take(query.size)
         .getManyAndCount();   // 数据 + 总数，分页组件要用
```

**追问预判**：

1. **什么情况应用层过滤合理？** → 数据量小且已全量在内存（字典表）、过滤逻辑 DB 表达不了（要调外部服务）、多数据源合并后再筛。主动说这句显得有边界感。
2. **筛选项多，索引怎么建？** → 抓高频组合建联合索引，低频筛选走回表过滤（`Using where`）；筛选组合不可预测（BI 报表）是 MySQL 不擅长的场景，上 ES/ClickHouse——顺势带到架构选型。
3. **`LIKE '%关键词%'` 索引失效怎么办？** → 前缀模糊（`keyword%`）能走 B+ 树；前后模糊量小靠回表忍，量大上 ES。
4. **小表 EXPLAIN 出现 type=ALL 别慌**：优化器评估「全表扫比索引+回表更便宜」时会主动放弃索引。

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

### 2.7 实战：下单接口 createOrder（三件套组装）

要求：不超卖 + 连点/重试不生成两单。答案 = **原子更新 + 唯一约束 + 事务** 三件套：

```typescript
// 前提：ALTER TABLE `order` ADD UNIQUE KEY uk_order_no (order_no);
async createOrder(userId: number, dto: CreateOrderDto) {
  try {
    return await this.dataSource.transaction(async (manager) => {
      // ① 原子扣库存：判断写进 WHERE，不够就一行不动
      const result = await manager.query(
        'UPDATE product SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [dto.quantity, dto.productId, dto.quantity],
      );
      if (result.affectedRows === 0) {
        throw new BusinessException('库存不足', 409);  // 回滚，不留半成品
      }
      // ② 插订单：order_no 唯一索引兜底，重复请求撞 1062
      return manager.save(Order, { orderNo: dto.orderNo, userId, ... });
    });
  } catch (err) {
    // ③ 幂等语义：重复请求不报错，返回已存在的那一单
    if (err.code === 'ER_DUP_ENTRY') {
      return this.orderRepo.findOneBy({ orderNo: dto.orderNo });
    }
    throw err;
  }
}
```

三个必考追问：

1. **为什么不先 SELECT stock 判断再 UPDATE？** → TOCTOU：两事务同时读到 stock=10 都以为够 → 超卖。读-判断-写必须是同一条 SQL，靠行锁串行化（A 扣完 B 才能看到新值）。
2. **为什么幂等靠唯一索引而不是代码先查一遍？** → 同样并发失效；唯一索引是 DB 级串行化，撞了报 1062，必然只有一单。
3. **事务边界画在哪？** → 只包「扣库存 + 插订单」。发短信、推消息等外部调用**绝不进事务**（长事务 = 锁持有久 = 吞吐量杀手）。

`?` 是参数占位符（mysql2 参数化查询），防 SQL 注入，禁止字符串拼接。

---

## 三、数据库连接池

### 3.1 建一次连接有多贵（为什么不能一请求一连接）

MySQL 连接建立在 TCP 上，建连 = TCP 三次握手 →（TLS 握手）→ MySQL 协议握手鉴权 → 服务端分配**专属线程**（thread per connection）+ 每连接内存缓冲（sort/join/read_buffer，共几 MB）→ 断开四次挥手回收。一次建连 ≈ 3~5 次网络往返，几到几十 ms——比一条简单 SQL（0.1ms）贵上百倍。「一请求一连接」在高并发下 CPU 全耗在握手和线程创建销毁上，线程数、内存双爆炸。

### 3.2 连接池：复用 + 削峰 + 兜底

应用启动预建 N 条长连；请求来了「借」→ 用完「还」；没空闲就**池内排队**（`acquireTimeout` 到点快速失败）。TypeORM 里就是 `poolSize`（底层 mysql2 池）。三个收益：

1. **复用**：握手成本摊销一次；
2. **削峰/背压**：池大小 = 应用对 DB 的最大并发度，1000 个并发请求只有 N 个能打到 DB，其余排队，DB 被保护住；
3. **兜底**：排队超时快速失败，比无限堆积雪崩强。

### 3.3 容量规划：连接数是个约束不等式

**关键认知：poolSize 是真实物理连接上限，不是虚拟槽位；池里每条都是占 max_connections 名额的 TCP 连接。排队只发生在每个实例自己的池内部，实例之间互不协调、纯靠抢；MySQL 端没有排队机制，名额满了新连接当场被拒（`ERROR 1040 Too many connections`），不是等。**

```
Σ（每个服务的 实例数 × poolSize） ≤ max_connections × 0.8（留 20% 给 DBA/监控/其他服务）
```

反例：4 实例 × poolSize 50 = 200 = DB 上限 200 → 高峰把名额吃满，DBA/监控/其他服务全连不进去；若 DB 只有 50 名额，先启动的实例通吃 50 条，其余实例建连全被拒、服务直接挂。poolSize 是从 DB 总预算**倒推**的，不是越大越好。

### 3.4 连接不是越多越好

MySQL thread per connection：连接多 = 线程多 = 上下文切换剧烈 + 抢同样的行锁/缓冲池。经验公式：**有效连接数 ≈ CPU 核数 × 2 + 磁盘数**（PostgreSQL 社区；HikariCP《About Pool Sizing》同款结论，其默认池大小仅 10）。8 核机器几十条活跃连接往往就是吞吐巅峰。正确姿势是「小池子 + 排队」，不是「大池子全放」；盲目调大 `max_connections` 治标伤本。

### 3.5 追问清单

1. **连接泄漏**：`getConnection()` 忘 `release()`、事务开了不提交 → 连接被一直占用，池子慢慢耗尽。症状：接口越来越慢直到全超时，但 DB 并不忙。
2. **K8s 滚动发布**：新旧 Pod 并存瞬间连接数翻倍，发布期要留余量。
3. **Serverless/短生命周期函数**：池子没法跨实例共享 → 连接池下沉到代理层（RDS Proxy / PgBouncer）。
4. **池子配 50 ≠ 时刻 50 个查询在跑**：大部分连接 99% 时间空闲，纯浪费名额。

---

## 四、经典场景对照

| 场景 | 方案 |
|---|---|
| 用户一天只能签到一次 | `@Unique(['userId','date'])` + `orIgnore` |
| 订单号不可重复 | 唯一索引 + `orIgnore` 幂等写入 |
| 支付回调不重复扣款 | 支付单号唯一键 + 去重表 + 事务 |
| 前端重复点击提交 | 幂等 Token（Redis GETDEL） |
| 同一人同一时段重复预约 | `@Unique(['userId','timeSlot'])` 兜底 |
| 并发改同一条记录 | `@VersionColumn` 乐观锁 |
| MQ 重复消费 | 去重表（消息 ID 唯一键） |
| 下单不超卖 + 不重复 | 原子更新 `WHERE stock >= ?` + order_no 唯一索引 + 事务（见 2.7） |
| 列表多条件筛选 + 分页 | DB 谓词下推 + QueryBuilder 动态 andWhere + getManyAndCount（见 1.6） |
| 订单列表接口 41 条 SQL | N+1，JOIN 预加载或 IN 批量查（见 1.4） |
| 翻到第 5000 页巨慢 | 深分页：游标 > 延迟关联 > 产品限深（见 1.5） |
| Too many connections | 容量不等式倒推 poolSize，小池子+排队（见 3.3/3.4） |

---

## 五、面试话术（直接背）

> **读性能**：索引解决慢查询（联合索引 + 覆盖索引），Redis 缓存扛热点（防穿透/击穿/雪崩），读写分离扛流量（注意主从延迟），并避免 N+1（显式 join 预加载）。
>
> **写幂等**：数据库唯一约束兜底（`@Unique` + `onConflict/orIgnore`），接口层用幂等键（Redis `SETNX`/`GETDEL`），MQ 用去重表。核心是「**并发下靠 DB 约束保证，不是靠先查再插**」，Redis 只是第一道防线。
>
> **连接池**：建连 = TCP 握手 + 鉴权 + 每连接一线程几 MB 内存，比 SQL 本身贵百倍，必须池化复用。poolSize 按「Σ实例数×poolSize ≤ max_connections×0.8」倒推；连接不是越多越好（≈核数×2+磁盘数），小池子排队 + acquireTimeout 快速失败才是正解。

---

## 六、来源

- TypeORM 官方文档《Performance Optimization》：N+1 问题与 `leftJoinAndSelect` / `innerJoinAndSelect`
- nestarc.dev《Why Your NestJS Idempotency Implementation Is Probably Broken》：Redis SET NX 的局限、IETF Idempotency-Key 草案、DB 唯一约束兜底
- advanced-java《分布式系统幂等性》：不能重复扣款/重复插入/统计值多加 1
- 腾讯云开发者社区《如何避免订单重复提交》：幂等 Token 生成、校验、高并发原子性
- CSDN《后端开发面试高频场景题》：接口幂等性保障方案（网络重试、前端重复提交、消息重发）
- 阿里后端面经：支付回调「不重复支付」、消费场景幂等
- HikariCP《About Pool Sizing》：connections ≈ ((core_count × 2) + effective_spindle_count)
