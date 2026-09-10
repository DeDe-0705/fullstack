<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0（MAJOR：项目定位与核心原则被重新定义，向后不兼容）
- Modified principles:
  - I. 规格驱动开发 → I. 测试先行（TDD，NON-NEGOTIABLE）
  - III. 代码质量与最佳实践 → IV. 代码即文档（聚焦命名与"为什么"注释）
  - V. 简单优先（YAGNI）→ II. 简单优先（Simplicity，语义保留、表述收紧）
  - IV. 演示即最佳实践 → III. 业务不变量：库存非负 + 写操作幂等
  - （新增）V. 交付标准（DoD）= 测试通过 + 类型检查通过
- Removed principles:
  - II. 中文优先沟通（并入技术约束章节，不再单列原则）
- Added sections:
  - 技术与工具约束（Node.js + TypeScript 技术栈）
  - 开发工作流与质量门（DoD 门禁化）
  - Governance
- Removed sections: 无
- Follow-up TODOs: 无（所有占位符均已填充）
-->

# 库存下单 API Constitution

本项目是面试练习项目：Node.js + TypeScript 实现的库存下单 API。

## Core Principles

### I. 测试先行（TDD，NON-NEGOTIABLE）

所有业务逻辑 MUST 遵循 Red-Green-Refactor：先写失败的测试 → 最小实现使其通过 → 重构。
禁止先写实现后补测试；每个 PR/提交 MUST 能以测试文件证明对应业务逻辑的行为。
测试即规格：测试用例 MUST 覆盖正常路径、边界条件（如库存恰好为 0）与失败路径。

理由：TDD 是本项目作为面试练习的核心训练目标，也是库存类业务防回归的最低成本手段。

### II. 简单优先（Simplicity）

不引入当前需求用不到的框架和抽象；每个依赖、每层抽象 MUST 能回答
「它解决了哪个当前已存在的问题」。
优先使用 Node.js 标准库与 TypeScript 原生能力；三层相似代码优于一层过早抽象。

### III. 业务不变量：库存非负 + 写操作幂等

库存数量在任何代码路径下 MUST NOT 为负数：扣减 MUST 使用条件检查
（先校验再扣减，或原子条件更新），库存不足时操作失败且状态不变。
所有写操作 MUST 幂等：同一请求重复提交（重试/双击/网络重发）不得产生重复扣减或重复订单，
MUST 通过幂等键（如请求 ID/订单号）去重实现。

理由：这是库存下单域的核心正确性约束，也是面试高频考点，必须以强制规则形式落地。

### IV. 代码即文档

命名 MUST 表意：标识符直接表达业务含义（如 `reserveStock` 优于 `doOp`），
禁止依赖注释解释含糊的命名。
复杂业务规则旁 MUST 有注释说明「为什么」（业务原因、边界由来），而非复述「是什么」；
简单代码不需要注释。

### V. 交付标准：测试通过 + 类型检查通过

任何任务完成的定义（DoD）= 全部测试通过 AND `tsc --noEmit` 类型检查零错误。
两项任一不通过，任务 MUST NOT 标记为完成，也 MUST NOT 提交。
禁止使用 `any`、类型断言或 `@ts-ignore` 绕过类型错误来「假装通过」。

## 技术与工具约束

- 运行时与语言：Node.js + TypeScript（strict 模式）。
- 包管理 MUST 使用 pnpm；修改依赖后 MUST 同步提交 `pnpm-lock.yaml`。
- 测试与类型检查命令 MUST 在 package.json scripts 中固定（如 `test`、`typecheck`），
  保证任何人一条命令即可验证 DoD。
- 沟通与文档使用中文；代码标识符使用英文，注释使用中文。
- Git 分支 MUST 使用 `codex/` 前缀；提交信息描述「为什么改」而不只是「改了什么」。

## 开发工作流与质量门

- 功能开发 MUST 按 Spec Kit 流程推进：specify →（clarify）→ plan → tasks → implement。
- implement 阶段 MUST 按 TDD 节奏执行：任务拆解到可测试的最小行为单元，
  先红后绿再重构。
- 每个任务收尾 MUST 运行测试与类型检查并确认全绿；审查时 MUST 核对：
  库存非负约束是否有测试覆盖、写接口幂等性是否有测试覆盖。
- 发现与宪法的偏离时 MUST 先修正实现或提出宪法修订，禁止静默绕过。

## Governance

本宪法效力高于其他一切实践约定；任何与之冲突的做法以本宪法为准。
修订程序：提出修订 → 说明理由与影响 → 更新本文件并同步 Sync Impact Report → 提交 Git 记录。
版本语义：MAJOR = 原则移除或重新定义（向后不兼容）；MINOR = 新增原则或实质性扩充；
PATCH = 措辞澄清、错别字等非语义修改。
每次规划（plan）与任务审查 MUST 对照本宪法做合规检查，重点核对三条红线：
是否有未测先实现的业务逻辑、库存是否可能为负、写操作是否幂等。

**Version**: 2.0.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-08
