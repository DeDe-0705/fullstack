# 出入预约后台管理 — 面试要点

> 项目时间：2026.01 - 2026.04 | 角色：项目 Owner
> 前端技术栈：Vue3 + TypeScript + Pinia + 公司组件库（基于 Element Plus 二次封装）
> 后端技术栈：Spring Boot + Maven + MySQL + Kafka + Eureka（微服务，Feign 调用）
> AI 研发：Claude Code（Claude Opus 4.6）+ 前端/后端双 Agent + lark-cli + MCP

---

## 一、项目一句话介绍

> "出入预约是理想汽车工厂车辆进出预约管理后台。业务管理员查看工厂提交的进出车辆预约单，在特殊情况下介入处理——操作车辆入场/出厂、修改预约负责人等。我作为项目 Owner，主导搭建了基于 Claude Code 的前后端双 Agent 研发环境：用 Skill 固化项目规范与已封装业务 SDK 的使用方法，用 lark-cli 拉取飞书需求文档，用 chrome-devtools-mcp / Playwright MCP 核验功能，人工聚焦信息整理、验收与上线，实现从需求到交付的完整闭环。"

---

## 二、项目背景与角色定位

### 业务背景

- 工厂车辆进出需要提前预约，业务侧提交预约单
- 业务管理员在后台查看预约单信息，处理特殊情况：车辆入场/出厂、修改预约负责人等
- 项目目标：厂区车辆进出流程规范化管控

### 我的角色

项目 Owner，负责：

1. AI 研发环境搭建：Skill、系统提示词、前后端双 Agent
2. 信息整理：收集需求/业务信息，整理成 AI 可执行的任务描述
3. 统筹交付：验收 AI 产出、部署上线、把控投产质量

### 技术挑战

- 前后端并行开发，接口联调成本高、类型同步容易遗漏
- 项目已有封装好的业务 SDK 和微服务公共依赖，AI 需要"会用"而不是"重造"
- 团队规范不统一，AI 输出质量需要约束与校验

---

## 三、Claude Code 研发环境标准化

### 3.1 Skill 体系建设

**问题：** 团队成员 AI 使用水平不一，AI 不了解项目规范与已有封装，容易写出"能用但不符合约定"的代码。

**方案：** 搭建项目级 Skill，统一约束 AI 行为：

- 前端约束：Vue3 + TypeScript + Pinia + 公司组件库（基于 Element Plus 二次封装）；API 统一走封装请求层；按钮级权限必须通过权限指令；类型定义集中管理
- 后端约束：Spring Boot + Maven；统一响应格式；接口必须带权限注解；数据表包含 create_time / update_time / is_deleted
- SDK 用法沉淀：把已封装的前端业务 SDK（权限、组件库）与后端公共依赖（鉴权、Feign 服务）的"正确用法"写进 Skill，明确告诉 AI 用什么、怎么用、不要自己造

```markdown
<!-- .claude/skills/project-standards.md -->
# 出入预约项目规范

## 技术栈约束
- 前端：Vue3 + TypeScript + Pinia + 公司组件库（基于 Element Plus 二次封装）
- 后端：Spring Boot + Maven + MySQL + Kafka + Eureka

## 前端规范
1. API 调用统一使用 @/utils/request.ts，禁止直接 import axios
2. 按钮级权限必须通过权限指令控制（前端只是体验层，后端鉴权兜底）
3. 接口类型放在 @/types/api.ts，组件 Props 类型放在组件文件内
4. 页面客户端状态优先使用 Pinia 管理

## 后端规范
1. 接口路径 RESTful，统一响应格式 { code, data, message }
2. 所有接口必须带权限注解
3. 数据表必须包含 create_time、update_time、is_deleted
4. 车辆/人员等数据通过 Feign 调用公共服务获取，不在本服务重复维护
5. Kafka 消费的事件需考虑幂等与异常兜底

## SDK 用法
- 前端：使用公司组件库（基于 Element Plus 二次封装）与权限 SDK，禁止自行实现
- 后端：鉴权 SDK 与人员信息公共依赖按已有封装调用
```

### 3.2 前后端双 Agent

**问题：** 单 Agent 同时处理前后端任务上下文过重、互相干扰；后端接口变更后前端类型手动同步容易遗漏。

**方案：** 在 Claude Code 中拆成两个 Sub-Agent，各自有独立提示词：

| Agent | 职责 | 提示词要点 |
|-------|------|-----------|
| 前端 Agent | 前端页面开发 + 自校验 | 项目规范、组件库/权限 SDK 用法、类型与错误处理要求、输出清单 |
| 后端 Agent | 后端接口与数据处理 | 接口规范、鉴权注解、Kafka/Feign 用法、接口完成后同步生成前端 TS 类型与 API 函数 |

```markdown
<!-- .claude/agents/frontend.md -->
name: frontend
description: 出入预约前端开发 Agent
tools: Read, Edit, Bash

你是出入预约项目的前端开发专家。
1. 使用公司组件库（基于 Element Plus 二次封装）与权限 SDK
2. 组件必须有完整的 TypeScript 类型定义
3. API 调用必须有错误处理和 loading 状态
4. 输出格式：完成的文件清单 + 自校验结果（通过/警告/必须修复）
```

```markdown
<!-- .claude/agents/backend.md -->
name: backend
description: 出入预约后端开发 Agent
tools: Read, Edit, Bash

你是出入预约项目的后端开发专家。
1. 接口遵循 RESTful 与统一响应格式
2. 所有接口带权限注解
3. 车辆/人员数据通过 Feign 获取，离职等事件通过 Kafka 消费
4. 接口完成后同步生成前端 TS 类型与 API 调用函数
5. 输出格式：接口清单 + 生成的类型文件清单
```

### 3.3 提示词工程

- 系统提示词：项目背景、技术栈、当前任务、约束条件
- 前端 Agent 提示词：规范 + SDK 用法 + 校验清单
- 后端 Agent 提示词：规范 + 微服务依赖用法 + 类型输出要求

---

## 四、AI 驱动研发流程

### 4.1 完整流程

```
需求文档（飞书）
       │
       ▼
lark-cli 拉取需求/技术方案
       │
       ▼
人工整理信息，形成 AI 可执行的任务描述（业务规则、边界、验收标准）
       │
       ▼
前端 Agent / 后端 Agent 并行开发（接口契约先行 + Mock + 类型同步）
       │
       ▼
chrome-devtools-mcp / Playwright MCP 页面功能核验
       │
       ▼
人工验收 → 部署上线 → 投产质量把控
```

### 4.2 前后端并行开发

**传统模式：** 前端等后端接口定义 → 前端开发 → 联调 → 发现问题返工

**AI 模式：**

1. 接口契约先行：后端 Agent 先输出接口定义与统一响应结构
2. 前端并行：前端 Agent 基于 Mock 和生成的类型开始页面开发
3. 类型同步：后端接口完成，后端 Agent 自动生成/更新前端 TS 类型与 API 函数
4. 联调验证：MCP 跑页面流程，核对类型与接口行为

**效果（定性描述）：** 减少接口联调的等待与返工，避免手动同步类型带来的遗漏；重复性、机械性工作交给 AI，人工聚焦信息整理、验收与质量把控。

---

## 五、核心业务实现

### 5.1 状态流转

核心状态（按车辆进出实际动作）：

```typescript
// types/reservation.ts
export enum ReservationStatus {
  PENDING = 'PENDING',       // 待入场（预约已提交）
  ENTERED = 'ENTERED',       // 已入场（车辆进厂/签到）
  EXITED = 'EXITED',         // 已出厂（车辆离厂/签退）
  CANCELLED = 'CANCELLED'    // 已取消
}

const statusFlow: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.ENTERED,
    ReservationStatus.CANCELLED
  ],
  [ReservationStatus.ENTERED]: [
    ReservationStatus.EXITED
  ],
  [ReservationStatus.EXITED]: [],
  [ReservationStatus.CANCELLED]: []
}

export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus
): boolean {
  return statusFlow[from].includes(to)
}
```

管理员在特殊情况下介入：操作车辆入场/出厂、修改预约负责人；状态变更需二次确认，前端 loading 防重复点击，后端做状态校验兜底。

### 5.2 权限与数据依赖

```typescript
// directives/permission.ts
import { useUserStore } from '@/stores/user'

export const permission = {
  mounted(el: HTMLElement, binding: { value: string | string[] }) {
    const userStore = useUserStore()
    const requiredPermissions = Array.isArray(binding.value)
      ? binding.value
      : [binding.value]
    const hasPermission = requiredPermissions.some(perm =>
      userStore.permissions.includes(perm)
    )
    if (!hasPermission) {
      el.parentNode?.removeChild(el)
    }
  }
}
```

要点：

- 前端权限指令只控制"能不能看到/操作"，真正鉴权必须由后端权限注解兜底
- 多个权限同时需要时，指令内应使用 `every` 而非 `some`（按业务语义选择）
- 车辆/人员数据通过 Feign 调用公共微服务获取；Kafka 消费员工离职等事件，联动处理预约负责人相关数据

---

## 六、高频面试题

### Q1: Claude Code 和 Copilot 有什么区别？

> "当时选型的核心差异：Copilot 更偏编辑器内 AI 辅助，Claude Code 是终端里的 agentic 编程环境，支持 Skill 定制、Sub-Agent 拆分和 MCP 连接外部工具，更适合我们做流程化、多任务的研发协作。相比工具本身，我更看重它能沉淀项目规范与 SDK 用法，形成可复用的研发配置。"

### Q2: Sub-Agent 具体怎么实现的？

> "拆成前端 Agent 和后端 Agent，各自有独立提示词。前端 Agent 负责页面开发并自校验规范；后端 Agent 负责接口与数据处理，接口完成后同步生成前端 TS 类型和 API 函数。两个 Agent 通过 Claude Code 的 Sub-Agent 机制独立执行，人工在关键节点确认任务描述和验收结果。"

### Q3: AI 生成的代码质量怎么保证？

> "四层：1) 输入层，Skill 固化规范与已封装 SDK 的用法，减少 AI 自由发挥；2) 执行层，前后端 Agent 各自按提示词自校验；3) 测试层，chrome-devtools-mcp / Playwright MCP 跑页面流程验证正常与异常分支；4) 人工层，验收、部署、投产质量把控。前端权限只是体验，后端权限注解兜底。"

### Q4: 这个项目最大的技术挑战是什么？

> "让 AI 正确使用已有的封装，而不是重新造轮子——前端要用公司组件库和权限 SDK，后端要通过 Feign 拿车辆/人员数据、通过 Kafka 消费事件。这些依赖的用法必须沉淀进 Skill 和提示词，AI 才不会写出与团队体系脱节的代码。其次是前后端类型同步，用后端 Agent 自动生成来避免手动遗漏。"

### Q5: AI 驱动的研发流程有什么局限？

> "1) 复杂业务规则和异常边界还是要人来设计，AI 适合标准化、重复性工作；2) AI 依赖输入质量，需求信息整理得越清楚，产出越可控；3) 上下文和成本需要控制，任务要拆得足够小；4) 验收标准必须人定，AI 不能替人做投产决策。"

---

## 七、项目亮点总结

| 亮点 | 说明 | 面试价值 |
|------|------|----------|
| Claude Code Skill 体系 | 规范约束 + 已封装 SDK 用法沉淀 | AI 工程化能力 |
| 前后端双 Agent | 并行开发 + 类型自动同步 | AI 工作流设计能力 |
| 全栈交付 | Vue3 + Spring Boot 微服务（Kafka/Eureka/Feign） | 技术广度与业务闭环 |
| 业务建模 | 状态流转 + 权限管控 | 业务理解与边界设计 |
| 人机分工 | 人工整理信息/验收/部署，AI 承担重复开发 | 流程落地与质量把控 |

---

## 八、容易被追问的点（准备口径）

| 追问 | 准备口径 |
|------|----------|
| 状态并发：两个管理员同时操作怎么办？ | 前端操作二次确认 + 按钮 loading；后端状态校验兜底，必要时加版本号/乐观锁 |
| 入场/出厂重复点击？ | 前端防重复提交，后端接口保证幂等（同一单同一动作只生效一次） |
| 前端权限被绕过怎么办？ | 权限指令只是体验层，后端接口必须做权限注解校验 |
| AI 生成代码有越权/XSS 风险？ | 统一请求层 + 后端鉴权兜底；页面流程用 MCP 跑正常/异常分支 |
| 员工离职消息怎么处理？ | Kafka 消费离职事件，联动预约负责人相关数据（失效或转交），消费需幂等 |
| 车牌号等数据从哪来？ | Feign 调公共车辆/人员服务，本服务不重复维护数据 |

---

## 相关文档

- [Java 后端技术栈（面试速查）](./Java后端技术栈.md) — Spring Boot / Maven / MySQL / Kafka / Eureka / Feign / Apollo 定位与追问口径
