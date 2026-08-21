# C 端项目场景题 — Vue & React（2026 大厂版）

> 2026 年大厂前端面试几乎不再只考八股：面试官更看重「业务落地能力 + 工程化思维」，场景题占比大幅提升。本专题按 C 端主流业务场景整理，每题给出「考察点 → 答题框架 → Vue / React 落地点 → 追问」。

---

## 0. 答题总原则

1. **先复述场景、确认边界**：用户量级、数据量、设备、网络环境、可接受的延迟——先问清楚再给方案。
2. **分层给方案**：网络层 / 渲染层 / 状态层 / 交互层，避免只堆名词。
3. **每个方案讲「为什么」和「代价」**：比如用虚拟滚动是为了减少 DOM 数量，代价是滚动定位和不定高处理更复杂。
4. **用项目经历收尾**：有真实经验就讲真实取舍；没有就讲「如果我来做」，不要编造上线数据。

---

## 1. 电商首页 / 商品列表

**场景：** 移动端首页包含 Banner、分类、商品推荐流，图片多、弱网环境多，要求首屏快、滚动顺滑。

**考察点：** 首屏性能、图片优化、缓存、骨架屏、渲染策略。

**答题框架：**
- 网络层：CDN + WebP/AVIF + 压缩 + HTTP 缓存 + `preconnect`/`dns-prefetch`
- 渲染层：骨架屏 + 路由级分包 + 图片懒加载 + 无限滚动 / 虚拟滚动
- 数据层：接口聚合（BFF）、分页 / 游标、缓存策略（SWR / stale-while-revalidate）
- 体验层：弱网降级（低清图、离线提示）、LCP 元素优先加载

**Vue 落地点：** `defineAsyncComponent` + `Suspense` 做异步组件；`keep-alive` 缓存列表和滚动位置；大列表用 `shallowRef` 降低深响应式开销。

**React 落地点：** `React.lazy` + `Suspense`；TanStack Query 管理服务端状态和缓存；`useDeferredValue` 处理搜索等高频输入；`React.memo` 控制子组件渲染。

**追问：** 一次性渲染 10 万条怎么办？弱网怎么降级？如何统计并优化 LCP？

---

## 2. 搜索 / 联想词

**场景：** 用户输入关键字实时联想，要求不卡顿、不出现旧结果覆盖新结果。

**考察点：** 防抖、请求竞态、缓存、高亮。

**答题框架：**
- 防抖 300ms 减少请求
- `AbortController` 取消在途请求，或请求序号保证最后一次胜出
- 内存 LRU 缓存历史联想结果
- 结果高亮用「解析 + 分段渲染」，避免危险 `v-html` / `dangerouslySetInnerHTML`

**Vue 落地点：** `watch` + 防抖 + `onWatcherCleanup`（Vue 3.5+）取消上一次请求；高亮逻辑放 `computed`。

**React 落地点：** `useDeferredValue` 降低输入卡顿；自定义 `useDebounce` + `useEffect` cleanup 取消请求。

**追问：** 用户快速输入「vue」最终结果怎么保证？缓存要不要持久化？空结果页怎么设计？

---

## 3. 购物车 / 下单

**场景：** 多端同步购物车、本地乐观更新、防重复下单。

**考察点：** 状态管理选型、乐观更新、幂等、持久化。

**答题框架：**
- 状态放 Pinia / Zustand / Redux Toolkit，用 persist 插件持久化到 localStorage
- 本地先改 UI（乐观更新），请求失败回滚
- 下单接口带幂等键（前端生成 requestId），防止重复点击 / 重试造成重复订单
- 多端同步：服务端购物车为准，前端只做缓存加速

**Vue 落地点：** Pinia + `storeToRefs`；`defineModel` 做组件双向绑定；`watch` 做本地持久化。

**React 落地点：** Zustand selector 避免多余渲染；TanStack Query `useMutation` 的 `onMutate`/`onError` 做乐观更新与回滚。

**追问：** 多 Tab 同时改购物车怎么同步？库存不足怎么处理？下单接口超时是重试还是提示？

---

## 4. 秒杀 / 活动页

**场景：** 高并发秒杀，前端需要处理倒计时、按钮状态、结果查询、降级。

**考察点：** 前端对并发的正确认知、降级体验、异步结果。

**答题框架：**
- 倒计时用服务端时间校准，避免用户改本地时间
- 抢购按钮防重复：点击后置灰 + 本地限频（如 3s 内只发一次）
- 提交后轮询 / 长连接查询结果，而不是同步等接口
- 前端不能真正扛并发，重点是体验兜底：排队提示、降级页、失败重试

**Vue / React 通用：** 倒计时用 `setInterval` + 组件卸载清理；请求用请求序号防竞态；状态机管理「未开始 → 可抢 → 抢购中 → 成功 / 失败」。

**追问：** 用户提前进入页面怎么办？中奖结果异步返回怎么设计？如何避免重复提交？

---

## 5. Feed 流 / 长列表

**场景：** 首页信息流无限滚动，包含图文 / 视频 / 广告位，需要位置恢复和流畅滚动。

**考察点：** 虚拟滚动、无限滚动、滚动锚定、图片懒加载。

**答题框架：**
- 分页 / 游标加载 + 无限滚动
- 固定高度用简单虚拟列表；不定高需要动态测量 + 高度缓存
- overscan 预渲染缓冲区域，避免快速滚动白屏
- 离开页面记录 `scrollTop`，回来恢复；`keep-alive` 或状态外置
- 广告位按位置插入，不能影响数据分页

**Vue 落地点：** `shallowRef` 存大数组；`v-memo` 减少重复渲染；`onActivated` 恢复滚动位置。

**React 落地点：** TanStack Virtual / react-window；`useLayoutEffect` 处理滚动恢复；`React.memo` 隔离广告位等复杂子组件。

**追问：** 不定高列表怎么测量和缓存？快速滚动怎么防白屏？回到顶部 / 恢复上次位置怎么做？

---

## 6. 短视频 / 直播

**场景：** 上下滑视频流，要求顺滑、省流量、不内存泄漏。

**考察点：** 播放器生命周期、预加载策略、内存管理、弹幕。

**答题框架：**
- 只播放可视区视频，上下各预加载一个
- `IntersectionObserver` 判断进出可视区；离开暂停并释放
- 离屏后清空 `src` / 暂停解码，避免内存持续上涨
- 弹幕用 Canvas 或合成层，避免大量 DOM
- 弱网自动切换清晰度；首帧优化（封面图 + 预加载）

**Vue 落地点：** 播放器实例用 `shallowRef` + `markRaw`，避免被响应式代理；`onDeactivated`/`onUnmounted` 暂停并销毁。

**React 落地点：** 播放器实例放 `useRef`；当前播放索引提升到列表状态，子组件受控；卸载时 `useEffect` cleanup 销毁。

**追问：** 内存泄漏怎么定位？首帧黑屏怎么优化？自动播放被浏览器拦截怎么办？

---

## 7. IM 聊天

**场景：** 实时聊天，需要处理断线重连、消息顺序、长聊天记录、未读数。

**考察点：** WebSocket 生命周期、消息幂等、虚拟列表、离线能力。

**答题框架：**
- WebSocket + 心跳（ping/pong）+ 指数退避重连
- 消息用 `msgId` 去重，乱序时先本地排序 / 等前一条补齐
- 发送消息先入本地队列，失败重试，不阻塞 UI
- 长记录用虚拟列表 + 滚动锚定（向上加载保持阅读位置）
- 离线消息用 IndexedDB 缓存，重连后补偿

**Vue 落地点：** 消息列表用 `ref` + 局部更新；`nextTick` 后滚动到底部；连接逻辑封装 composable。

**React 落地点：** 消息状态用 `useReducer` 或 Zustand；连接和订阅放 `useEffect`，卸载时关闭；滚动用 `useLayoutEffect`。

**追问：** 断线期间发的消息怎么处理？重连后消息补偿怎么避免重复？图片 / 语音消息上传失败怎么重试？

---

## 8. 地图 / LBS

**场景：** 地图展示大量标记点，需要与 Vue / React 生命周期正确集成。

**考察点：** 第三方实例管理、标记点聚合、避免框架频繁重渲染。

**答题框架：**
- 地图实例放非响应式容器：Vue 用 `shallowRef` + `markRaw`，React 用 `useRef`
- 初始化放 `onMounted` / `useEffect`，销毁放 `onUnmounted` / cleanup
- 大量标记点用聚合 + 按视野范围渲染，拖拽 / 缩放节流
- 地图回调更新业务状态时用 ref 缓存，避免每次都触发框架更新

**Vue / React 通用：** 地图 SDK 的回调里不要直接修改大量响应式数据；标记点复用池优于销毁重建。

**追问：** 1 万个标记点怎么优化？拖拽地图导致列表频繁刷新怎么解决？SSR 下怎么避免访问 window？

---

## 9. 登录 / 权限

**场景：** token 过期自动刷新、路由守卫、按钮级权限、多 Tab 登录态同步。

**考察点：** 请求拦截、并发刷新、路由守卫、权限渲染。

**答题框架：**
- 请求层拦截 401，用 refresh token 刷新；并发多个 401 时只发一次刷新请求，其余排队
- 刷新也失败 → 清空登录态跳登录页
- 路由守卫：Vue Router `beforeEach`；React Router loader / 高阶组件 / 路由包装组件
- 按钮权限：Vue 自定义指令 `v-permission`；React 封装 `<Permission>` 组件
- 多 Tab 用 `storage` 事件或 `BroadcastChannel` 同步登出

**追问：** 并发多个 401 怎么只刷新一次？refresh token 也过期怎么办？权限数据放内存还是持久化？

---

## 10. 复杂表单

**场景：** 长表单、动态表单项、校验、草稿保存、离开提醒。

**考察点：** 受控 / 非受控、表单性能、校验库、状态恢复。

**答题框架：**
- 长表单按分区渲染，避免所有字段一次全渲染
- 校验用 VeeValidate / React Hook Form + Zod，schema 驱动
- 草稿防抖存 localStorage，恢复时合并
- 离开页面用 `beforeunload` / 路由守卫提醒

**Vue 落地点：** `v-model` + `computed` 派生；动态表单项用 component 渲染。

**React 落地点：** React Hook Form 非受控 + ref 减少重渲染；受控场景注意输入框卡顿。

**追问：** 1000 个字段怎么保证输入不卡？动态增删表单项状态怎么管理？草稿和提交后数据冲突怎么办？

---

## 11. 文件上传

**场景：** 上传 1GB 大文件，网络差经常中断，需要秒传和断点续传。

**考察点：** 分片、并发控制、hash 计算、进度、服务端合并。

**答题框架：**
- 文件切片（如 5MB/片）+ 并发限制（3~5 个）
- Web Worker 计算文件 hash（MD5 / xxhash）实现秒传校验
- 已上传分片记录在 localStorage / IndexedDB，断点续传跳过
- 上传进度聚合展示；失败分片单独重试
- 服务端合并：按分片序号校验完整性

**追问：** hash 计算太慢怎么优化？服务端怎么保证分片顺序？并发设几个合适？

---

## 12. SSR / SEO / 首屏

**场景：** C 端内容站 / 电商详情需要 SEO 和首屏速度，纯 CSR 不够。

**考察点：** Nuxt / Next.js 选型、SSR/SSG/ISR、hydration、数据预取。

**答题框架：**
- 内容更新不频繁用 SSG/ISR；强交互后台用 CSR；需要 SEO + 实时数据用 SSR
- 数据预取放服务端（Nuxt `useAsyncData` / Next RSC），避免客户端二次请求
- 防止 hydration mismatch：服务端和客户端渲染结果一致，时间 / 随机值注意
- 流式渲染（Streaming）提升首字节体验

**Vue 落地点：** Nuxt 3/4、`useAsyncData`、`Suspense`。

**React 落地点：** Next.js App Router、RSC、`next/dynamic`、Streaming。

**追问：** 为什么不用纯 CSR？水合不一致怎么排查？数据请求应该放服务端还是客户端？

---

## 13. AI 场景（2026 新增高频）

**场景：** AI 对话流式输出、打字机效果、超长 Markdown（公式 / 代码块）、思考过程折叠、取消生成。

**考察点：** 流式解析、增量渲染、长内容虚拟化、动态高度缓存。

**答题框架：**
- SSE / fetch stream 逐段解析，边收边渲染
- 打字机效果用节流 + 增量追加，避免每次全量 setState
- 超长 Markdown 用虚拟列表 + 动态高度缓存 + 防抖测量
- 代码高亮异步加载，避免主包过大
- 支持取消生成（AbortController）和「继续生成」

**Vue 落地点：** 流式内容用 `ref` 追加；打字机用 `setInterval` + 组件卸载清理；Markdown 组件异步加载。

**React 落地点：** 流式解析封装自定义 Hook；`useTransition` 避免长内容渲染阻塞输入；`useSyncExternalStore` 管理流状态。

**追问：** 流式输出导致页面卡顿怎么优化？超长文档滚动怎么保持稳定？中断后如何继续？

---

## 14. 性能监控 / 埋点

**场景：** 需要监控首屏性能、长任务、JS 错误，并且埋点不能拖垮页面。

**考察点：** Core Web Vitals、长任务、错误捕获、采样上报。

**答题框架：**
- `PerformanceObserver` 收集 LCP / INP / CLS（FID 已过时）
- `PerformanceObserver('longtask')` 统计长任务，配合 `Long Animation Frames API` 定位卡顿
- `window.onerror` / `unhandledrejection` 捕获错误，带堆栈和用户环境
- 采样率上报（如 10%），批量 / 空闲时间发送，避免影响性能

**追问：** 怎么定位「用户反馈卡但本地不卡」？埋点本身报错怎么办？采样怎么保证代表性？

---

## 附：Vue vs React 在场景题里的高频差异

| 维度 | Vue | React |
|---|---|---|
| 更新粒度 | Proxy 自动追踪，精准更新 | setState 整体 re-render，需 memo/useMemo 手动优化 |
| 数据更新 | 可变数据，直接修改 ref/reactive | 不可变数据，生成新状态 |
| 副作用 | watch / watchEffect / computed 自动追踪 | useEffect 依赖数组手动声明，易闭包过期 |
| 状态管理 | Pinia | Zustand / Redux Toolkit |
| 服务端状态 | TanStack Vue Query / Pinia + 手写 | TanStack Query |
| 性能优化 | shallowRef、v-memo、keep-alive | memo、useMemo、useTransition、并发特性 |
| 2026 新特性 | Vue 3.6 Vapor Mode | React 19 Compiler、Actions、RSC |

---

## 参考来源（2026）

- CSDN《2026春招三年前端血泪面经：字节 / 阿里 / 美团》（2026-02）：断点续传、并发调度器 — https://blog.csdn.net/xifangge2025/article/details/158505438
- CSDN《26年大厂前端岗面试总结》（2026-04）：QPS 峰值、10 万条渲染、长任务统计 — https://blog.csdn.net/WYiQIU/article/details/159959091
- 什么值得买《前端面试题库已经换了一轮：AI 题从加分项变必考》（2026-08）：AI 长 Markdown 渲染、动态高度缓存 — https://post.smzdm.com/p/anvxwlr2/
- 什么值得买《2026 前端面试考点已经变了：AI 协作成必问、FID 成了过时答案》（2026-08）— https://post.smzdm.com/p/am9pre54/
