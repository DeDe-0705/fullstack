# Agent 工程化专题

> 这是你简历最大的差异化优势——"AI 驱动研发"在 2025 年后稀缺度极高。本文系统化整理 Agent 工程化的核心概念、工具链、最佳实践，结合你在出入预约项目中的实战经验。

---

## 一、Agent 工程化的本质

### 1.1 什么是 Agent 工程？

```
传统开发：人写代码 → 人测试 → 人部署
AI 辅助：人写代码 + Copilot 补全（被动）
Agent 驱动：Agent 自主规划 + 执行 + 自检 → 人审核
```

**核心区别：** Copilot 是"你写一句我补一句"——被动补全。Agent 是"你给一个目标，它自己拆任务、调工具、执行、验证"——主动执行。

### 1.2 Agent 的三个核心能力

```
1. 规划能力（Planning）
   把"实现一个登录页"拆解为：
   → 创建路由 → 写表单组件 → 接接口 → 加表单校验 → 写单元测试

2. 工具调用（Tool Use）
   通过 MCP（Model Context Protocol）调用：
   → 读写文件 / 执行命令 / 浏览网页 / 搜索代码 / 操作浏览器

3. 自我反思（Reflection）
   执行结果不达预期 → 自动调整方案 → 重试
   "测试失败了 → 看错误信息 → 修代码 → 再跑"
```

---

## 二、Agent 工具链全景

### 2.1 主流 Agent 编码工具对比

| 工具 | 厂商 | 核心特点 | 你用过吗 |
|------|------|----------|----------|
| **Claude Code** | Anthropic | 终端原生、Skill 文件、Sub-Agent | ✅ 出入预约项目 |
| Cursor | Anysphere | IDE 集成、Composer 多文件编辑 | — |
| GitHub Copilot | GitHub/Microsoft | VS Code 集成、Workspace 模式 | — |
| Windsurf | Codeium | IDE 原生、Cascade 流程 | — |
| Devin | Cognition | 全自主软件工程师（招聘炒作多） | — |

### 2.2 你的技术栈（结合简历）

```
出入预约项目实际用到的 Agent 工程化能力：

1. Claude Code 终端
   ├── Skill 文件约束（前端 Vue3 规范、权限 SDK 接入规则）
   ├── 系统提示词（后端 JDK/Spring Boot 基线版本）
   └── Sub-Agent 协同方案

2. MCP（Model Context Protocol）
   ├── chrome-devtools-mcp  → 页面功能核验
   ├── Playwright MCP       → E2E 自动化测试
   └── 飞书 MCP             → 拉取需求文档

3. Sub-Agent 协同
   ├── 前端 Agent 生成代码 → 自动唤起测试 Agent 校验
   └── 后端接口完成 → 自动调用 Agent 同步生成前端接口代码 + TS 类型
```

---

## 三、MCP（Model Context Protocol）详解

### 3.1 MCP 是什么？

**MCP 是 Anthropic 提出的开放协议**，让 LLM 通过标准接口调用外部工具/数据源。类比 USB-C——所有外设统一接口，Agent 不用为每个工具单独写适配。

```
没有 MCP：
  Agent 想"操作浏览器" → 给某个 Agent 写专门的浏览器调用代码
  Agent 想"读飞书文档" → 又得写飞书调用代码

有了 MCP：
  所有工具遵循统一协议 → Agent 一套 API 调用所有工具
```

### 3.2 MCP 的核心抽象

```
MCP Server（服务端）        MCP Client（Agent 端）
   ├── Tools（工具）            ← 调用函数（执行操作）
   ├── Resources（资源）         ← 读取数据（如文件、文档）
   └── Prompts（提示模板）        ← 预定义的对话模板
                ↕
         JSON-RPC 2.0 协议
```

### 3.3 常用 MCP Server

| MCP Server | 作用 | 你的项目场景 |
|-----------|------|--------------|
| **chrome-devtools-mcp** | 控制浏览器、截图、查 Network | 出入预约页面核验 |
| **Playwright MCP** | E2E 测试、表单填写、点击 | 自动化流程测试 |
| **filesystem** | 读写文件 | Agent 操作项目代码 |
| **fetch** | 拉取网页 | 搜索文档、查 API |
| **github** | 操作 PR、Issue | 代码评审、合并 |
| **飞书 MCP** | 拉文档、发消息 | 拉取需求文档 |

### 3.4 配置 MCP Server

```json
// ~/.workbuddy/mcp.json（你的 WorkBuddy 配置文件）
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["@anthropic/chrome-devtools-mcp"]
    },
    "feishu": {
      "command": "npx",
      "args": ["@feishu/mcp-server"],
      "env": {
        "FEISHU_APP_ID": "cli_xxx",
        "FEISHU_APP_SECRET": "xxx"
      }
    }
  }
}
```

---

## 四、Skill 文件 — Agent 的"工作手册"

### 4.1 Skill 是什么？

**Skill 是给 Agent 的标准化工作流文档**，告诉 Agent "在做某类任务时必须遵守这些规则"。

类比：你给新员工的《前端开发规范手册》——但读者是 Agent。

### 4.2 Skill 文件结构

```markdown
---
name: vue3-component-spec
description: Vue3 组件开发规范 - 用于创建业务组件
---

# Vue3 组件开发规范

## 命名规则
- 组件文件名：PascalCase（UserCard.vue）
- 组件名：UserCard（注册时用 kebab-case：<user-card>）

## 必须遵守
1. 使用 <script setup lang="ts">
2. Props 用 defineProps<{...}>() 类型化
3. 事件用 defineEmits<{...}>()
4. 样式用 scoped + BEM
5. 公共逻辑抽 composable

## 反例（不要这样写）
❌ Options API
❌ mixins（用 composables 代替）
❌ v-html（除非内容可信）
```

### 4.3 你在出入预约项目中的 Skill 配置

```
你给 Claude Code 配置的 Skill：

skill: vue3-business-component
  → 约束 Vue3 组件写法（script setup / defineProps / scoped）

skill: nestjs-module-spec
  → 约束 NestJS 模块写法（Controller/Service/Module 分层）

skill: auth-sdk-integration
  → 约束鉴权 SDK 接入规则（拦截器、Token 刷新流程）
```

---

## 五、Sub-Agent 协同方案

### 5.1 为什么要多 Agent 协同？

单个 Agent 上下文有限，做复杂任务容易跑偏。把任务拆给多个专职 Agent：

```
任务：实现一个登录页

传统单 Agent：
  一个 Agent 从头写到尾 → 上下文超载 → 后半段质量下降

Sub-Agent 协同：
  主 Agent → 拆任务
    ├── 前端 Agent → 写 Vue 组件
    ├── 测试 Agent → 写 Vitest 测试用例
    └── 后端 Agent → 写 NestJS 接口
  主 Agent → 整合、审核、修 bug
```

### 5.2 你在出入预约中的协同方案

```
你的实际配置：

1. 前端代码生成 Agent
   ├── 输入：需求文档（飞书 MCP 拉取）+ Vue3 Skill
   ├── 输出：组件代码
   └── 完成后 → 自动唤起测试 Agent

2. 测试 Agent
   ├── 输入：前端 Agent 生成的代码
   ├── 工具：Vitest + chrome-devtools-mcp
   ├── 任务：跑单元测试 + 浏览器核验
   └── 失败 → 反馈给前端 Agent 修

3. 后端接口 Agent
   ├── 输入：OpenAPI 文档 / Swagger
   ├── 任务：生成 NestJS Controller/Service/DTO
   └── 完成后 → 自动调用前端 Agent 同步生成接口代码 + TS 类型
```

### 5.3 Sub-Agent 协同的关键设计

```
✅ 单一职责：每个 Agent 只做一件事
✅ 输入输出契约：用 OpenAPI / TS 类型定义接口
✅ 失败回滚：测试 Agent 失败 → 触发前端 Agent 修
✅ 主 Agent 审核：最后由主 Agent 整合、修 bug、决策
❌ 避免 Agent 互相调用形成环 → 死循环
```

---

## 六、AI 编码的质量保障

### 6.1 三层质量门禁

```
1. 输入层 — Skill 文件约束
   ├── 技术栈基线（Vue3 + TS + NestJS）
   ├── 代码风格（命名、目录结构）
   └── 禁止事项（不用 any、不用 mixins）

2. 执行层 — Sub-Agent 自检
   ├── 类型检查：tsc --noEmit
   ├── 单元测试：Vitest
   └── Lint：ESLint + Prettier

3. 验证层 — MCP 工具核验
   ├── chrome-devtools-mcp：浏览器实际跑一遍
   └── Playwright MCP：E2E 流程覆盖
```

### 6.2 测试自动化的实战配置

```yaml
# .github/workflows/ai-test.yml
name: AI-Generated Code Test

on: [pull_request]

jobs:
  ai-test:
    runs-on: ubuntu-latest
    steps:
      # 1. 单元测试
      - run: pnpm test
      
      # 2. 类型检查
      - run: pnpm typecheck
      
      # 3. E2E 测试（Playwright MCP）
      - name: E2E Test
        run: |
          npx playwright test
          # 失败截图自动上传到 PR comment
      
      # 4. 浏览器核验（chrome-devtools-mcp）
      - name: Browser Verify
        run: |
          # 启动 dev server
          pnpm dev &
          # 用 chrome-devtools-mcp 自动截图 + 检查 console error
          npx @anthropic/chrome-devtools-mcp verify
```

---

## 七、AI 驱动研发的工作流（结合出入预约）

### 7.1 你的实际工作流

```
1. 拉需求（飞书 MCP）
   Agent 通过飞书 MCP 拉取需求文档
   → 解析为结构化任务列表

2. 规划任务（主 Agent）
   → 拆分为前端任务、后端任务、测试任务
   → 分配给 Sub-Agent

3. 后端先行
   后端 Agent 用 NestJS Skill 约束 → 生成 Controller/Service/DTO
   → 完成后自动调 OpenAPI 生成接口文档

4. 前端跟进
   前端 Agent 读取 OpenAPI → 自动生成 TS 类型 + API 调用函数
   → 用 Vue3 Skill 约束 → 生成组件代码

5. 测试核验
   测试 Agent 跑 Vitest + Playwright E2E
   → 失败反馈给前端 Agent 修

6. 人工审核
   主 Agent 整合 → 我审核 PR → 合并部署
```

### 7.2 面试话术模板

> "在出入预约项目中，我是项目 Owner，采用 AI 驱动的研发模式。基于 Claude Code 搭建研发环境：通过 Skill 文件约束前端 Vue3 和后端 NestJS 的接入规范；通过系统提示词锁定 Spring Boot 基线版本。搭建了 Sub-Agent 协同方案——前端代码生成后自动唤起测试 Agent 用 Vitest + chrome-devtools-mcp 核验；后端接口完成后自动调 Agent 同步生成前端接口代码和 TS 类型。我自己聚焦在环境配置、部署和投产质量把控上，最后做人工审核。结果是出入预约业务流程高效落地，包括预约单管理、状态流转、车辆签到签退完整链路。"

---

## 八、Agent 工程化的常见坑

### 8.1 输入层

| 坑 | 现象 | 解决 |
|----|------|------|
| Skill 太模糊 | Agent 自由发挥，代码风格不一致 | 用具体示例 + 反例 |
| 没限定技术栈 | Agent 用了你不熟的库 | Skill 里明确"只用 Vue3 + Pinia，不用 Redux" |
| 上下文超载 | 长任务后半段质量下降 | 拆 Sub-Agent，每个 Agent 任务短 |

### 8.2 执行层

| 坑 | 现象 | 解决 |
|----|------|------|
| Agent 幻觉 | 引用了不存在的 npm 包 | 加 verification 步骤，跑 npm install 验证 |
| 循环调用 | Agent A 调 Agent B，B 又调 A | 严格单向调用，主 Agent 仲裁 |
| 测试通过但功能错 | 测试用例本身错 | 关键路径必须人工 review |

### 8.3 输出层

| 坑 | 现象 | 解决 |
|----|------|------|
| 生成代码不接 PR | Agent 直接改 main | 强制 PR 流程，禁止直推 |
| 没记录 Agent 决策 | 出问题不知道 Agent 怎么想的 | 让 Agent 输出"思考过程"日志 |

---

## 九、Agent 工程化的未来趋势

### 9.1 你应该关注的几个方向

```
1. Agentic Workflow（智能体工作流）
   多个 Agent 通过 DAG（有向无环图）编排
   → 类似 Airflow，但节点是 Agent

2. Self-Healing Code（自愈代码）
   生产环境报错 → Agent 自动定位 → 修复 → 提 PR
   类似 Sentry + AI 自动修复

3. Agent OS（Agent 操作系统）
   多 Agent 协同的调度、权限、资源管理
   → 类似 K8s 之于容器，未来会有 Agent 编排系统

4. Vibe Coding（氛围编程）
   用自然语言描述需求，Agent 端到端实现
   → 已在 Claude Code、Cursor、Windsurf 落地
```

### 9.2 面试中可以展示的前瞻性

```
"我认为 Agent 工程化在前端的未来有三个方向：
1. 前端组件库自动生成 — Agent 读设计稿自动产出 Vue/React 组件
2. 测试用例自动生成 — Agent 读源码自动写 E2E 测试
3. 性能优化自动化 — Agent 读 Performance 报告自动定位瓶颈并修复

这三个方向我都开始尝试了，特别是第二个，已经在出入预约项目里用 Playwright MCP 落地。"
```

---

## 十、面试速查

| 问题 | 要点 |
|------|------|
| Agent 和 Copilot 区别？ | Copilot 被动补全；Agent 主动规划+执行+反思 |
| MCP 是什么？ | Anthropic 提的开放协议，让 LLM 通过统一接口调外部工具 |
| Skill 文件作用？ | 给 Agent 的标准化工作流约束文档，类比员工手册 |
| Sub-Agent 怎么协同？ | 单一职责 + 输入输出契约 + 失败回滚 + 主 Agent 仲裁 |
| AI 编码质量怎么保证？ | 三层门禁：Skill 约束 → Sub-Agent 自检 → MCP 工具核验 |
| 你项目中实际怎么用？ | 飞书拉需求 → 后端先行 → 前端跟进 → 测试核验 → 人工审核 |
| Agent 工程化的坑？ | Skill 模糊、幻觉、循环调用、不接 PR |
| 未来趋势？ | Agentic Workflow、自愈代码、Agent OS、Vibe Coding |
