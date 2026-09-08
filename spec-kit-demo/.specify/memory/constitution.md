<!--
Sync Impact Report
- Version change: 0.0.0（未填写的模板占位）→ 1.0.0
- Modified principles: 无（首次制定，全部新增）
- Added sections:
  - Core Principles（I. 规格驱动开发 / II. 中文优先沟通 / III. 代码质量与最佳实践 / IV. 演示即最佳实践 / V. 简单优先 YAGNI）
  - 技术与工具约束
  - 开发工作流与质量门
  - Governance
- Removed sections: 无
- Follow-up TODOs: 无（所有占位符均已填充）
-->

# spec-kit-demo Constitution

## Core Principles

### I. 规格驱动开发（Spec-Driven Development）

每个功能 MUST 先经历 Spec Kit 工作流（specify → plan → tasks → implement），再进入编码；
规格文档（spec.md）是事实来源，代码实现 MUST 与规格保持一致；
禁止跳过规格直接写实现代码——规格先行，实现随后。

理由：本项目是 Spec Kit 的学习演示工程，工作流本身就是学习对象；
先规格后实现也是大厂复杂协作的主流实践。

### II. 中文优先沟通

所有面向用户的回复、文档、规格、计划与任务清单 MUST 使用中文；
代码标识符（变量、函数、类名）保持英文，注释 MUST 使用中文；
沟通保持专业、友好：复杂问题分段解释，简单问题直接回答，需要时提供代码示例。

### III. 代码质量与最佳实践

代码 MUST 遵循以下硬性规则：优先使用现代语法与最佳实践；遵循 DRY 原则，禁止复制粘贴式重复；
优先使用标准库和成熟工具，不重复造轮子；代码清晰、可维护；
注释 MUST 解释「为什么」而不是复述「是什么」。

### IV. 演示即最佳实践

本项目的一切示例代码 MUST 体现主流最佳实践，作为面试可复述的参考实现；
宁可少写示例，也不写违背最佳实践的「能跑就行」代码；
每个非显而易见的选型 MUST 在注释或文档中说明权衡理由。

理由：本项目服务于面试准备，示例代码会被直接用于复习与表达，质量就是话术素材。

### V. 简单优先（YAGNI）

从最简单的可行方案开始；只为当前明确的需求设计，禁止预设式过度设计；
引入任何抽象（基类、框架、中间层）前 MUST 能回答「它解决了哪个已存在的问题」；
三层相似代码优于一层过早抽象。

## 技术与工具约束

- 包管理 MUST 使用 pnpm；修改依赖后 MUST 同步提交 `pnpm-lock.yaml`。
- 脚本与命令以 POSIX sh/bash 为准（Spec Kit 脚本栈）。
- Git 分支 MUST 使用 `codex/` 前缀；阶段性工作完成后及时提交，提交信息使用中文描述。
- 改动文件前 MUST 先阅读相关文件理解上下文，遵循项目已有配置与模板结构。

## 开发工作流与质量门

- 功能开发 MUST 按 Spec Kit 流程推进：constitution → specify →（clarify）→ plan → tasks →
  （analyze / checklist）→ implement。
- 进入 implement 前 MUST 完成：spec.md 无未解决的澄清点、plan.md 通过宪法合规检查、
  tasks.md 依赖顺序合理。
- 每完成一个任务阶段 MUST 可验证（运行脚本、检查产物），不留「应该没问题」的尾巴。
- 发现与宪法的偏离时 MUST 先修正实现或提出宪法修订，禁止静默绕过。

## Governance

本宪法效力高于其他一切实践约定；任何与之冲突的做法以本宪法为准。
修订程序：提出修订 → 说明理由与影响 → 更新本文件并同步 Sync Impact Report → 提交 Git 记录。
版本语义：MAJOR = 原则移除或重新定义（向后不兼容）；MINOR = 新增原则或实质性扩充；
PATCH = 措辞澄清、错别字等非语义修改。
每次涉及本项目的规划（plan）与评审 MUST 对照本宪法做合规检查；复杂度超出原则约束时
MUST 在计划中显式论证。

**Version**: 1.0.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-08
