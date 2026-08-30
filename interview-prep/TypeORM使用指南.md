# TypeORM 使用指南

> 以 `server/`（NestJS 11 + TypeORM + MySQL）为实战样例，讲清 TypeORM 的核心用法。
> 深入优化话题（读写优化、幂等）见 [TypeORM读写优化与幂等方案](./TypeORM读写优化与幂等方案.md)。

---

## 0. 现状速览（2026）

- TypeORM 历经近十年于 2026 年 6 月发布 **1.0**，维护重启，核心是全面替换旧 `Connection` 为 `DataSource` API，要求 Node.js 20+。NestJS 用户升级到 `@nestjs/typeorm` v11.0.1+ 即可平滑过渡（[InfoQ](https://www.infoq.cn/article/UjpPCzo8RPwNIt0pSsVp)、[CSDN](https://blog.csdn.net/ChailangCompany/article/details/161867223)）。
- NestJS 官方文档仍推荐 TypeORM 作为最成熟的 Node ORM（[NestJS 中文文档](https://docs.nestjs.cn/recipes/sql-typeorm/)），但社区里 Prisma 也是很常见的替代选型，面试被问"为什么用 TypeORM 不用 Prisma"要能答。

---

## 1. 核心概念一张图

```
DataSource（连接池 + 全局配置）
  └── EntityManager（通用操作入口）
        └── Repository<T>（按实体分发的 CRUD API）
              └── Entity（@Entity 装饰的类，映射一张表）

QueryBuilder —— 复杂 SQL 的链式构造器
QueryRunner  —— 单连接控制，用于事务和 migration
```

---

## 2. NestJS 集成的三层注册机制

这是本项目最容易搞混的部分，三层缺一不可：

### 2.1 `forRootAsync`：注册全局连接

`server/src/database/database.module.ts`：

```ts
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql',
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? 3306),
        // ...
        entities: [User, Conversation, Message],
        migrations: [InitSchema1780000000000, /* ... */],
        synchronize: false, // 表结构必须由 migration 管理，禁止自动同步
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
```

要点：

- 用 `forRootAsync` 而不是 `forRoot`：模块装饰器求值早于 `main.ts` 里的 `.env` 加载，异步工厂保证能读到环境变量。
- `@Global()` + `exports`：根模块 import 一次，连接全局可用，其他模块不用再 import `DatabaseModule`。
- `synchronize: false`：生产铁律。`true` 会按 entity 自动改表，字段删除=丢数据。

### 2.2 `forFeature`：按模块注册 Repository

`@Global()` 只保证**连接**全局，具体实体的 Repository 要各业务模块自己领：

```ts
// conversation/conversation.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User, Conversation, Message])],
  // ...
})
```

### 2.3 `@InjectRepository`：在 Service 注入

```ts
// conversation/conversation.service.ts
constructor(
  @InjectRepository(User) private readonly userRepo: Repository<User>,
  @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
) {}
```

忘记 `forFeature` 会报 `Nest can't resolve dependencies of the XxxService`。

---

## 3. Entity 定义（装饰器速查）

以 `server/src/database/entities/message.entity.ts` 为例：

```ts
@Entity('messages')                                    // 表名
@Index('idx_messages_conversation_id', ['conversationId', 'id']) // 联合索引
export class Message {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;   // 注意：MySQL bigint 返回的是 string 不是 number

  @Column({ name: 'conversation_id', type: 'bigint', unsigned: true })
  conversationId!: string;                             // 列名 snake_case，属性 camelCase

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;                         // 关系字段，JoinColumn 只写在一侧

  @Column({ type: 'varchar', length: 16, default: 'completed' })
  status!: MessageStatus;

  @Column({ name: 'token_usage', type: 'json', nullable: true })
  tokenUsage!: MessageUsage | null;                    // json 列自动序列化/反序列化

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;                                    // 自动填创建时间

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;                                    // 自动更新时间
}
```

常用装饰器速查：

| 装饰器 | 用途 |
|---|---|
| `@Entity('name')` | 声明表映射 |
| `@PrimaryGeneratedColumn` | 自增/UUID 主键（`'uuid'` 生成 UUID） |
| `@Column({...})` | 普通列：`type / length / nullable / default / name` |
| `@CreateDateColumn` / `@UpdateDateColumn` | 自动时间戳 |
| `@Index('name', ['a','b'])` | 索引，可挂类上（联合索引）或属性上 |
| `@ManyToOne` + `@JoinColumn` | 外键持有方 |
| `@OneToMany` / `@OneToOne` / `@ManyToMany` | 反向关系；多对多配 `@JoinTable` |

踩坑提醒：

- **MySQL `bigint` 查出来是 string**（JS number 精度不够），entity 属性类型要声明 `string`。
- **列名避开保留字**：本项目 token 用量列就叫 `token_usage` 而不是 `usage`。
- 关系字段和标量外键列（如 `conversationId`）可以共存，标量用于查询条件，关系字段用于 `relations` 联查。

---

## 4. Repository 常用 API

项目里的真实用法（`conversation.service.ts`）：

```ts
// 单条查询
await this.userRepo.findOne({ where: { name } });

// 分页 + 计数（返回 [rows, total]）
const [items, total] = await this.conversationRepo.findAndCount({
  where: { userId },
  order: { updatedAt: 'DESC' },
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// 创建 + 保存（create 只是实例化，save 才落库）
await this.userRepo.save(this.userRepo.create({ name }));
```

完整清单：

| 方法 | 说明 |
|---|---|
| `find({ where, order, skip, take, relations, select })` | 列表查询 |
| `findOne({ where })` | 单条，找不到返回 `null`；`findOneByOrFail` 抛异常 |
| `findAndCount` | 分页标配，一次拿数据 + 总数 |
| `save(entity)` | insert 或 update（有主键则 update），**会触发整个实体覆盖** |
| `update(id, partial)` | 直接 UPDATE，不查回，性能更好 |
| `delete(id)` / `softDelete(id)` | 物理删 / 软删（需 `@DeleteDateColumn`） |
| `create(partial)` | 只实例化不落库 |
| `count({ where })` / `exist` | 计数 / 判存 |
| `query(sql, params)` | 原生 SQL |

`where` 高级写法（`typeorm` 的 FindOperators）：

```ts
import { Like, In, Between, MoreThan, IsNull } from 'typeorm';

await repo.find({
  where: [
    { title: Like('%关键词%') },          // 数组 = OR
    { status: In(['a', 'b']) },
  ],
  // 同对象多字段 = AND
  // createdAt: Between(start, end), MoreThan(x), IsNull() ...
});
```

联查关系：

```ts
await repo.find({ relations: { conversation: true } });
// 或 QueryBuilder 里 leftJoinAndSelect
```

---

## 5. QueryBuilder：复杂查询

Repository 的 find 选项表达不了的（JOIN 聚合、子查询、GROUP BY），用 QueryBuilder：

```ts
const rows = await this.messageRepo
  .createQueryBuilder('m')
  .select('m.provider', 'provider')
  .addSelect('COUNT(*)', 'cnt')
  .addSelect('SUM(JSON_EXTRACT(m.token_usage, "$.total_tokens"))', 'tokens')
  .where('m.conversation_id = :cid', { cid })
  .groupBy('m.provider')
  .getRawMany();   // 聚合结果用 getRawMany，实体查询用 getMany
```

要点：

- `getMany()` 返回 entity 实例；`getRawMany()` 返回原始行（聚合必须用它）。
- 参数永远用 `:name` 占位符绑定，**禁止字符串拼接**（SQL 注入）。

---

## 6. 事务

标准写法是 `dataSource.transaction` 包裹，回调里用事务内的 manager：

```ts
import { DataSource } from 'typeorm';

constructor(private readonly dataSource: DataSource) {}

await this.dataSource.transaction(async (manager) => {
  const conv = await manager.save(Conversation, { userId, title });
  await manager.save(Message, { conversationId: conv.id, role: 'user', content });
  // 任一失败整体回滚；成功自动提交
});
```

需要精细控制（手动 commit/rollback/release）时用 `queryRunner`：

```ts
const runner = this.dataSource.createQueryRunner();
await runner.connect();
await runner.startTransaction();
try {
  await runner.manager.save(/* ... */);
  await runner.commitTransaction();
} catch (e) {
  await runner.rollbackTransaction();
  throw e;
} finally {
  await runner.release();
}
```

---

## 7. Migration 工作流（表结构变更的唯一入口）

本项目约定：**禁止 `synchronize`，表结构一律走 migration**。

### 7.1 两套 DataSource 配置

- `database.module.ts` — 应用运行时（Nest DI 容器内）
- `database/data-source.ts` — TypeORM CLI 入口（`migration:run/revert`），独立 `new DataSource({...})`，顶部 `process.loadEnvFile()` 读 `.env`

⚠️ **两处都要手动维护 `migrations` 数组，新增 migration 时必须同步更新两处**——本项目就踩过坑：CLI 配置加了新 migration 但 `database.module.ts` 忘了加，导致两边版本不一致。新增迁移文件后把这两个数组当"一处变更、两处同步"处理。

### 7.2 一个 migration 长什么样

`migrations/1780000000200-add-message-status-and-meta.ts`：

```ts
export class AddMessageStatusAndMeta1780000000200 implements MigrationInterface {
  name = 'AddMessageStatusAndMeta1780000000200'; // 时间戳前缀保证执行顺序

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages
        ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'completed' AFTER reasoning,
        ADD COLUMN token_usage JSON NULL AFTER status
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // down 必须是 up 的逆操作，保证可回滚
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN status, DROP COLUMN token_usage`);
  }
}
```

### 7.3 常用命令

```bash
pnpm migration:run      # 执行未跑的迁移（先 build，跑 dist 下的 data-source.js）
pnpm migration:revert   # 回滚最近一次
```

TypeORM 会在数据库里建一张 `migrations` 表记录已执行的迁移，按 `name`（时间戳）排序执行，跑过的不会再跑。

---

## 8. 常见坑清单

1. **bigint 主键是 string** —— 比较、拼接 URL 时注意类型。
2. **`save` 是"整行覆盖"语义** —— 只改一个字段建议用 `update`，否则并发下容易互相覆盖。
3. **N+1 问题** —— 循环里查关联就是 N+1，用 `relations` 或 `leftJoinAndSelect` 一次 JOIN 出来（详见读写优化文档）。
4. **运行时 module 与 CLI data-source 配置漂移** —— migrations/entities 两处列表要保持同步（本项目实测踩坑）。
5. **`synchronize: true` 只配存在于本地 toy project**，生产数据库结构变更一律 migration。
6. **JSON 列查询要用 `JSON_EXTRACT`**，TypeORM 的 find 选项不支持直接按 JSON 内部字段过滤，需要 QueryBuilder 或原生 SQL。

---

## 9. 面试速记 Q&A

**Q：TypeORM 的 DataSource、EntityManager、Repository 什么关系？**
DataSource 管理连接池和全局配置；EntityManager 是通用操作入口；Repository 是按实体维度的 EntityManager 封装，业务代码主要用 Repository。事务里用 `manager` 而不是全局 repository，保证操作落在同一连接上。

**Q：为什么生产必须关 synchronize？**
它按 entity 当前定义直接 ALTER 表，改字段类型/删字段会造成不可逆的数据丢失，且多实例部署时启动竞争改表。表结构变更必须走版本化的 migration，可审查、可回滚。

**Q：TypeORM vs Prisma 怎么选？**
TypeORM：装饰器 + class 风格，与 NestJS DI 天然贴合，QueryBuilder 灵活贴近 SQL；Prisma：schema-first，类型安全和 DX 更好，但自定义复杂 SQL 和 NestJS 集成不如 TypeORM 直接。NestJS 官方默认推荐仍是 TypeORM。
