# Implementation Plan: 商品下单（Product Ordering）

**Branch**: `001-product-ordering` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-product-ordering/spec.md`

## Summary

实现简化的商品下单 API：浏览商品/库存、下单扣库存、库存不足拒绝、
幂等防重、并发防超卖、订单详情可查。
技术路线：Fastify 提供 HTTP 层，better-sqlite3 同步 API 承载数据，
用 `UPDATE ... WHERE stock >= ?` 条件更新防超卖（影响行数 0 = 库存不足），
用 orders 表 `request_id` 唯一约束兜底幂等，用事务保证「扣库存 + 建订单」原子性。
全程 TDD：每个行为先写失败测试再实现。

## Technical Context

**Language/Version**: TypeScript 5.x（strict 模式）/ Node.js 20+

**Primary Dependencies**: Fastify 5（HTTP）、better-sqlite3（存储）；
开发依赖：Vitest、tsx、typescript、@types/node、@types/better-sqlite3

**Storage**: SQLite（better-sqlite3，同步单连接 + 事务），文件库 `./data/app.db`，
测试用内存库 `:memory:`

**Testing**: Vitest（单元测试 services 层）+ Fastify `inject()` 接口测试
（supertest 风格，不引额外 HTTP 测试库）

**Target Platform**: 本地开发机（macOS/Linux），练习项目无部署目标

**Project Type**: web-service（纯后端 REST API）

**Performance Goals**: 练习规模——单进程内 100 并发下单请求正确串行化即可
（better-sqlite3 同步执行天然串行，无需额外锁）

**Constraints**: 库存任何路径不为负；写操作幂等；`pnpm test` 与
`pnpm typecheck`（tsc --noEmit）全绿才算完成（宪法 DoD）

**Scale/Scope**: 2 张表、5 个接口、3 层目录（routes/services/db），无用户体系

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 宪法条款 | 门检结论 | 依据 |
|---|---|---|
| I. 测试先行（NON-NEGOTIABLE） | ✅ PASS | 实现顺序强制「先红后绿」：每个行为先写失败测试（见 Project Structure 的实现顺序） |
| II. 简单优先 | ✅ PASS | 仅 Fastify + better-sqlite3 + Vitest 三个核心依赖；不引 NestJS/ORM/额外测试库；src/ 三层平铺 |
| III. 库存非负 + 写幂等 | ✅ PASS | 条件更新防超卖 + CHECK(stock >= 0) 兜底；request_id 唯一索引兜底幂等；事务保证原子性 |
| IV. 代码即文档 | ✅ PASS | 服务方法按业务命名（`placeOrder`/`assertSufficientStock`）；并发与幂等的关键 SQL 旁注释"为什么" |
| V. DoD = 测试 + 类型检查 | ✅ PASS | package.json 固定 `test` / `typecheck` 脚本，任务收尾必须双绿 |

**初次门检结论**：无违规，无需 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/001-product-ordering/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出：技术决策与理由
├── data-model.md        # Phase 1 输出：products/orders 表结构与校验规则
├── quickstart.md        # Phase 1 输出：端到端验证指南
├── contracts/           # Phase 1 输出：API 契约
│   └── api.md
├── checklists/
│   └── requirements.md  # 规格质量清单（specify 阶段产物）
└── tasks.md             # Phase 2 输出（$speckit-tasks，非本命令产物）
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── database.ts      # 连接工厂（文件库/内存库）、schema 初始化
│   └── seed.ts          # 预置商品种子数据
├── services/
│   ├── productService.ts # 商品列表/详情查询
│   └── orderService.ts   # 下单（条件更新 + 事务 + 幂等）、订单查询
├── routes/
│   ├── products.ts       # GET /api/products、GET /api/products/:id
│   └── orders.ts         # POST /api/orders、GET /api/orders/:id
├── errors.ts             # 业务错误类型与统一错误响应格式
├── app.ts                # buildApp()：组装路由，供测试 inject 与入口复用
└── server.ts             # 入口：listen 启动

tests/
├── unit/
│   └── orderService.test.ts  # 库存扣减/幂等/事务回滚的单元测试
└── api/
    ├── products.test.ts      # 商品接口测试（inject）
    └── orders.test.ts        # 下单接口测试：成功/库存不足/幂等重放/并发/缺标识
```

**Structure Decision**: 单一项目、src/ 下 routes → services → db 三层单向依赖
（routes 只做参数校验与 HTTP 语义，业务规则全在 services）。
`app.ts` 与 `server.ts` 分离，使测试无需起端口即可 inject。

**实现顺序建议**（TDD 节奏，每步先写失败测试）：

1. `db/database.ts` + `seed.ts`：schema（含唯一索引与 CHECK 约束）与种子数据
2. `productService` + 商品两个接口（US2，最小的端到端闭环，先打通分层）
3. `orderService.placeOrder` 主路径 + POST /api/orders（US1）
4. 库存不足拒绝（US1 边界，FR-005）
5. 幂等：缺标识拒绝（FR-010）→ 重放返回首单（FR-007）→ 唯一索引兜底
6. 并发防超卖测试（US4，Promise.all 并发 inject）
7. GET /api/orders/:id 订单详情（US1 收尾）

## Complexity Tracking

> 无宪法违规，本表留空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
