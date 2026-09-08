# AI 时代个人开发流程：SDD + BDD + TDD

> 面试用途：描述「我如何用流程约束 AI 代码交付质量」的完整话术与知识体系。
> 核心一句话：**SDD 定义「做什么、边界是什么」，BDD 定义「用户可观察的行为是什么」，TDD 定义「代码怎样才算正确」，AI 负责加速生成，测试、CI 和人工评审负责兜底。**

---

## 一、60 秒速答模板（个人开发流程版）

> 我现在开发不会让 AI 直接写代码，而是把 AI 放进一条「规格驱动 + 行为驱动 + 测试驱动」的流水线里：
>
> 1. **SDD 先行**：用 Spec Kit 或 OpenSpec 把需求、边界、技术方案、任务拆解先写成规格，规格是 AI 的唯一事实来源；
> 2. **BDD 定验收**：把核心业务规则转成 Given/When/Then 场景，让产品、测试、开发用同一种语言确认预期；
> 3. **TDD 定正确性**：AI 根据规格先生成测试，我重点审查「测试是否表达业务意图」，确认 Red 之后再让 AI 实现到 Green；
> 4. **小步实现**：按 tasks.md 一次一个任务，限定修改范围，防止 AI 自由发挥；
> 5. **多层验证**：lint/类型 → 单测 → 集成 → Playwright 关键链路 E2E → 构建，全绿后人工 Review 业务语义才合并；
> 6. **规格归档**：把规格合并回主文档，避免下次会话拿到过期上下文。
>
> 本质上：**AI 是生产力工具，规格是唯一事实来源，测试是可执行约束，CI 和人工评审是质量门禁。**

---

## 二、三者层级关系（不是三选一）

| 层级 | 核心问题 | 典型产物 | 常用工具 |
|---|---|---|---|
| SDD | 需求是否清楚、实现是否有边界 | spec / plan / tasks | Spec Kit、OpenSpec |
| BDD | 业务行为是否符合用户预期 | Given/When/Then 验收场景 | Gherkin + playwright-bdd |
| TDD | 局部代码是否正确、可回归 | 单元/集成测试 | Vitest、Testing Library、Supertest |

```text
SDD：Feature/System 级别的规格
BDD：业务行为级别的验收语言
TDD：函数/模块级别的可执行规格
```

**纠偏（面试常挖坑）：BDD ≠ Playwright。** Playwright 是浏览器自动化/E2E 工具；BDD 是方法论，用 Gherkin 描述行为。严格 BDD = `.feature` + Step Definition + Playwright 驱动浏览器（playwright-bdd）；省略 Gherkin 直接写 Playwright 的叫 E2E 验收测试，不算严格 BDD。详见 [前端测试-BDD与E2E](./前端测试-BDD与E2E.md)。

---

## 三、完整流程八步

```text
需求/想法
  ↓ 0. 项目级约束（AGENTS.md / constitution：技术栈、规范、禁止事项、测试要求）
  ↓ 1. SDD：写清需求规格 + 技术方案 + 任务拆解
  ↓ 2. BDD：核心业务规则 → Given/When/Then 验收场景
  ↓ 3. TDD：AI 生成测试 → 人审测试意图 → 确认 Red
  ↓ 4. AI 按任务小步实现 → Green → Refactor
  ↓ 5. 多层验证：静态检查 → 单测 → 集成 → Playwright E2E → 构建
  ↓ 6. PR + CI 证据 + 人工 Review（业务语义/高风险操作）
  ↓ 7. 规格归档（OpenSpec archive / Spec Kit 留档），成为下次开发上下文
```

### 第 0 步：项目级约束

先给 AI 稳定上下文：技术栈版本、目录结构、编码规范、架构边界、禁止事项、测试要求。产物：`AGENTS.md` / `constitution.md`。解决的是**不同会话、不同工具生成风格不一致**的问题。

### 第 1 步：SDD 写规格

规格至少覆盖：背景目标、用户故事、范围与非目标、业务规则、数据模型、API 契约、状态流转、异常场景、幂等策略、并发约束、验收标准、回滚兼容。

**Spec Kit vs OpenSpec 选型：**

| 工具 | 流程 | 适合 |
|---|---|---|
| Spec Kit | constitution → specify → clarify → plan → tasks → analyze → implement | 新项目、多人团队、强治理 |
| OpenSpec | proposal → specs delta → design → tasks → apply → verify → archive | 存量项目、轻量迭代、小团队 |

一句话：**大型团队强流程选 Spec Kit；存量项目轻量迭代选 OpenSpec。**

### 第 2 步：BDD 定验收

```gherkin
Feature: 并发扣减库存

  Scenario: 两个用户同时购买最后一件商品
    Given 商品 A 当前库存为 1
    When 用户甲和用户乙同时提交购买请求
    Then 只有一个用户下单成功
    And 另一个用户看到"库存不足"
    And 商品 A 的最终库存为 0
```

价值：产品/测试/开发同一种语言；AI 不容易误解需求；验收标准提前冻结；关键路径可自动化。

### 第 3 步：TDD 定正确性

AI 时代的 Red-Green-Refactor：

1. 人确认 SDD 和 BDD；
2. AI 根据规格生成测试；
3. **人重点审查测试是否表达业务意图**（这是 AI 时代 TDD 的关键变化——审测试比审代码优先级更高）；
4. 确认 Red → AI 最小实现 → Green → Refactor。

前端测试分层：

| 代码类型 | 测试方式 |
|---|---|
| 纯函数/工具函数 | Vitest 单测 |
| 复杂 Hook/状态机 | Testing Library + Vitest |
| API Adapter/缓存策略 | 集成测试 + MSW |
| 后端接口/事务 | Supertest + 测试库 |
| 关键用户路径 | Playwright E2E（只覆盖关键链路，不求全） |

### 第 4 步：AI 小步实现

不要「帮我把整个功能做完」，而是按 tasks.md 拆任务，每次给 AI 的上下文固定包括：当前规格、技术方案、当前任务、相关测试、项目规范、允许修改的文件范围、禁止事项。Prompt 要点：

```text
只根据 spec.md 和 tasks.md 完成 T003：
1. 不允许修改范围外文件；
2. 先运行现有测试；
3. 不通过时不允许改测试迎合实现；
4. 最后说明改动文件、测试结果和遗留风险。
```

### 第 5-7 步：验证、Review、归档

- **测试全绿只是第一层**，AI 难判断业务语义、产品体验、高危操作（资金/删数据），这些必须人工确认；
- PR 应带：规格链接、任务编号、测试证据、E2E trace、风险与回滚方案；
- 归档规格，否则下次 AI 会话拿到过期上下文 → 规格漂移。

---

## 四、贯穿案例：库存扣减（一个需求走完整条链）

| 层级 | 内容 |
|---|---|
| SDD | 不能超卖；请求幂等；库存不足返回统一错误码；订单与库存事务一致；支付超时恢复库存 |
| BDD | Given 库存为 1，When 两人同时购买，Then 一人成功一人看到库存不足，最终库存为 0 |
| TDD | `reserveStock` 并发/幂等/回滚单测：库存不为负、同 requestId 只扣一次、两并发只成功一个 |
| Playwright | 点击购买 → 页面显示成功/库存不足 → 与 DB 状态一致 |

---

## 五、落地三档（流程成本匹配需求风险）

| 档位 | 流程 |
|---|---|
| 小需求 | 简短规格 → 单测 → AI 实现 → CI → Review |
| 中等需求 | OpenSpec proposal → 关键 BDD 场景 → TDD → AI 实现 → Playwright 核心路径 → Review → Archive |
| 大型需求 | Spec Kit 全流程 → BDD → TDD → E2E → checklist/verify → 发布观测 |

原则：**不为方法论而方法论**，但高风险模块（资金、库存、权限）无论多小都走完整链路。

---

## 六、高频追问 Q&A

**Q1：AI 写的测试靠谱吗？会不会自己写测试自己过？**
所以流程里「人审测试意图」是强制门禁：测试必须先 Red（在实现前失败），证明测试确实在约束行为；实现后禁止改测试迎合代码。测试是契约，AI 只有实现权没有契约修改权。

**Q2：TDD 会不会拖慢 AI 时代的开发速度？**
恰恰相反。没有测试约束时，AI 生成 → 人肉验证 → 改 bug 的循环更慢；测试先行后，验证交给机器，人只做意图确认。真正慢的是「测试全绿但业务不对」的返工。

**Q3：规格会不会很快过时？**
所以最后一步是归档：OpenSpec 把 delta spec 合并回主规格；Spec Kit 留档 spec/plan/tasks。规格和代码一起进 Git，跟着 PR 走，保证「规格即最新事实」。

**Q4：和传统流程比，本质变化是什么？**
以前文档是写给人看的、写完就过时；现在规格是写给 AI 的输入、测试是机器可执行的验收。人的角色从「写代码」上移为「定契约、审意图、做高风险决策」。

**Q5：怎么防止 AI 改出范围外的代码？**
任务拆小 + 限定文件范围 + CI 门禁 + diff Review。一次任务一个 diff，范围外改动直接打回。

---

## 七、关联文档

- [前端测试-TDD实战](./前端测试-TDD实战.md) — xDD 辨析、红绿重构实操、client/ vitest 基建
- [前端测试-BDD与E2E](./前端测试-BDD与E2E.md) — playwright-bdd 三层模型、AI 工作流闭环、flaky 治理
- [Agent工程化专题](./Agent工程化专题.md) — Skill/MCP/Sub-Agent 工具链

## 参考资料

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [GitHub Blog：Spec-driven development with AI](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-getting-started-with-a-new-open-source-toolkit/)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [Playwright 官方文档](https://playwright.dev/docs/intro)
- [Cucumber BDD 指南](https://cucumber.io/docs/bdd/)
- [Spec-Driven Development: From Code to Contract in the Age of AI Coding Assistants](https://arxiv.org/html/2602.00180v1)
