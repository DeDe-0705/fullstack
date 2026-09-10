# Tasks: 商品下单（Product Ordering）

**Input**: Design documents from `/specs/001-product-ordering/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/api.md、quickstart.md

**Tests**: 本项目宪法 I 规定「测试先行（NON-NEGOTIABLE）」——每个用户故事
**必须先写测试并确认失败（Red），再实现（Green）**。测试任务均为强制任务。

**Organization**: 按用户故事分阶段，每个故事可独立实现、独立验证、独立交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 对应 spec.md 的用户故事（US1-US4）
- 每个任务含确切文件路径

## Path Conventions

单一项目：`src/`、`tests/` 位于仓库根目录（见 plan.md Project Structure）。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目初始化与基础结构

- [x] T001 初始化 pnpm 项目：创建 package.json（依赖 fastify、better-sqlite3；开发依赖 typescript、vitest、tsx、@types/node、@types/better-sqlite3；脚本 `dev`=tsx watch、`test`=vitest run、`typecheck`=tsc --noEmit）与 tsconfig.json（strict: true，NodeNext 模块解析）
- [x] T002 [P] 创建目录结构 src/db/、src/services/、src/routes/、tests/unit/、tests/api/，并将 data/ 加入 .gitignore

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有用户故事开始前的共享基础设施

**⚠️ CRITICAL**: 本阶段未完成前，任何用户故事不得开工

- [x] T003 实现 src/db/database.ts：连接工厂（生产用 ./data/app.db，测试注入 :memory:）与 schema 初始化（products、orders 两表，含 orders.request_id UNIQUE 索引、stock CHECK >= 0、quantity CHECK > 0，结构见 data-model.md）
- [x] T004 [P] 实现 src/errors.ts：业务错误类型（ProductNotFound、InsufficientStock、MissingRequestId、InvalidQuantity、OrderNotFound、RequestIdMismatch）与统一错误响应格式 `{ error: { code, message } }`（契约见 contracts/api.md）
- [x] T005 实现 src/db/seed.ts：写入三件种子商品（p-1 机械键盘×10、p-2 降噪耳机×5、p-3 限量手办×1，供并发/库存不足场景使用），依赖 T003
- [x] T006 实现 src/app.ts（buildApp()：创建 Fastify 实例、注册统一错误处理器与路由，供 inject 测试与入口复用）与 src/server.ts（listen 入口，启动时建库+种子）

**Checkpoint**: 基础设施就绪，`pnpm dev` 可启动空壳服务——用户故事可以开始

---

## Phase 3: User Story 1 - 提交订单购买商品 (Priority: P1) 🎯 MVP

**Goal**: 用户提交订单购买商品，原子扣减库存并返回订单详情（含剩余库存快照）

**Independent Test**: 种子商品 p-1 库存 10，POST 买 3 件 → 201 且响应
remainingStock=7；GET /api/products/p-1 库存为 7（产品查询未实现时可用
tests/unit 直接查库验证）

### Tests for User Story 1 ⚠️（先写，确认失败后再实现）

- [x] T007 [P] [US1] 编写 tests/unit/orderService.test.ts：下单成功扣库存并写入订单（含 remaining_stock 快照值）；库存不足时抛出 InsufficientStock 且库存保持不变（事务回滚验证）
- [x] T008 [P] [US1] 编写 tests/api/orders.test.ts（app.inject）：POST /api/orders 成功返回 201 且响应体符合契约（orderId/productId/quantity/remainingStock/createdAt）；库存恰好买空返回 remainingStock=0；库存不足返回 409 + error.code=INSUFFICIENT_STOCK + message「库存不足」；quantity 为 0/负数/小数返回 400 INVALID_QUANTITY；商品不存在返回 404 PRODUCT_NOT_FOUND；GET /api/orders/:id 返回 200 订单详情、不存在返回 404 ORDER_NOT_FOUND

### Implementation for User Story 1

- [x] T009 [US1] 实现 src/services/orderService.ts：placeOrder() 在单事务内执行「条件更新 UPDATE ... WHERE stock >= ?（changes=0 → InsufficientStock）+ 插入订单（remaining_stock 取扣减后快照）」，关键 SQL 旁注释说明为什么条件更新能杜绝竞态窗口
- [x] T010 [US1] 实现 src/routes/orders.ts：POST /api/orders（productId/quantity 校验，201 响应契约）与 GET /api/orders/:id（200/404），错误经 src/errors.ts 映射为统一格式，注册进 buildApp()

**Checkpoint**: US1 独立完成——下单主链路（含库存不足边界）可用，
`pnpm test` 中 T007/T008 全绿即达 MVP

---

## Phase 4: User Story 2 - 浏览商品列表与库存 (Priority: P2)

**Goal**: 用户查看商品列表与单个商品的当前库存

**Independent Test**: 请求 GET /api/products 返回 3 件种子商品及库存；
GET /api/products/p-1 返回该商品当前库存；下单后再查库存为扣减后新值

### Tests for User Story 2 ⚠️（先写，确认失败后再实现）

- [x] T011 [P] [US2] 编写 tests/api/products.test.ts（app.inject）：GET /api/products 返回 products 数组（含 id/name/stock）；GET /api/products/:id 返回单商品契约；不存在商品返回 404 PRODUCT_NOT_FOUND

### Implementation for User Story 2

- [x] T012 [US2] 实现 src/services/productService.ts：listProducts() 与 getProductById()（不存在抛 ProductNotFound）
- [x] T013 [US2] 实现 src/routes/products.ts：GET /api/products 与 GET /api/products/:id，注册进 buildApp()

**Checkpoint**: US1 + US2 均独立可用——浏览与下单闭环打通

---

## Phase 5: User Story 3 - 重复提交不产生重复扣减 (Priority: P2)

**Goal**: 同一请求标识的重复提交返回首次结果，不重复扣库存、不建重复订单

**Independent Test**: 同一 Idempotency-Key 对 p-1 买 2 件提交 3 次 → 首次 201、
重放 200 且响应体完全一致；只存在一个订单；库存仅扣一次（10 → 8）

### Tests for User Story 3 ⚠️（先写，确认失败后再实现）

- [x] T014 [P] [US3] 编写 tests/api/orders-idempotency.test.ts（app.inject）：未携带 Idempotency-Key 返回 400 MISSING_REQUEST_ID；同标识同请求体重放返回 200 + 与首次完全相同的响应体且库存不变；同标识不同请求体返回 409 REQUEST_ID_MISMATCH；首次库存不足失败后同标识重放返回相同的 409 INSUFFICIENT_STOCK

### Implementation for User Story 3

- [x] T015 [US3] 扩展 src/services/orderService.ts 与 src/routes/orders.ts：路由层校验 Idempotency-Key 缺失即 400；placeOrder() 开头按 request_id 查库，命中则比对请求体（一致 → 重放首单结果；不一致 → RequestIdMismatch）；插入时捕获 request_id 唯一约束冲突作为并发兜底（重放已有结果），注释说明「先查 + 唯一约束」两道防线各自覆盖的路径

**Checkpoint**: US3 独立完成——幂等双防线（先查 + 唯一约束）生效

---

## Phase 6: User Story 4 - 并发抢购不超卖 (Priority: P3)

**Goal**: 多请求同时竞争同一商品库存，只有库存能支撑的请求成功，库存不为负

**Independent Test**: p-3 库存 1，Promise.all 并发 100 个购买 1 件的请求 →
恰好 1 个 201、99 个 409 INSUFFICIENT_STOCK，最终 stock=0

### Tests for User Story 4 ⚠️（先写，确认失败后再实现）

- [x] T016 [US4] 编写 tests/api/orders-concurrency.test.ts（app.inject）：对库存为 1 的商品并发发起 100 个下单请求（各自独立 Idempotency-Key），断言恰好 1 个 201、99 个 409、最终库存为 0；对库存为 5 的商品并发 10 个请求，断言恰好 5 成功且库存为 0 不为负

### Implementation for User Story 4

- [x] T017 [US4] 复核并加固 src/services/orderService.ts 的原子扣减路径：确认扣减为事务内单条条件 UPDATE（无先 SELECT 后 UPDATE 的 check-then-act 窗口），不满足则重构；并发场景下唯一约束冲突的回滚行为补注释说明

**Checkpoint**: 全部用户故事独立可用——防超卖经 100 并发实测验证

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨故事的收尾与宪法 DoD 核验

- [x] T018 [P] 按 quickstart.md 场景 1-6 逐一手动验证（浏览、下单、库存不足、幂等重放、缺标识、订单详情）
- [x] T019 宪法 DoD 收尾：pnpm test 与 pnpm typecheck 双双全绿；对照宪法 IV 审查命名表意与「为什么」注释覆盖（条件更新、唯一约束、事务三处关键点）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1 完成——**阻塞所有用户故事**
- **User Stories (Phase 3-6)**: 均依赖 Phase 2 完成；US3/US4 依附于 US1 的下单实现
- **Polish (Phase 7)**: 依赖全部目标故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后即可开始，不依赖其他故事
- **US2 (P2)**: Phase 2 后即可开始，与 US1 无代码依赖（可并行）
- **US3 (P2)**: 依赖 US1 的 placeOrder 存在（在其上扩展幂等）
- **US4 (P3)**: 依赖 US1 的下单路径（复核加固），建议 US3 之后执行
  （并发用例需各自独立 Idempotency-Key）

### Within Each User Story

- 测试 MUST 先写并确认失败（Red），再实现（Green）——宪法 I 硬性要求
- services 先于 routes；单故事全绿再进入下一优先级

### Parallel Opportunities

- T002 与 T001 可并行；T004 与 T003 可并行
- Phase 2 完成后：US2（T011-T013）可与 US1 并行（不同文件）
- 各故事内的测试任务（T007+T008、T014、T016）标记 [P] 可并行编写

---

## Parallel Example: User Story 1

```bash
# 先并行编写两个测试文件（同一轮 Red）：
Task: "编写 tests/unit/orderService.test.ts（扣减/回滚/快照）"
Task: "编写 tests/api/orders.test.ts（201/409/400/404 契约）"

# 测试失败确认后，依次实现 service → route（同文件链路，不并行）：
Task: "实现 src/services/orderService.ts placeOrder()"
Task: "实现 src/routes/orders.ts 并注册"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（阻塞性，必须完成）
3. 完成 Phase 3: US1（T007-T010）
4. **STOP and VALIDATE**: T007/T008 测试全绿 + quickstart 场景 2/3/6 通过
5. 即达可演示 MVP

### Incremental Delivery

1. Setup + Foundational → 基座就绪
2. +US1 → 独立验证 → MVP（下单核心）
3. +US2 → 独立验证 → 浏览/下单闭环
4. +US3 → 独立验证 → 幂等双防线
5. +US4 → 独立验证 → 并发防超卖实测
6. Phase 7 → DoD 双绿收尾

### Parallel Team Strategy

1. 共同完成 Setup + Foundational
2. 此后：A 做 US1（关键路径），B 并行做 US2；US1 完成后再串行 US3 → US4

---

## Notes

- [P] 任务 = 不同文件、无未完成依赖
- [USx] 标签保证任务到用户故事的可追溯性
- 每个故事的测试必须先红后绿（宪法 I），收尾必须 pnpm test + pnpm typecheck 双绿（宪法 V）
- 完成每个任务或逻辑组后及时提交（分支 codex/ 前缀，中文提交信息）
- 避免：模糊任务、同文件并行冲突、破坏故事独立性的跨故事依赖
