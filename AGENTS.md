# vibe_coding 项目配置

> 本项目级配置叠加在全局配置（`~/AGENTS.md`）之上。全局规则继续生效，冲突时以本文件更具体的规则为准。

## 工作区定位

这是一个「**前端面试备战 + 全栈技术学习**」工作区，服务于德德（王德师）冲击北京互联网大厂高级前端岗位的目标。

### 目录结构

- `interview-prep/` — **核心资产**：前端面试知识库，包含专题文档、交互式 HTML Demo 和按日期归档的模拟面试记录（`mock-interviews/YYYY-MM-DD.md`）
- `client/` — React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router v7 + TanStack Query + Zustand 的全栈脚手架演示应用（学习/演示用途）
- `server/` — NestJS 11 后端，内存态 posts API（`/api/health`、`/api/posts` 增查），用于演示前后端联调与数据请求模式
- `docker-compose.yml` — 容器化启动方案：client 经 Nginx 暴露 80 端口，server 暴露 3000 端口

## 用户画像

- 称呼「德德」，真名王德师，坐标北京；近 5 年前端经验（理想汽车高级前端工程师 2021.12–2026.04）
- Vue3 / React 开发经验丰富，熟悉 NestJS，了解 Spring boot，有全栈开发经验
- 技能覆盖：微前端（无界）、跨端（Taro）、可视化（AntV/G6）、全栈（NestJS）、AI 工程化（Claude Code/MCP）
- 核心目标：**2026 年 8 月前拿到北京互联网大厂（字节/美团/阿里/腾讯/百度）高级前端 offer**

## 面试准备规范（本工作区最高优先级）

### 联网优先

- 生成/更新任何面试相关文档（知识点、模拟面试题、复盘）前，**必须先联网搜索**最新的大厂面试经验和技术趋势
- 搜索范围：2025–2026 年热门前端面试题、大厂（字节/美团/阿里/腾讯/百度）面经、最新技术栈变化
- 优先级：搜索结果 > 模型内置知识，避免用过时知识误导德德
- 关键结论尽量附上来源（链接或出处说明），便于回溯验证

### 模拟面试方式

- 使用对话式模拟面试，**面试官追问风格**，能引导触类旁通
- 以「场景题 + 追问」为主，避免纯背诵式提问
- 对术语精确性严格要求：出现 `no-store`、`window.open` 这类术语错误必须直接指出并纠正
- 每轮结束后将完整记录归档到 `interview-prep/mock-interviews/YYYY-MM-DD.md`，包含题目、回答、评分、追问与纠正

### 知识库维护

- 面试中暴露的盲区必须**立刻补进对应专题文档**，不留尾巴
- 新增专题文档后同步更新 `interview-prep/README.md` 的索引和分类
- 文档使用中文，结构清晰（`#` 一级标题 + 层级小节），代码示例保持可运行
- 交互式 Demo 放在 `interview-prep/` 下，命名格式 `xxx-demo.html`

## 开发规范

对 `client/`、`server/` 的修改遵循全局配置中的 React/Vue/Tailwind/Vite/TypeScript 规范，并补充：

- 脚手架是「学习演示」用途：新增示例优先体现主流最佳实践（TanStack Query 管服务端状态、Zustand 管客户端状态、React Router loader 预取数据），保留解释性注释说明「为什么」
- 前端使用函数组件 + Hooks、命名导出、显式 props 类型；UI 优先 Tailwind 工具类
- 后端遵循 NestJS 模块化结构，接口路径统一 `/api` 前缀，数据变更需考虑示例的演示价值（如模拟延迟便于观察 loading）
- 使用 pnpm 管理依赖，修改依赖后同步提交 `pnpm-lock.yaml`

## Git 与工作流

- 工作区由根仓库统一管理（含 `client/`、`server/`、`interview-prep/`）；`ui-kit/` 是独立仓库，已在根仓库 `.gitignore` 中忽略，两边互不干扰
- 代码改动前先读取相关文件理解上下文，遵循项目已有 ESLint 配置
- 完成阶段性工作后及时提交，避免工作区长期堆积未提交内容
- 创建分支时默认使用 `codex/` 前缀
