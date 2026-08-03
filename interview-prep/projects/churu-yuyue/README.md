# 出入预约后台管理 — 面试要点

> 项目时间：2026.01 - 2026.04 | 角色：项目 Owner
> 技术栈：Vue3 + TypeScript + Spring Boot + Claude Code

---

## 一、项目一句话介绍

> "出入预约是理想汽车工厂车辆进出管理系统，我主导了从 Claude Code 研发环境标准化到全栈交付的完整流程。核心亮点是搭建了 Sub-Agent 协同研发体系，实现前端代码自动校验、后端接口自动生成前端 TS 类型，研发效率提升 50%+。"

---

## 二、项目背景与创新点

```
业务背景：
  工厂车辆进出需要提前预约，管理员需要：
  - 查看预约单据
  - 编辑预约信息
  - 管控预约状态（签到/签退）
  - 调整预约负责人

技术挑战：
  1. 前后端并行开发，接口联调成本高
  2. 代码规范不统一， review 成本高
  3. 重复性工作多（如根据接口生成 TS 类型）

创新解决方案：
  用 Claude Code + Sub-Agent 搭建 AI 驱动的研发流程
```

---

## 三、Claude Code 研发环境标准化

### 3.1 Skill 体系建设

**问题：** 团队成员 AI 使用水平不一，如何统一研发标准？

**方案：** 搭建项目级 Skill，约束 AI 行为

```markdown
<!-- .claude/skills/project-standards.md -->
# 出入预约项目规范

## 技术栈约束
- 前端：Vue3 + TypeScript + Element Plus
- 后端：Spring Boot 3.2 + JDK 17
- 数据库：MySQL 8.0

## 前端规范
1. 组件命名：PascalCase，如 `ReservationTable.vue`
2. API 调用：统一使用 `@/utils/request.ts`，禁止直接 import axios
3. 权限控制：所有按钮级别权限必须通过 `v-permission` 指令控制
4. 类型定义：接口类型放在 `@/types/api.ts`，组件 Props 类型放在组件文件内

## 后端规范
1. 接口路径：RESTful 风格，如 `/api/v1/reservations`
2. 统一响应格式：`{ code: 200, data: T, message: string }`
3. 鉴权：所有接口必须通过 `@PreAuthorize` 注解控制权限
4. 数据表设计：必须包含 `create_time`, `update_time`, `is_deleted` 字段

## 代码审查清单
- [ ] 前端组件是否有类型定义
- [ ] API 调用是否有错误处理
- [ ] 后端接口是否有权限注解
- [ ] 数据库字段是否有索引
```

### 3.2 Sub-Agent 协同方案

**问题：** 前端写完代码需要人工校验，后端接口变更需要手动同步前端类型

**方案：** 搭建 Sub-Agent 流水线

```yaml
# .claude/agents/frontend-reviewer.md
name: frontend-reviewer
description: 前端代码审查 Agent
tools: Read, Grep, Bash

---

你是出入预约项目的前端代码审查专家。

审查标准：
1. 组件是否有完整的 TypeScript 类型定义
2. API 调用是否有错误处理和 loading 状态
3. 是否使用了项目统一的组件库（@li-people/ui-kit）
4. 是否有权限控制（v-permission 指令）

输出格式：
- ✅ 通过：说明原因
- ⚠️ 警告：说明问题和改进建议
- ❌ 不通过：说明必须修复的问题
```

```yaml
# .claude/agents/api-type-generator.md
name: api-type-generator
description: 根据后端接口生成前端 TypeScript 类型
tools: Read, Write, Bash

---

你是出入预约项目的 API 类型生成专家。

工作流程：
1. 读取后端 Controller 文件（Java）
2. 解析接口路径、请求参数、响应结构
3. 生成对应的 TypeScript 接口定义
4. 生成 API 调用函数

输出文件：
- `src/types/api.ts`：类型定义
- `src/api/modules/`：API 调用函数
```

**协同工作流：**

```
开发者完成前端代码
       │
       ▼
┌─────────────────┐
│ frontend-reviewer │  ← Sub-Agent 自动审查
│   Sub-Agent      │
└────────┬────────┘
         │
    ┌────▼────┐
    │ 审查通过？ │
    └────┬────┘
    是 │    │ 否
       ▼    ▼
   提交代码  返回修改意见
       │
       ▼
后端接口变更
       │
       ▼
┌──────────────────┐
│ api-type-generator │  ← Sub-Agent 自动生成
│    Sub-Agent       │
└────────┬─────────┘
         │
         ▼
   更新前端类型定义
```

### 3.3 系统提示词工程

```markdown
<!-- .claude/system-prompt.md -->
你是出入预约项目的全栈开发助手。

## 项目上下文
- 业务：工厂车辆出入预约管理
- 前端：Vue3 + TypeScript + Element Plus + Pinia
- 后端：Spring Boot 3.2 + MyBatis Plus + MySQL
- 权限：基于 RBAC，角色分为 ADMIN（管理员）、OPERATOR（操作员）

## 当前任务
协助完成出入预约后台管理系统的开发，包括：
1. 预约单据的 CRUD
2. 车辆签到/签退操作
3. 预约状态流转
4. 数据统计报表

## 约束条件
- 所有代码必须符合项目规范（见 .claude/skills/project-standards.md）
- 前端组件必须使用 @li-people/ui-kit 中的基础组件
- 后端接口必须遵循 RESTful 规范
- 数据库操作必须使用 MyBatis Plus，禁止手写 SQL
```

---

## 四、AI 驱动研发流程

### 4.1 需求到代码的完整流程

```
需求文档（飞书文档）
       │
       ▼
┌─────────────────┐
│  lark-cli 拉取   │  ← 自动获取需求文档
│   需求文档       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Claude Code    │  ← 分析需求，生成技术方案
│  生成技术方案     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  人工评审        │  ← 确认方案可行性
│  技术方案        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sub-Agent 并行   │
│  开发：           │
│  - 前端页面       │
│  - 后端接口       │
│  - 数据库表       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sub-Agent 校验   │  ← 自动代码审查
│  - 前端规范       │
│  - 类型同步       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  chrome-devtools │  ← 自动功能核验
│  -mcp /         │
│  Playwright MCP  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  人工部署上线     │  ← 把控投产质量
└─────────────────┘
```

### 4.2 前后端并行开发

**传统模式：** 前端等后端接口定义 → 前端开发 → 联调 → 发现问题 → 返工

**AI 驱动模式：**

```
阶段1：接口定义（1天）
  后端用 Claude Code 生成：
  - Controller 接口定义
  - DTO 数据结构
  - Swagger 文档

  前端同时用 Sub-Agent：
  - 根据 Swagger 生成 TS 类型
  - 生成 Mock API 函数
  - 开始页面开发（用 Mock 数据）

阶段2：并行开发（3天）
  前端：页面 + Mock 数据联调
  后端：业务逻辑 + 数据库

阶段3：联调（0.5天）
  切换 Mock 到真实接口
  Sub-Agent 自动比对类型是否匹配
```

**效率提升：**

| 指标 | 传统模式 | AI 驱动模式 | 提升 |
|------|---------|------------|------|
| 接口联调时间 | 2天 | 0.5天 | 75% |
| 类型同步成本 | 手动，易出错 | 自动，100% 准确 | 100% |
| 代码 review 时间 | 0.5天/人 | 0.1天/人 | 80% |
| 整体交付周期 | 2周 | 1周 | 50% |

---

## 五、核心业务实现

### 5.1 预约状态机

```typescript
// types/reservation.ts
export enum ReservationStatus {
  PENDING = 'PENDING',       // 待审批
  APPROVED = 'APPROVED',     // 已审批
  CHECKED_IN = 'CHECKED_IN', // 已签到
  CHECKED_OUT = 'CHECKED_OUT', // 已签退
  CANCELLED = 'CANCELLED'    // 已取消
}

// 状态流转规则
const statusFlow: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.APPROVED,
    ReservationStatus.CANCELLED
  ],
  [ReservationStatus.APPROVED]: [
    ReservationStatus.CHECKED_IN,
    ReservationStatus.CANCELLED
  ],
  [ReservationStatus.CHECKED_IN]: [
    ReservationStatus.CHECKED_OUT
  ],
  [ReservationStatus.CHECKED_OUT]: [],
  [ReservationStatus.CANCELLED]: []
}

// 状态校验
export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus
): boolean {
  return statusFlow[from].includes(to)
}
```

```vue
<!-- components/ReservationActions.vue -->
<template>
  <div class="reservation-actions">
    <el-button
      v-if="canApprove"
      type="primary"
      @click="onApprove"
    >
      审批通过
    </el-button>
    
    <el-button
      v-if="canCheckIn"
      type="success"
      @click="onCheckIn"
    >
      车辆签到
    </el-button>
    
    <el-button
      v-if="canCheckOut"
      type="warning"
      @click="onCheckOut"
    >
      车辆签退
    </el-button>
    
    <el-button
      v-if="canCancel"
      type="danger"
      @click="onCancel"
    >
      取消预约
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ReservationStatus, canTransition } from '@/types/reservation'

const props = defineProps<{
  status: ReservationStatus
}>()

const canApprove = computed(() => 
  canTransition(props.status, ReservationStatus.APPROVED)
)

const canCheckIn = computed(() => 
  canTransition(props.status, ReservationStatus.CHECKED_IN)
)

const canCheckOut = computed(() => 
  canTransition(props.status, ReservationStatus.CHECKED_OUT)
)

const canCancel = computed(() => 
  canTransition(props.status, ReservationStatus.CANCELLED)
)
</script>
```

### 5.2 权限管控

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

// main.ts
import { permission } from './directives/permission'
app.directive('permission', permission)
```

```vue
<!-- 使用 -->
<template>
  <el-button v-permission="'reservation:approve'">
    审批
  </el-button>
  
  <el-button v-permission="['reservation:checkin', 'reservation:checkout']">
    签到/签退
  </el-button>
</template>
```

---

## 六、高频面试题

### Q1: Claude Code 和 Copilot 有什么区别？

> "Copilot 是代码补全工具，Claude Code 是完整的 AI 研发环境。核心区别：1) Claude Code 支持 Skill 定制，可以约束 AI 行为符合项目规范；2) 支持 Sub-Agent 协同，可以搭建自动化工作流；3) 支持 MCP 协议，可以连接外部工具（如 lark-cli 拉需求文档）。"

### Q2: Sub-Agent 协同具体怎么实现的？

> "我们定义了两种 Sub-Agent：1) frontend-reviewer：前端代码写完后自动审查，检查类型定义、错误处理、组件使用是否符合规范；2) api-type-generator：后端接口变更后，自动解析 Java 代码生成前端 TypeScript 类型。两个 Sub-Agent 通过 Claude Code 的 Agent 协议协同工作。"

### Q3: AI 生成的代码质量怎么保证？

> "三层保障：1) Skill 约束：项目级 Skill 定义了技术栈、编码规范、审查清单，AI 必须遵守；2) Sub-Agent 校验：代码写完后自动触发审查 Agent，不通过不能提交；3) 人工兜底：关键业务逻辑人工 review，AI 只负责重复性工作。"

### Q4: 这个项目最大的技术挑战是什么？

> "最大的挑战是前后端类型同步。传统模式下，后端接口变更后前端要手动更新类型，容易遗漏。我们用 Sub-Agent 自动解析 Java 代码生成 TypeScript 类型，保证 100% 同步。这个方案后来推广到了其他项目。"

### Q5: AI 驱动的研发流程有什么局限？

> "三个局限：1) 复杂业务逻辑还是需要人工设计，AI 更适合标准化、重复性的工作；2) AI 生成的代码需要人工 review，不能完全信任；3) 对 Prompt 工程要求高，需要持续优化 Skill 和系统提示词。"

---

## 七、项目亮点总结

| 亮点 | 说明 | 面试价值 |
|------|------|----------|
| Claude Code Skill 体系 | 项目级规范约束 + 系统提示词工程 | AI 工程化能力，2026 年稀缺 |
| Sub-Agent 协同 | 前端审查 + 类型生成自动化 | 体现 AI 工作流设计能力 |
| 前后端并行开发 | Mock 先行 + 类型自动同步 | 体现效率优化思维 |
| 全栈交付能力 | Vue3 + NestJS + Spring Boot | 体现技术广度 |
| 状态机设计 | 预约状态流转 + 权限管控 | 体现业务建模能力 |
