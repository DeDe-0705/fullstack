# Spec Kit 实战复盘：商品下单 Demo 全流程

> 配套理论文档：[AI开发流程-SDD+BDD+TDD](./AI开发流程-SDD-BDD-TDD.md)。
> 本文是 2026-09-08 在 `spec-kit-demo/` 完整走通 Spec Kit 全流程的实战记录，
> 面试时用于回答「你真的用过 Spec Kit 吗？讲讲具体怎么做的」。

---

## 一、一句话实战总结

> 我用 Spec Kit 完整交付了一个「商品下单 API」：从 constitution 定原则、specify 写规格、clarify 消歧义、plan 定方案、tasks 拆任务、analyze 一致性检查，到 implement 按 TDD 实现。全程我只写了两段自然语言需求和三条澄清意见，**我的工作是审契约，AI 的工作是写代码**。最终 24 个测试全绿，含 100 并发防超卖实测。

## 二、Demo 背景

- **题目**：简化商品下单 API（看商品/库存、下单扣库存、库存不足拒绝、幂等防重、并发防超卖、订单详情）
- **选这个题的原因**：和我 db-training 练过的 MySQL 并发场景（超卖、幂等、唯一约束）完全同源，能把「数据库功底」迁移成「AI 工程化叙事」
- **技术栈**：Node.js + TS(strict) + Fastify + better-sqlite3 + Vitest（约束由我在 plan 阶段输入，不是 AI 自选）

## 三、七步流程与每步我做了什么

```text
constitution → specify → clarify → plan → tasks → analyze → implement
   定原则      写规格     消歧义    定方案    拆任务   一致性检查   TDD实现
```

| 步骤 | 产物 | 我（人）做的事 | 观察到的关键点 |
|---|---|---|---|
| 1. constitution | `.specify/memory/constitution.md` | 定 5 条原则：测试先行、简单优先、库存非负+写幂等、代码即文档、DoD=测试+类型检查 | 宪法成为后续所有命令的「最高法律」，plan 阶段自动做了 Constitution Check 门检 |
| 2. specify | `specs/001-product-ordering/spec.md` | 只写 what/why，不提技术方案 | AI 自动拆出 4 条 User Story（P1 下单→P2 浏览/幂等→P3 并发），每条带 Independent Test 和可测量 Success Criteria |
| 3. clarify | spec.md 修订 | 回答歧义、拍板决策 | 审 spec 发现「没带请求标识怎么办」没写——我拍板「直接拒绝 400」（服务端无法区分新请求与重试，自动生成标识=放弃幂等，Stripe Idempotency-Key 同款逻辑） |
| 4. plan | plan.md / research.md / data-model.md / contracts/api.md | 输入技术栈约束；审数据模型 | 关键正确性决策全落数据库层：`request_id` UNIQUE 兜底幂等、`UPDATE...WHERE stock>=?` 条件更新防超卖、事务保证原子性、CHECK 约束双保险 |
| 5. tasks | tasks.md（19 个任务） | 检查 TDD 节奏、并发测试是否独立、任务粒度 | 每个故事「测试任务⚠️先写确认 Red → 实现任务」；T016 就是 SC-004 的直译（100 并发抢库存 1） |
| 6. analyze | 只读一致性报告 | 看报告有没有 CRITICAL/HIGH | 跨文档扫描 spec/plan/tasks 的矛盾，干净才放行 |
| 7. implement | src/ + tests/ | 不读每一行代码，跑 DoD 验证 | AI 按任务顺序 Red-Green-Refactor 实现 |

## 四、最终交付（实证）

```text
src/db/database.ts + seed.ts       # schema（UNIQUE/CHECK 约束）+ 种子数据
src/services/orderService.ts       # 单事务：条件更新 + 插订单，先查+唯一约束双防线幂等
src/routes/orders.ts products.ts   # 5 个接口，统一错误格式
tests/ 5 个文件 24 个用例           # 单测 + inject 接口测试
```

```text
✓ tests/unit/orderService.test.ts        (4)
✓ tests/api/products.test.ts             (4)
✓ tests/api/orders.test.ts               (10)
✓ tests/api/orders-idempotency.test.ts   (4)
✓ tests/api/orders-concurrency.test.ts   (2)  ← 100 并发抢 1 件：恰好 1 成功、99 个 409、库存为 0
Test Files 5 passed | Tests 24 passed
```

## 五、实战中抓住的 4 个「人审时刻」（面试核心素材）

1. **审 spec 抓歧义**：AI 生成的 spec 覆盖度约 80 分，但「未携带请求标识的处理」缺失——这正是 clarify 存在的意义。结论：**AI 写规格，人负责挑刺**
2. **审数据模型抓正确性**：plan 阶段我重点只查两件事——唯一约束兜底幂等、条件更新防超卖。把正确性从「应用层自觉」下沉为「数据库强制」
3. **识别 AI 的合理发挥 vs 加戏**：AI 自主设计了 D7 重放语义（首单 201/重放 200/体不同 409 REQUEST_ID_MISMATCH），这是 spec 没有的 how 层设计——但它显式记录在 research.md（决策+理由+备选），所以放行。**标准：发挥可以，必须留痕供审**
4. **测试先行是防 AI 乱来的硬约束**：测试先 Red 证明契约有效，实现后禁止改测试迎合代码——AI 只有实现权，没有契约修改权

## 六、面试话术（60 秒版）

> 我在练习项目里用 Spec Kit 完整走了一遍 SDD。先 constitution 定原则，然后我只用自然语言描述了下单需求，specify 生成了带优先级和验收标准的规格；审规格时我发现「没带幂等键怎么办」这个歧义，clarify 阶段我拍板拒绝处理——理由和 Stripe 的 Idempotency-Key 一致，服务端自己生成标识等于放弃幂等。plan 阶段我把技术栈作为约束输入，重点审了数据模型：request_id 唯一约束兜底幂等、条件更新防超卖、事务保证原子性——这和我之前在 MySQL 并发场景里练的方案是同一套。tasks 拆成 19 个任务，每个故事强制测试先行。最后 implement 交付 24 个测试全绿，包括 100 并发抢 1 件库存的防超卖实测。整个过程我的角色是**定契约、审意图、做关键决策**，AI 负责实现——这就是我认为 AI 时代工程师价值上移的方向。

## 七、常见追问

**Q：和直接让 AI 写代码比，慢吗？**
前期写规格花了时间，但 implement 阶段零返工、零方向性错误。慢的是「AI 直接写→人肉验证→发现理解错了→重写」的循环。规格成本 < 返工成本，需求越复杂越明显。

**Q：这套流程最大的坑是什么？**
规格漂移——实现完不更新规格，下次会话拿到过期上下文。所以 OpenSpec 有 archive 步骤，Spec Kit 的 specs/ 跟着 Git 走。

**Q：什么需求值得走全流程？**
按风险分档：小需求简规格+测试即可；资金、库存、权限这类高风险模块，多小都走完整链路。

## 八、Spec Kit 仓库内容的规范管理（迭代模型）

> 面试问题：「后期功能迭代，Spec Kit 里的东西怎么管？」
> 核心原则：**每次变更一份新档案，全部进 Git；主规格永远是最新事实；历史档案只归档不删除。**

### 1. 目录即档案：编号规则

每次 `$speckit-specify` 自动开新分支 + 新编号目录，一个目录就是一次变更的完整档案：

```text
specs/
├── 001-product-ordering/     ← 下单（已完成）
├── 002-order-cancel/         ← 迭代：取消订单
└── 003-inventory-replenish/  ← 迭代：库存补货
```

- 编号单调递增，**永远不在旧目录里塞新需求**
- 目录里的 spec/plan/tasks/research/contracts 是该功能的「设计决策链」，随时能回答"当时为什么这么设计"

### 2. Git 与分支规范

| 规则 | 说明 |
|---|---|
| 一功能一分支 | 分支名 = 编号目录名（如 `001-product-ordering`），合并后分支可删，档案永久留在 specs/ |
| 规格与代码同 PR | spec.md、plan.md、tasks.md 和实现代码必须同一个 PR 进主干，防止「代码到了、规格没到」 |
| 提交节奏 | 规格产物（specify/clarify/plan/tasks）可先提交一次；实现按 Phase 提交（对应 tasks.md 的 Checkpoint） |
| PR 描述挂规格 | PR 里链接对应 specs/NNN 目录，reviewer 先看规格再看代码 |

### 3. 迭代的两种路径

**A. 全新功能**：重复七步流程，开新编号目录，与旧档案无耦合。

**B. 修改已有功能**（迭代的大头，如给下单加「支付超时自动取消」）：

1. **先读旧规格**——旧 spec 是 AI 的上下文来源，跳过这步就是基于过期事实做设计
2. 开 `004-order-timeout` 新档案，spec 里明确写「修改 001 的哪些行为」
3. 实现完成后，**回写 001 的主 spec 保持最新**（Spec Kit 的弱项，靠纪律；OpenSpec 的 delta 模式天生擅长这个：changes/ 里只写 ADDED/MODIFIED/REMOVED，archive 时自动合并回主规格）

```text
# OpenSpec 的 delta 模式（对比参考）
openspec/
├── specs/ordering/spec.md      ← 主规格，永远最新
└── changes/
    ├── add-order-timeout/      ← 本次 delta：只写增删改
    └── archive/2026-09-10-add-order-timeout/  ← 完成后归档
```

### 4. 主规格保鲜（防规格漂移）

规格漂移 = 实现和规格不同步，是传统文档最大的病。三条纪律：

1. **实现完必须回写规格**——它和「写测试」一样是 DoD 的一部分，不是可选动作
2. **下次迭代第一步是读规格不是写代码**——规格过期时 AI 的错误会层层放大
3. **发现漂移立即修**——review 时发现代码和规格对不上，当 bug 处理

### 5. constitution 的演进

- constitution 是长期有效的「项目宪法」，不随单次迭代改
- 触发修改的信号：**同一类问题在 review 中出现 2 次以上** → 升级为宪法条款
- 改宪法要走团队共识（它的修改成本 > 收益时必须忍住），改动本身也进 Git 历史

### 6. 各产物的生命周期

| 产物 | 生命周期 | 管理方式 |
|---|---|---|
| constitution.md | 长期 | 慎重改、版本化 |
| checklists/requirements.md | 一次性 | specify 阶段质量门，用完留档即可 |
| spec.md | 长期 | 主规格，随迭代回写保鲜 |
| plan.md / research.md | 冻结 | 记录当时决策，实现后不 retroactive 修改（决策变了开新档案） |
| tasks.md | 一次性 | 实现完即完成使命，留档追溯 |
| quickstart.md | 半长期 | 可演进为回归验证手册，随接口变化更新 |

### 7. 反模式清单（面试可举的"坑"）

- ❌ 直接在旧 specs 目录上改出新需求 → 历史决策链断裂
- ❌ 实现完不更新主规格 → 下次迭代基于过期上下文
- ❌ 规格和实现分两个 PR 合入 → 主干上出现「无规格的代码」
- ❌ 用聊天记录/issue 评论代替规格 → AI 读不到，等于没写
- ❌ 删除旧编号目录"保持整洁" → 可追溯性归零
- ❌ plan.md 事后修改掩饰当初的错误决策 → 决策记录的意义就是留下真实的思考路径

---

## 九、关联文档

- [AI开发流程-SDD+BDD+TDD](./AI开发流程-SDD-BDD-TDD.md) — 理论框架与选型
- [前端测试-TDD实战](./前端测试-TDD实战.md)、[前端测试-BDD与E2E](./前端测试-BDD与E2E.md)
- Demo 代码：`spec-kit-demo/`（工作区根目录）
