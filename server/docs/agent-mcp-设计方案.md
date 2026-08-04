# DeepSeek Agent + 会话存储 + MCP 工具 — 整体设计方案

> 项目：server（NestJS 演示功能）
> 状态：设计稿，待确认后进入开发

---

## 一、目标

在 `server/` 中实现一个可运行、可演示、可讲清楚原理的 Agent 示例，包含三个能力：

1. **DeepSeek 驱动的简单 Agent**：支持工具调用（function calling）循环；
2. **SQLite 持久化**：存储用户、会话、消息，Agent 能读写自己的"记忆"；
3. **MCP 工具**：同一套工具既能被 DeepSeek 调用，也能通过 MCP 暴露给外部 AI（Claude Code / Codex 等）调用。

核心设计：**一份工具注册表，两个消费方**——DeepSeek 走 OpenAI 工具协议，外部 AI 走 MCP JSON-RPC，底层 handler 是同一份代码。

---

## 二、技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 框架 | NestJS 11（现有脚手架） | 复习目标 |
| 数据库 | Node 内置 `node:sqlite` | Node 25 已可用，零原生依赖、零安装 |
| MCP | `@modelcontextprotocol/sdk` 1.30.0 | 官方 SDK，Streamable HTTP 传输 |
| DeepSeek | 原生 `fetch` 调 OpenAI 兼容接口 | 不引额外 SDK，代码量小、原理透明 |
| 配置 | `.env` + Node 内置 `process.loadEnvFile` | 不引 dotenv |

---

## 三、总体架构

```
┌─────────────────────────────────────────────┐
│ DatabaseModule（全局）                       │
│   SQLite 连接 + 建表（users/conversations）  │
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

## 四、数据模型（SQLite 三张表）

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
| created_at | TEXT NOT NULL | 创建时间 |

设计说明：

- 外键保证数据完整性；`conversation_id + created_at` 建索引，方便按会话拉历史；
- 工具调用轨迹（tool_calls）先不单独建表，演示阶段以返回结构展示；后续需要可加 `tool_calls` 表或 JSON 字段。

---

## 五、工具注册表（初版 5 个）

每个工具只维护一份定义：`name` / `description` / JSON Schema 参数 / `handler(args) => Promise<string>`。

| 工具 | 作用 | 输入参数 |
|------|------|----------|
| `get_user_info` | 查询用户信息 | `userId?` |
| `list_conversations` | 列出某用户的会话 | `userId` |
| `get_conversation_history` | 查询会话消息历史 | `conversationId`, `limit?` |
| `create_conversation` | 新建会话 | `userId`, `title?` |
| `add_message` | 向会话写入一条消息 | `conversationId`, `role`, `content` |

适配：

- DeepSeek 侧：转成 OpenAI `{ type: 'function', function: { name, description, parameters } }`；
- MCP 侧：转成 `registerTool(name, { description, inputSchema }, handler)`。

---

## 六、Agent 工作流（`POST /api/agent/chat`）

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

---

## 七、MCP 设计

- 传输：**Streamable HTTP**，端点 `POST / GET / DELETE /api/mcp`；
- 模式：stateful 会话（响应头带 `mcp-session-id`，服务端维护 transport 映射）；
- 工具：把 ToolsModule 的 5 个工具注册为 MCP tools，外部 AI 配置后即可调用；
- 与 DeepSeek Agent 的关系：DeepSeek 走 OpenAI 工具协议，MCP 走 JSON-RPC，但底层 handler 是同一份代码——面试可讲"协议适配层"这个设计点。

### Claude Code 接入方式（待实现后验证）

```bash
claude mcp add agent-demo http://localhost:3000/api/mcp
```

---

## 八、REST API 一览

```
GET  /api/health                        健康检查
POST /api/agent/chat                    对话（含工具循环）
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
├── database/     database.module.ts / database.service.ts
├── conversation/ conversation.module.ts / service.ts / controller.ts
├── tools/        tools.module.ts / tools.service.ts（注册表 + 5 个工具）
├── agent/        agent.module.ts / agent.service.ts / agent.controller.ts / deepseek.service.ts
├── mcp/          mcp.module.ts / mcp.service.ts / mcp.controller.ts
├── app.module.ts
└── main.ts

server/
├── .env.example
├── data/         （SQLite 文件，gitignore）
└── docs/         本设计文档
```

---

## 十、环境变量

```bash
# .env.example
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
AGENT_DB_PATH=data/agent-demo.sqlite
PORT=3000
```

---

## 十一、验证与演示

- **不依赖 DeepSeek key 也能演示**：会话 CRUD、MCP `tools/list` + `tools/call` 全部可测；
- **有 key 后**：`curl -X POST /api/agent/chat` 跑完整"AI 查历史 → 决定是否建会话/写消息"链路；
- 同时更新 `server/README.md`，写清启动步骤、curl 示例、Claude Code 接入 MCP 的配置方法。

---

## 十二、待确认决策

1. **工具集**：5 个会话工具是否够用？是否加贴近出入预约业务的模拟工具（如"查询预约单状态"）？
2. **MCP 暴露方式**：只做 HTTP（`/api/mcp`）还是再加 stdio 入口脚本，方便 Claude Code 本地直连？
3. **是否要前端**：纯 API 演示，还是后续加一个简单页面配合？
