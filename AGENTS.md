# 定位

这是德德（王德师）的**全栈学习与面试准备**工作区，目标是拿到北京互联网大厂高级前端/全栈 offer。工作区一切以「面试准备」为最高优先级。

## 目录结构

- `interview-prep/` — **核心资产**：前端面试知识库（专题文档 + `xxx-demo.html` 交互式 Demo + `mock-interviews/YYYY-MM-DD.md` 模拟面试记录）
- `db-training/` — 数据库场景题训练（事务、锁、索引、高并发等，含 MySQL docker-compose 环境）
- `client/` — React 19 + TS + Vite + Tailwind v4 + React Router v7 + TanStack Query + Zustand 全栈脚手架（演示用途）
- `server/` — NestJS 11 后端，内存态 posts API，配合 client 演示前后端联调
- `micro-host/` + `micro-vue/` — 微前端（无界）演示工程
- `ui-kit/` — 独立仓库，已被根仓库 `.gitignore`，不要动

## 用户画像

- 称呼「德德」；近 5 年前端经验（理想汽车高级前端工程师）
- Vue3 / React 熟练，熟悉 NestJS，了解 Spring Boot
- 技能覆盖：微前端（无界）、跨端（Taro）、可视化（AntV/G6）、全栈（NestJS）、AI 工程化（Claude Code/MCP）

## 面试准备规范（最高优先级）

### 联网优先

- 生成/更新任何面试文档前，**必须先联网搜索** 2025–2026 年大厂（字节/美团/阿里/腾讯/百度）面经与最新技术趋势
- 搜索结果优先于模型内置知识；关键结论附来源链接
- 搜索不可用时明确告知德德，再基于内置知识作答

### 模拟面试方式

- 对话式模拟面试，**面试官追问风格**，以「场景题 + 追问」为主，避免纯背诵
- 术语必须精确：出现 `no-store`、`window.open` 这类术语错误直接指出并纠正
- 每轮结束后完整归档到 `interview-prep/mock-interviews/YYYY-MM-DD.md`（题目、回答、评分、追问与纠正）

### 知识库维护

- 面试暴露的盲区**立刻补进对应专题文档**，不留尾巴
- 新增专题文档后同步更新 `interview-prep/README.md` 索引
- 文档用中文，结构清晰，代码示例可运行

## 开发规范

- 脚手架是「学习演示」用途：示例优先体现主流最佳实践（TanStack Query 管服务端状态、Zustand 管客户端状态、React Router loader 预取数据），注释解释「为什么」
- 前端：函数组件 + Hooks、命名导出、显式 props 类型、UI 优先 Tailwind 工具类
- 后端：NestJS 模块化结构，接口统一 `/api` 前缀
- 用 pnpm 管理依赖，改依赖后同步提交 `pnpm-lock.yaml`

## Git 与工作流

- 改动前先读相关文件理解上下文，遵循已有 ESLint 配置
- 阶段性工作完成后及时提交，分支默认 `codex/` 前缀
