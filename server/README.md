# Server (NestJS)

基于 [NestJS](https://nestjs.com) 的后端服务。

## 快速开始

```bash
pnpm install
# server/.env 已就绪：按需修改 DEEPSEEK_API_KEY 和 MySQL 连接信息
pnpm migration:run     # 用 TypeORM migration 建表
pnpm dev       # 开发模式（热重载）
pnpm build     # 构建
pnpm start     # 生产模式启动
```

服务默认运行在 [http://localhost:3000](http://localhost:3000)。

## API 端点

- `GET /api/health` — 健康检查
- `POST /api/users` — 注册用户（重名返回 409）
- `GET /api/users/by-name/:name` — 按用户名查询用户
- `GET /api/users/:id/conversations?limit=&offset=` — 用户会话列表（分页）
- `POST /api/conversations` — 创建会话
- `GET /api/conversations/:id/messages?limit=&offset=` — 会话历史（分页）
- `POST /api/conversations/:id/messages` — 追加消息
- `POST /api/agent/chat` — DeepSeek Agent 对话（含工具调用循环）
- `POST /api/agent/chat/stream` — SSE 流式对话（开启 thinking，返回思考过程/正文/工具轨迹）
- `POST/GET/DELETE /api/mcp` — MCP Streamable HTTP 入口

## MCP

工具注册表统一维护在 `src/tools/tools.service.ts`，DeepSeek 与 MCP 共用同一份 handler。

```bash
# HTTP 方式接入 Claude Code
claude mcp add agent-demo http://localhost:3000/api/mcp

# Stdio 方式接入
pnpm mcp:stdio
claude mcp add agent-demo -- node dist/mcp/mcp-stdio.js
```

## 数据库

表结构由 TypeORM migration 管理（`pnpm migration:run` / `migration:revert`），`synchronize` 已关闭。
`sql/agent-demo-init.sql` 保留为首次建库的幂等脚本，结构与 migration 保持一致，不含种子数据。

## 前端演示

在 `../client` 中运行 `pnpm dev`，访问 `/agent`，输入用户名登录/注册后即可对话（Vite 已配置 `/api` 代理到 3000）。
对话走 SSE 流式渲染（react-markdown + remark-gfm + rehype-highlight），回答过程中会先展示折叠的思考过程，再逐字渲染 Markdown。
