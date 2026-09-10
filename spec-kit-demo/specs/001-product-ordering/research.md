# Research: 商品下单 — 技术决策记录

所有技术约束由用户在 plan 输入中明确给定，无 NEEDS CLARIFICATION。
本文件将各项决策固化为「决策 + 理由 + 备选」格式，供实现与面试复述使用。

## D1: Web 框架 = Fastify

- **Decision**: Fastify 5。
- **Rationale**: 轻量、低开销、内置 schema 校验生态；`inject()` 支持不起端口做
  接口测试，契合「supertest 风格但不引额外库」的约束。
- **Alternatives considered**: NestJS（重框架，练习项目过度设计，宪法 II 否决）；
  Express（可，但 inject 需引 supertest，不如 Fastify 自带）。

## D2: 存储 = SQLite（better-sqlite3）

- **Decision**: better-sqlite3，文件库 `./data/app.db`，测试用 `:memory:`。
- **Rationale**: 同步 API 让事务代码线性可读；单连接串行执行使「并发防超卖」
  在单进程内天然可演示；零外部服务依赖，符合宪法 II。
- **Alternatives considered**: 内存 Map（无法演示 SQL 级原子扣减与唯一约束，
  失去练习价值）；Postgres/MySQL（练习项目引入过重）。

## D3: 防超卖 = 条件更新（影响行数判 0）

- **Decision**: `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`，
  检查 `changes === 0` 判定库存不足；schema 加 `CHECK (stock >= 0)` 双保险。
- **Rationale**: 与用户在 MySQL 场景题练过的「原子更新 WHERE stock > 0」同一方案，
  单条 SQL 原子完成「校验 + 扣减」，不存在 check-then-act 竞态窗口。
- **Alternatives considered**: 先 SELECT 再 UPDATE（有竞态窗口，直接否决）；
  应用层互斥锁（单进程可行但掩盖了数据库层方案，练习价值低）。

## D4: 幂等 = 请求标识 + 唯一约束兜底

- **Decision**: 调用方经 `Idempotency-Key` 请求头传标识；先按 request_id 查订单，
  命中即重放首单结果；插入时依赖 orders.request_id 唯一索引兜底
  （并发下同标识只有一个事务能插入成功）。
- **Rationale**: 「先查」覆盖常见重放路径，「唯一约束」覆盖并发同标识的兜底路径，
  两道防线互补；Stripe 式 Idempotency-Key 头是业界惯例。
- **Alternatives considered**: 仅靠先查（并发下同标识可双双穿透，否决）；
  服务端自动生成标识（使幂等失效，spec FR-010 已否决）。

## D5: 原子性 = better-sqlite3 事务

- **Decision**: 「条件更新扣库存 + 插入订单」包在一个事务中；
  插订单失败（如唯一约束冲突）整体回滚，库存不丢。
- **Rationale**: 两步写必须同生共死，否则会出现「扣了库存没订单」的中间态。
- **Alternatives considered**: 顺序执行不设事务（存在中间态，否决）。

## D6: 测试 = Vitest + Fastify inject

- **Decision**: Vitest 跑全部测试；接口测试用 `app.inject()`，无需起监听端口。
- **Rationale**: Vitest 原生跑 TS、watch 体验好；inject 满足 supertest 风格诉求
  且零额外依赖。
- **Alternatives considered**: node:test（可，但断言/快照生态弱于 Vitest）；
  supertest + 起端口（违反「不引额外库」约束）。

## D7: 重放响应语义

- **Decision**: 首次成功下单返回 201；同标识重放返回 200 + 与首次完全相同的响应体；
  同标识但请求体不同（商品/数量不一致）返回 409 `REQUEST_ID_MISMATCH`。
- **Rationale**: 201/200 之分让客户端可感知「这是重放」，便于测试断言；
  体不同则标识语义被破坏，必须拒绝以防串单。
- **Alternatives considered**: 重放也返回 201（客户端无法区分首单与重放，否决）。
