# 项目记忆

## 项目概述
前端面试准备资料库，位于 `interview-prep/` 目录。为德德（王德师）提供系统化的高级前端面试知识体系。**本月（2026年7-8月）核心目标：冲击互联网大厂高级前端岗位。**

## 用户信息
- 称呼：德德
- 真名：王德师
- 位置：北京
- 背景：近5年前端经验，理想汽车高级前端工程师（2021.12-2026.04），主栈 Vue3+TS，兼 React
- 目标：**2026年8月前拿到北京互联网大厂高级前端 offer**
- 目标公司：字节跳动、美团、阿里巴巴、腾讯、百度等一线大厂

## 工作区结构
- `interview-prep/` - 前端面试准备材料（19份MD文档 + 6个HTML交互Demo + 3份模拟面试记录）
- `interview-prep/mock-interviews/` - 每日模拟面试归档（按日期命名）
- `client/` - 项目客户端代码
- `server/` - 项目服务端代码

## 知识库覆盖度（19份文档，全部完成）

### 基础理论（6份）
- 浏览器原理.md — 渲染管线、回流重绘、图层分层、强制同步布局、Event Loop、GC、进程线程
- 网络与HTTP.md — HTTP版本/HPACK/TLS握手/证书验证/Charles/CORS/CSP/SSO/DNS/CDN（十章完整）
- 浏览器存储与缓存.md — Cookie/localStorage/sessionStorage/IndexedDB/Service Worker
- 迭代器与生成器.md — Iterator 协议、Generator、yield 双向通信
- Promise与异步.md — 状态机/链式/手写Promise/Promise.all源码/asyncPool并发控制/Promisify
- HTML-CSS-ES6-JS基础.md — BFC/盒模型/flex/原型链/this/类型检测

### 框架原理（2份）
- Vue3深度原理.md — Proxy响应式/PatchFlags/BlockTree/Compiler优化/Composition API
- React核心机制.md — Fiber架构/Hooks原理/并发模式/与Vue对比

### 工程化（4份）
- 前端工程化.md — Webpack/Vite/HMR/TreeShaking/CI-CD+GitTag实战/组件库建设/Monorepo
- 性能优化体系.md — 网络/构建/渲染/运行时四层优化/Core Web Vitals
- 微前端专题.md — qiankun/无界/Micro-app/Module Federation对比+无界实战
- Agent工程化专题.md — MCP/Skill/Sub-Agent/AI质量保障/出入预约工作流

### 全栈+跨端+TS（3份）
- Node.js与NestJS.md — Node Event Loop/DI/装饰器/Guard/Pipe/Interceptor
- 跨端开发专题.md — Taro/双线程架构/组织信息管理双端方案
- TypeScript进阶.md — 泛型/条件类型/infer/工具类型手写/类型守卫/协变逆变

### 编码实战（4份）
- 手写代码.md — 防抖节流/深拷贝/Promise/ LR U/bind/柯里化/继承/虚拟列表
- 手撕场景题.md — 20个真实业务场景（10通用+10结合简历项目）
- 算法基础.md — 排序/树遍历/链表/DP/经典场景题
- 设计模式.md — 13种模式+前端实际应用映射

### 项目复盘（1份）
- 项目复盘与面试话术.md — Li People/理想同事/组织信息管理/出入预约 STAR 话术

## 模拟面试历史（7-8轮，按日期归档在 mock-interviews/）
- 7/29：HTTP缓存/客户端存储/SSO+CSP/计算机网络/DNS-CDN/浏览器原理（6轮，35问）
- 7/30：Promise与异步（1轮，8问+6轮深层复盘）
- 7/31：HTML/CSS/ES6/JS基础（1轮，7问）

## 德德的能力画像（基于8轮模拟）

### 强项（⭐⭐⭐⭐⭐）
- **实战代入感**：每个技术点能立刻挂接到理想汽车项目场景，SSO/微前端/CDN 都有真实案例
- **Event Loop**：三道时序题全对，三层嵌套微任务入队时序精准
- **SSO 鉴权架构**：双 Token + 独立 SDK + 请求拦截器方案完整
- **追问触类旁通**：SW 更新本质、TCP 全双工、Charles 中间人——追问问出了理解深度

### 待加强（按优先级）
1. **术语精准度** — no-store="不缓存"不是"走最新缓存"；window.open≠跳转；普通函数 this 不是"指向自己"
2. **CSP 语法 + 灰线上线** — Report-Only 模式不熟
3. **HTTP 版本对比** — 1.1 有队头阻塞（不是解决），2 解决 HTTP 层但 TCP 层仍有
4. **TS 类型体操** — infer/条件类型/工具类型手写
5. **设计模式术语** — 观察者 vs 发布订阅的区别要说清楚
6. **算法手写** — 排序/树遍历/链表需要练手感

### 大厂面试差异化优势
- **微前端实战**（无界完整闭环）— 大部分候选人说不出来
- **AI 工程化**（Claude Code + MCP + Sub-Agent）— 2026 年稀缺度极高
- **全栈能力**（NestJS + Spring Boot）— B 端公司加分项

## 约定
- 所有 interview-prep 文档使用 Markdown 格式
- Demo 使用独立 HTML 文件（可浏览器直接打开）
- 文档内容面向高级前端面试，注重原理深度
- 项目复盘内容基于用户真实经历定制
- **生成面试内容前必须联网搜索最新大厂面经**（见 ~/.workbuddy/MEMORY.md）
- 模拟面试归档到 `mock-interviews/YYYY-MM-DD.md`，按 Q&A 格式 + 评分 + 总评

## 下一步建议（8月冲刺计划）
1. **第1周**：Vue3 + React 深度模拟（每天一轮）
2. **第2周**：手撕代码 + 算法 + 设计模式（每天手写2-3题）
3. **第3周**：项目复盘打磨 + 系统设计题
4. **第4周**：全量模拟面试（综合题，模拟真实面试节奏）
5. **每周复盘**：根据模拟暴露的盲区查漏补缺

## Agent 前端面试方向（2026 大厂趋势）

基于德德搜索的大厂面经整理，五大主战场：

1. **RAG 检索增强** — 向量库/混合检索/Chunking/Rerank/Embedding 选型
2. **Agent 核心机制** — ReAct Loop/记忆/手搓vs框架/多智能体
3. **工具调用 & MCP** — Function Calling/MCP/Skill/通信协议
4. **模型选型 & 评测** — Benchmark/成本权衡/模型替换
5. **Prompt & 幻觉治理** — Prompt 工程/幻觉检测/约束重试

德德重点补的方向（已补文档）：
- RAG 全链路 → 手撕场景题.md 第二十一题
- 流式渲染工程细节 → Agent工程化深度实战.md 3.3 节
- 待补：Function Calling 深度 / AI 不确定性 UX / 会话管理上线方案
- 简历最大盲区：RAG 没有项目体现 → 建议在理想同事项目加 RAG Demo
- 手撕：交通信号灯模拟/Promise.race()
- 评价：项目实践好但经历单薄 → 德德需要把 RAG Demo 加到简历
