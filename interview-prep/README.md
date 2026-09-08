# 前端面试知识体系

> 面向高级前端岗位的系统化面试准备，基于王德师（德德）的技术栈和项目经验定制。

---

## 一、基础理论

- [HTML/CSS/ES6/JS 基础](./HTML-CSS-ES6-JS基础.md) — 语义化、盒模型/BFC、垂直居中、let/const/var、闭包、this、事件循环
- [浏览器原理](./浏览器原理.md) — 渲染流程、回流重绘、Event Loop、GC、进程线程
- [网络与HTTP](./网络与HTTP.md) — HTTP版本对比、HTTPS/TLS、缓存策略、CORS、安全
- [浏览器存储与缓存](./浏览器存储与缓存.md) — Cookie/localStorage/sessionStorage/IndexedDB、缓存层级、选型
- [迭代器与生成器](./迭代器与生成器.md) — 迭代器协议、Generator、yield双向通信
- [Promise与异步](./Promise与异步.md) — 状态机、链式调用、手写Promise、async/await
- [前端基础手写场景题库](./前端基础手写场景题库.md) — 2026 大厂手写关：事件循环输出、手写Promise.all、带并发限制调度器asyncPool、for+setTimeout闭包、this指向、防抖节流(含immediate)、深拷贝(WeakMap循环引用)、React Hooks闭包陷阱，每题含答案/解析/追问/话术
- [前端进阶手写场景题库](./前端进阶手写场景题库.md) — 高级岗拔高：手写Promise状态机/微任务竞态/可取消请求/LRU、Fiber可中断渲染、useTransition vs useDeferredValue、迷你useState调度、虚拟列表、长任务与内存泄漏定位、SSE流式渲染优化，每题含答案/解析/追问/话术

## 二、框架原理

- [Vue3 深度原理](./Vue3深度原理.md) — 响应式系统(Proxy)、虚拟DOM diff、Compiler优化、Composition API、生命周期、组件通信、内置组件原理、Vue 3.5/3.6 新特性
- [Vue3 渲染机制全链路](./Vue3渲染机制全链路.md) — 依赖收集→编译优化→靶向更新三层串联：effect收集、patchFlag/block tree、组件级更新、60秒速答模板、误区纠正
- [React 核心机制](./React核心机制.md) — Fiber架构、Hooks原理、Diff与render/commit阶段、并发模式、受控/非受控组件、合成事件、性能优化、React 19新特性(Actions/use/RSC)、状态管理(Redux/Zustand)、与Vue对比
- [React面试考点地图](./React面试考点地图.md) — 大厂评判标准、七层考点地图、高频必考清单、自测清单
- [React一周速成计划](./React一周速成计划.md) — 7 天冲刺时间表：Vue→React 心智迁移、每日必读+实操 Demo+自测题、React 必考 12 题
- [React场景实战-Router与状态管理](./React场景实战-Router与状态管理.md) — 电商闭环实操：Router(URL状态/loader预取) + TanStack Query(服务端状态) + Zustand(客户端状态) + Redux(流程状态机)，含选型对比与面试话术
- [React场景题-渲染性能](./React场景题-渲染性能.md) — 大数据渲染(虚拟列表/分批/Canvas/懒加载) + 时间切片(useTransition/useDeferredValue) 两类场景题、完整方案与面试话术
- [React场景题大全](./React场景题大全.md) — 10 大类高频场景全覆盖：渲染/状态设计/表单/搜索/列表/数据请求/错误边界/路由权限/SSR/组件设计，每场景含方案与面试话术
- [React Profiler 性能定位](./React Profiler 性能定位.md) — Profiler 火焰图/Ranked/Why did this render 三个视图、self time vs total time、四步定位流程、配合 Chrome Performance
- [TanStack Query核心](./TanStackQuery核心.md) — 服务端状态管理、useQuery读/useMutation写、生命周期、invalidateQueries缓存失效、乐观更新与回滚
- [Redux核心](./Redux核心.md) — 三大原则、单向数据流、Redux Toolkit(createSlice/configureStore)、createAsyncThunk三态、thunk vs saga、Redux vs Zustand
- [Zustand与ReactRouter用法](./Zustand与ReactRouter用法.md) — Zustand状态管理与中间件(persist/immer/subscribeWithSelector/自定义)、React Router v7数据路由(loader/Outlet/useMatches/handle)

## 三、工程与性能

- [前端工程化](./前端工程化.md) — Webpack/Vite原理、HMR、TreeShaking、CI/CD、组件库建设、Monorepo
- [前端工程化-组件库实战](./前端工程化-组件库实战.md) — ui-kit 实操：组件库打包、git tag、CI/CD、npm 发布全链路（2026-08）
- [性能优化体系](./性能优化体系.md) — 网络/构建/渲染/运行时四层优化、Core Web Vitals、虚拟列表
- [前端性能监控与线上定位](./前端性能监控与线上定位.md) — 埋点平台指标观测、RUM 指标体系、Navigation/Resource Timing 拆段、iOS 偶发慢多维归因、线上排障话术
- [Docker与K8s部署](./Docker与K8s部署.md) — Docker镜像/分层/底层原理(namespace+cgroups)、Dockerfile多阶段构建、Compose编排、K8s架构与部署、CI/CD/GitOps

- [前端测试-TDD实战](./前端测试-TDD实战.md) — xDD 全家桶辨析（TDD/BDD/CDD/ATDD）、红绿重构实操（formatThousands/chunk 案例）、client/ vitest 基建、前端 TDD 适用范围与面试话术（2026-09-06）
- [前端测试-BDD与E2E](./前端测试-BDD与E2E.md) — E2E 工具演进（Selenium→Cypress→Playwright）、Cucumber 零件vs整车、playwright-bdd 三层文件模型、feature 编写规范、产物目录分工、AI 协作流、双 MCP 调试体系（Playwright MCP 操作 + Chrome DevTools MCP 诊断）、完整 AI 工作流闭环、flaky 治理（2026-09-06）
- [AI开发流程-SDD+BDD+TDD](./AI开发流程-SDD-BDD-TDD.md) — AI 时代个人开发流程话术：SDD(Spec Kit/OpenSpec)定边界、BDD(Gherkin)定验收、TDD 定正确性、BDD≠Playwright 纠偏、库存扣减贯穿案例、落地三档、高频追问 Q&A（2026-09-08）
- [SSE流式处理与AI前端](./SSE流式处理与AI前端.md) — 2026大厂新增独立考点：SSE vs WebSocket、Fetch+ReadableStream、粘包半包、断线重连+指数退避、流式Markdown增量渲染、打字机性能优化

## 四、进阶专题

- [Node.js与NestJS](./Node.js与NestJS.md) — Node 事件循环/模块系统/Stream + NestJS 基础架构、依赖注入、横切关注点、项目实战话术
- [NestJS面试考点大全](./NestJS面试考点大全.md) — 2026 大厂版：DI 原理/AOP 生命周期/ORM 选型/JWT 鉴权/微服务 gRPC/性能高并发/场景题全覆盖
- [Elasticsearch基础](./Elasticsearch基础.md) — ES是什么、倒排索引、Index/Document/Shard/Replica核心概念、ES vs MySQL选型、使用场景与高频考点
- [SQL基础语法与执行顺序](./SQL基础语法与执行顺序.md) — SQL语言地基：执行顺序8步流水线、聚合/GROUP BY/HAVING、子查询(NOT IN的NULL坑)、JOIN(ON vs WHERE)、窗口函数(ROW_NUMBER分组TopN)、踩坑清单
- [MySQL高频考点与手写SQL](./MySQL高频考点与手写SQL.md) — B+树/联合索引/回表覆盖索引、事务MVCC锁、DB自带锁vs应用层锁分层、EXPLAIN慢查询，10道手写SQL含答案
- [TypeORM使用指南](./TypeORM使用指南.md) — 以 server/ 为样例：三层注册机制(forRootAsync/forFeature/InjectRepository)、Entity装饰器、Repository API、QueryBuilder、事务、Migration工作流、常见坑
- [TypeORM读写优化与幂等方案](./TypeORM读写优化与幂等方案.md) — NestJS+TypeORM场景：读优化(索引/缓存/读写分离/N+1/深分页/筛选谓词下推)、写幂等(唯一约束/orIgnore/幂等键/乐观锁/MQ去重/下单三件套)、连接池(建连成本/容量不等式/池大小权衡)、经典场景与面试话术
- [Redis高频考点大全](./Redis高频考点大全.md) — 单线程模型与底层数据结构、持久化RDB/AOF、过期删除与内存淘汰、缓存穿透/击穿/雪崩、缓存一致性、主从/哨兵/集群、分布式锁(Redisson看门狗/RedLock)、大key热key、Redis 8新特性
- [分布式锁-Redis与DB对比](./分布式锁-Redis与DB对比.md) — DB锁(行锁/事务/唯一约束/乐观锁) vs Redis锁(SET NX EX/看门狗/RedLock)、三种实现对比、场景判断口诀、秒杀三段式组合拳
- [缓存雪崩防护与并发控制](./缓存雪崩防护与并发控制.md) — 雪崩两种场景、限流/熔断/降级本质区别、限流算法(令牌桶/漏桶/滑动窗口)、削峰vs限流(BullMQ依赖Redis的局限)、拒vs排核心洞察、Redis挂了时的防护组合
- [NestJS与Redis实战场景题](./NestJS与Redis实战场景题.md) — 基于 server/ 实战：ioredis全局模块接入、cache-aside代码走读、穿透/击穿/雪崩/一致性/分布式锁/MQ延迟兜底释放/限流/DB并发池/降级场景题含具体代码方案、全局守卫拦截MQ消费者坑、面试话术模板
- [高并发场景综合应答主轴](./高并发场景综合应答.md) — 把 NestJS+MySQL+Redis 串成一条可背的高并发主线：分层主轴(应用层复用/连接池/事务幂等、MySQL B+树索引/EXPLAIN/深分页、Redis cache-aside/一致性/穿透击穿雪崩/分布式锁)、N+1与B+树两大挂点、完整收尾话术、自测追问清单
- [MyBatis基础](./MyBatis基础.md) — MyBatis vs MySQL本质区别、半自动ORM、MyBatis vs JPA选型、#{}与${}、一级二级缓存、动态SQL
- [Java分层架构](./Java分层架构.md) — Controller/Service/Mapper分层、PO/DTO/VO/BO/Entity各种「O」的区别、完整数据流转、为什么分层
- [数据库选型与场景方案](./数据库选型与场景方案.md) — 数据库全景分类(8类)、选型决策5维度、典型架构组合(MySQL主从+Redis+ES)、面试选型话术
- [GraphQL基础](./GraphQL基础.md) — 接口层查询语言：与MySQL/SQL本质区别、schema/resolver、N+1与DataLoader、code-first vs schema-first、字段级权限、GraphQL vs REST选型、AI工程化衔接
- [微前端专题](./微前端专题.md) — 概念与价值、qiankun/无界/Micro-app/Module Federation对比、无界实战、通信/鉴权/路由方案
- [算法基础](./算法基础.md) — 排序(快排/归并)、树遍历、链表操作、动态规划入门、经典场景题
- [手写代码](./手写代码.md) — 防抖节流、深拷贝、Promise.all/并发控制、LRU、bind/call/apply、虚拟列表、柯里化、继承
- [手撕场景题](./手撕场景题.md) — 图片懒加载、搜索防抖竞态、文件分片上传/断点续传/秒传、无限滚动、虚拟列表、EventBus、状态管理、路由、WebSocket 重连、RAG 等 21 个完整实现 + 追问
- [H5移动端场景题](./H5移动端场景题.md) — 状态栏/刘海屏适配(safe-area-inset+JSBridge)、100vh陷阱与dvh/svh、软键盘(visualViewport/iOS与Android差异)、1px边框、300ms延迟与点透、滚动穿透、WebView通信

- [Agent工程化专题](./Agent工程化专题.md) — AI 驱动研发差异化优势：Agent 三能力（规划/工具调用/自我反思）、Skill/MCP/Sub-Agent 工具链、最佳实践
- [Agent工程化深度实战](./Agent工程化深度实战.md) — NestJS 从零搭生产级 Agent 后端：ReAct Loop、意图识别、文本切片、前后端交互
- [Agent-Harness 工程系列](./agent-harness/) — 基于 NestJS 的 HR Agent 运行时外壳：六大模块逐一落地（上下文管理/工具系统/执行编排/状态与记忆/评估与观测/约束与恢复），六大模块全部完成，含 FSM 交互 Demo（2026-09-08）

## 五、项目与面试

- [项目复盘与面试话术](./项目复盘与面试话术.md) — Li People/理想同事/组织信息管理/出入预约 四大项目STAR话术、系统设计题
- [React 代码实践复盘](./React代码实践复盘.md) — 通过 client 代码学习 React 核心机制（Hooks 闭包陷阱、setState、useEffect、自定义 Hook、性能优化、React 19），记录踩坑与面试话术
- [C端项目场景题 — Vue & React](./C端场景题-Vue与React.md) — 2026 大厂版：电商/搜索/购物车/秒杀/Feed/短视频/IM/地图/权限/表单/上传/SSR/AI 场景题与双框架落地点
- [携程 MJ036850 JD 拆解与冲刺](./携程-MJ036850-JD拆解.md) — 国际业务B端框架 + AI Coding 工具链岗位的考察点映射、匹配度评估与冲刺计划

---

## 交互式 Demo（浏览器打开即可运行）

### 基础 Demo
- [Event Loop 可视化](./event-loop-demo.html) — 逐步看调用栈、微任务、宏任务
- [Promise 执行流程](./promise-demo.html) — Promise 状态变化 + 队列切换
- [Generator 执行流程](./generator-demo.html) — yield 暂停和 next() 恢复
- [HTTP 缓存决策流程](./http-cache-demo.html) — 强缓存/协商缓存判断链路
- [浏览器存储对比](./storage-demo.html) — 直接操作 Cookie/localStorage/sessionStorage/IndexedDB
- [浏览器渲染流程](./render-demo.html) — 6阶段渲染管线交互图
- [Vue3 响应式可视化](./vue3-reactivity-demo.html) — Proxy 拦截、依赖收集/触发全过程

---

## 推荐学习路线

```
第1周：基础理论复习（浏览器原理 → 网络与HTTP → 存储与缓存 → 异步/Promise）
第2周：框架原理深挖（Vue3 深度原理 → React 核心机制）
第3周：工程与性能（工程化 → 性能优化 → 微前端专题）
第4周：手写 + 算法（手写代码每天2题 → 算法基础刷题）
第5周：项目复盘 + 模拟面试（四大项目STAR话术 → 系统设计 → 查漏补缺）
```
