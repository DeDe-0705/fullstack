# DeepSeek Agent + 会话存储 + MCP 工具 — 整体设计方案

> 项目：server（NestJS 演示功能）
> 状态：已按生产化标准实现（migration、DTO 校验、分页、显式用户注册）

---

## 一、目标

在 `server/` 中实现一个可运行、可演示、可讲清楚原理的 Agent 示例，包含三个能力：

1. **DeepSeek 驱动的简单 Agent**：支持工具调用（function calling）循环；
2. **MySQL 持久化**：存储用户、会话、消息，Agent 能读写自己的"记忆"；
3. **MCP 工具**：同时提供 HTTP 与 Stdio 两个入口，暴露给外部 AI（Claude Code / Codex 等）调用；
4. **React 前端**：在 client 中新增对话演示页，复习 React + TanStack Query + Zustand。

核心设计：**一份工具注册表，两个消费方**——DeepSeek 走 OpenAI 工具协议，外部 AI 走 MCP JSON-RPC，底层 handler 是同一份代码。

---

## 二、技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 框架 | NestJS 11（现有脚手架） | 复习目标 |
| 数据库 | MySQL 8.0（InnoDB + utf8mb4） | 表结构与初始化脚本见 `server/sql/agent-demo-init.sql` |
| ORM | TypeORM + mysql2 | NestJS 官方集成度高，适合复习模块化 |
| MCP | `@modelcontextprotocol/sdk` 1.30.0 | 官方 SDK，Streamable HTTP 传输 |
| DeepSeek | 原生 `fetch` 调 OpenAI 兼容接口 | 不引额外 SDK，代码量小、原理透明 |
| 配置 | `.env` + Node 内置 `process.loadEnvFile` | 不引 dotenv |
| 前端 | React 19 + TanStack Query + Zustand + React Router | client 现有脚手架 |

---

## 三、总体架构

```
┌─────────────────────────────────────────────┐
│ DatabaseModule（全局）                       │
│   MySQL 连接 + migration（users/…）          │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│ ConversationModule                          │
│   用户/会话/消息 CRUD + REST（/api/…）       │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│ ToolsModule（工具注册表）                    │
│   name / description / parameters / handler │
└──────┬──────────────────────┬───────────────┘
       ▼                      ▼
┌──────────────┐      ┌──────────────────┐
│ AgentModule  │      │ McpModule        │
│ DeepSeek 调用 │      │ MCP Server       │
│ + 工具循环    │      │ /api/mcp         │
│ /api/agent   │      │ 供外部 AI 调用    │
└──────────────┘      └──────────────────┘
```

依赖方向：上层模块只依赖下层，Tools 不反向依赖 Agent / MCP。

---

## 四、数据模型（MySQL 三张表）

### users

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK AUTOINCREMENT | 用户 ID |
| name | TEXT UNIQUE NOT NULL | 用户名 |
| created_at | TEXT NOT NULL | 创建时间 |

### conversations

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK AUTOINCREMENT | 会话 ID |
| user_id | INTEGER NOT NULL → users.id | 所属用户（外键） |
| title | TEXT NOT NULL DEFAULT '新对话' | 会话标题 |
| created_at | TEXT NOT NULL | 创建时间 |
| updated_at | TEXT NOT NULL | 更新时间 |

### messages

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK AUTOINCREMENT | 消息 ID |
| conversation_id | INTEGER NOT NULL → conversations.id | 所属会话（外键） |
| role | TEXT NOT NULL | user / assistant / tool / system |
| content | TEXT NOT NULL | 消息内容 |
| reasoning | TEXT NULL | assistant 思考过程（thinking 模式），普通消息为空 |
| created_at | TEXT NOT NULL | 创建时间 |

设计说明：

- 表结构由 TypeORM migration 管理（`server/src/database/migrations/`），`synchronize` 关闭；
- `server/sql/agent-demo-init.sql` 是幂等的首次建库脚本，与 migration 结构一致，不含种子数据；
- 消息按 `id` 排序拉取历史（自增 id 单调递增，比 created_at 更稳定），索引为 `(conversation_id, id)`；
- 删除会话时 `ON DELETE CASCADE` 级联清理消息，避免孤儿数据；
- 会话列表与消息历史接口均支持 `limit/offset` 分页；
- 工具调用轨迹（tool_calls）当前以接口返回结构透出，后续需要可落库为 `tool_calls` 表或 JSON 字段。

---

## 五、工具注册表（1 个）

每个工具只维护一份定义：`name` / `description` / JSON Schema 参数 / `handler(args) => Promise<string>`。

| 工具 | 作用 | 输入参数 |
|------|------|----------|
| `get_user_info` | 查询用户信息 | `userId?` |

适配：

- DeepSeek 侧：转成 OpenAI `{ type: 'function', function: { name, description, parameters } }`；
- MCP 侧：转成 `registerTool(name, { description, inputSchema }, handler)`。
- 参数用 zod 定义，MCP 侧直接校验，DeepSeek 侧用 `zod-to-json-schema` 转 JSON Schema，保持单一来源。

---

## 六、Agent 工作流（`POST /api/agent/chat` + `POST /api/agent/chat/stream`）

```
收到 { userId?, conversationId?, message }
   │
   ├─ 1. 保存用户消息到 messages
   ├─ 2. 加载该会话历史（最近 N 条）
   ├─ 3. 组装 messages + system prompt + tools → 调 DeepSeek
   ├─ 4. 响应里有 tool_calls？
   │      ├─ 是：逐个执行注册表 handler → 结果以 role=tool 回填 → 回到第 3 步（最多 5 轮）
   │      └─ 否：拿到最终回复
   ├─ 5. 保存 assistant 消息
   └─ 6. 返回 { reply, toolCalls: [...] }
```

细节：

- system prompt 示例：告诉模型"你能查询/维护会话数据，工具名和参数要严格按 schema"；
- 无 `DEEPSEEK_API_KEY` 时接口返回明确的 401 提示，不静默失败；
- 工具执行结果统一返回 JSON 字符串，避免类型歧义；
- 返回 `toolCalls` 轨迹，便于前端展示和面试讲解。

### 流式对话（`POST /api/agent/chat/stream`）

前端对话页走 SSE 流式通道，请求体与 `chat` 一致，响应为 `text/event-stream`，事件序列：

```
event: ready      data: { conversationId }        # 会话就绪（可能自动新建）
event: reasoning  data: { delta }                 # 思考过程增量
event: content    data: { delta }                 # 正式回答增量
event: tool       data: { name, arguments, result } # 每次工具调用及结果
event: usage      data: { prompt_tokens, completion_tokens, total_tokens, ... }
event: done       data: { conversationId, toolCalls, assistantMessage }
event: error      data: { message }               # 中途异常
```

要点：

- DeepSeek 请求开启 `thinking: { type: 'enabled' }`，并传 `reasoning_effort`（默认 high，可用 `DEEPSEEK_REASONING_EFFORT` 调整）；模型会先输出 `reasoning_content` 再输出正文；
- `reasoning` 增量会累积并随 assistant 消息一起落库（`messages.reasoning`），历史接口返回后前端仍可折叠展示思考过程；
- 工具调用回合的 `reasoning`/`content` 增量照常透传，`tool_calls` 在流结束时按 `index` 合并成完整调用；
- 客户端断开时服务端中止上游请求，并会把已生成的部分内容落库，避免上下文丢失；
- 前端用 `react-markdown`（+ `remark-gfm` + `rehype-highlight`）渲染流式 Markdown，思考过程折叠展示；
- 非流式 `POST /api/agent/chat` 保留，便于调试与无前端场景复用。

### DeepSeek 类型与用量

- 完整 request/response 类型集中在 `src/agent/deepseek.types.ts`，与官方文档字段一一对应（messages、thinking、tools、usage、logprobs 等），方便后续做前端展示或用量统计；
- 请求开启 `stream_options.include_usage`，流式结束前会多一个 `usage` 事件；工具循环多轮用量由 AgentService 聚合后放进 `done` 事件；
- 非流式接口返回体同样带 `usage` 字段。

---

## 七、MCP 设计

- 传输一：**Streamable HTTP**，端点 `POST / GET / DELETE /api/mcp`；
- 模式：stateful 会话（响应头带 `mcp-session-id`，服务端维护 transport 映射）；
- 传输二：**Stdio**，入口脚本 `pnpm mcp:stdio`（`src/mcp/mcp-stdio.ts`），供 Claude Code 本地直接启动；
- 工具：把 ToolsModule 的 `get_user_info` 注册为 MCP tool；
- 与 DeepSeek Agent 的关系：DeepSeek 走 OpenAI 工具协议，MCP 走 JSON-RPC，但底层 handler 是同一份代码——面试可讲"协议适配层"这个设计点。

### Claude Code 接入方式（待实现后验证）

```bash
claude mcp add agent-demo http://localhost:3000/api/mcp
# 或本地 stdio 方式
claude mcp add agent-demo -- node dist/mcp/mcp-stdio.js
```

---

## 八、REST API 一览

```
GET  /api/health                        健康检查
POST /api/agent/chat                    对话（含工具循环）
POST /api/agent/chat/stream             SSE 流式对话（thinking + 工具轨迹）
POST /api/users                         创建用户（演示用，默认 demo）
GET  /api/users/:id/conversations       用户会话列表
POST /api/conversations                 创建会话
GET  /api/conversations/:id/messages    会话历史
POST /api/conversations/:id/messages    追加消息
```

统一 `/api` 前缀，符合工作区规范。

---

## 九、目录结构

```
server/src/
├── database/     database.module.ts + entities（user/conversation/message）
├── conversation/ conversation.module.ts / service.ts / controller.ts
├── tools/        tools.module.ts / tools.service.ts（注册表 + get_user_info）
├── agent/        agent.module.ts / agent.service.ts / agent.controller.ts / deepseek.service.ts
├── mcp/          mcp.module.ts / mcp.service.ts / mcp.controller.ts / mcp-stdio.ts
├── app.module.ts
└── main.ts

server/
├── .env               数据库/DeepSeek 连接配置（已被 gitignore）
├── sql/          数据库初始化脚本（agent-demo-init.sql）
└── docs/         本设计文档

client/src/
├── lib/agent.ts           Agent API 类型与 queryOptions
├── stores/agent.ts        当前用户/会话（客户端 UI 状态）
├── pages/AgentChat.tsx     对话演示页
├── router/index.tsx        新增 /agent 路由
└── components/Layout.tsx   导航入口
```

---

## 十、环境变量

```bash
# server/.env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_REASONING_EFFORT=high
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=agent_demo
PORT=3000
```

---

## 十一、验证

- **不依赖 DeepSeek key 也能验证**：用户注册/查询、会话 CRUD、MCP `tools/list` + `tools/call` 全部可测；
- **有 key 后**：`curl -X POST /api/agent/chat` 跑完整"AI 查历史 → 决定是否建会话/写消息"链路；
- `server/README.md` 已写清启动步骤、Claude Code 接入 MCP 的配置方法。

---

## 十二、已确认决策

1. 数据库访问使用 **TypeORM + mysql2**；
2. MCP 同时提供 **HTTP（/api/mcp）与 Stdio** 两个入口；
3. MCP/Agent 工具只保留 **get_user_info** 一个；
4. 需要前端，在 **client 新增 React 对话演示页**。
5. DeepSeek 调用开启 **thinking + reasoning_effort**，对话页走 **SSE 流式**，Markdown 用 **react-markdown** 渲染。
