# React 一周速成冲刺计划（面向 2026 大厂高级前端）

> 前提：德德已有近 5 年 Vue3 深度，React 缺的是「心智迁移 + 高频题表达 + 手写手感」。
> 打法：**Vue 概念当锚点，React 概念挂上去**；每天「读必读 → 点 Demo → 复述 → 自测」四步闭环。
> 目标：7 天内能把 React 面试必考 12 题讲清「是什么 / 为什么 / 怎么实现 / 和 Vue 有什么不同」。

## 每天固定动作（四步闭环，约 2.5~3 小时/天）

1. **读**：先读当天「必读文档」对应小节（不用全篇背，只抓高频点）。
2. **点**：打开 `client` 里对应交互 Demo，动手改一改、看输出变化。
3. **讲**：合上文档，用自己的话把当天主题讲一遍（录音或对着空气说）。
4. **测**：回答当天「自测题」，答不上的立刻补进文档，不留尾巴。

## Day 1：Vue → React 心智迁移 + 组件数据流

**目标**：把「单向数据流、受控/非受控、JSX、props 不可变」这几个 React 底层默认值刻进脑子。

**Vue 锚点对照：**

| Vue | React |
| --- | --- |
| `v-model` 双向绑定 | 受控组件：`value` + `onChange` 手动同步 |
| 模板语法 | JSX：JavaScript 表达式，能 `map/&&/三元` |
| `props` 可变（子组件也能改对象内部） | `props` 只读，改数据必须通过父组件回调 |
| 组件通信靠 emit | 组件通信靠「回调函数 props」 |

**必读**：[React 核心机制](./React核心机制.md) 第六节「受控组件与非受控组件」

**实操**：在 `client/src/pages/About.tsx` 或新建一个输入框组件，分别写「受控」和「非受控」两种版本，体会 `value` 被 React 接管后页面「卡住不动」的原因。

**自测题：**
- 为什么说 React 是单向数据流？
- 受控组件和非受控组件本质区别是什么？各用什么拿值？
- `v-model` 在 React 里等价于哪两个东西的组合？

## Day 2：Hooks 核心（必考，重点中的重点）

**目标**：吃透 `useState / useEffect / useRef / useMemo / useCallback / useReducer`，并能解释「闭包陷阱」和「Hooks 为什么不能写在条件语句里」。

**Vue 锚点对照：**

| Vue | React |
| --- | --- |
| `ref()` / `reactive()` | `useState`（触发渲染的响应式状态） |
| `computed`（有缓存） | `useMemo`（缓存计算值） |
| `watch`（副作用 + 异步） | `useEffect`（同步 DOM 后 / 数据变化后的副作用） |
| 模板 ref / `ref="xx"` | `useRef`（不触发渲染的可变引用） |

**必读**：[React 核心机制](./React核心机制.md) 第二节「Hooks 原理」，重点看 2.1、2.2、2.3

**实操**（client 里都有现成页面）：
- [HooksClosure.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/pages/learn/HooksClosure.tsx)：闭包陷阱 + 函数式更新 + 批量更新
- [UseEffectLifecycle.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/pages/learn/UseEffectLifecycle.tsx)：依赖数组 / 清理函数
- [CustomHooks.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/pages/learn/CustomHooks.tsx)：`usePrevious / useDebounce / useLocalStorage`

**自测题：**
- 闭包陷阱是什么？`setCount(c => c + 1)` 为什么能解决？
- Hooks 为什么不能写在 `if` 里？和 Fiber 的什么结构有关？
- `useEffect` 的清理函数在什么时机执行？
- `useMemo` 和 `useCallback` 分别缓存什么？

## Day 3：渲染机制（Fiber / 虚拟 DOM / Diff）

**目标**：这是 React 面试「中级 → 高级」的分水岭，必须能讲清 Fiber 是什么、解决什么问题、render/commit 两阶段、Diff 三原则。

**Vue 锚点对照：**

| Vue3 | React |
| --- | --- |
| 模板编译 + Block Tree 静态提升 | JSX 运行时生成，靠 `React.memo` 显式控制 |
| 响应式依赖收集，精准更新 | 状态变更 → 重新执行组件函数 → Diff |
| 双端 diff | Fiber 单链表遍历 + key 比较 |
| 调度靠 Vue 的 nextTick 队列 | 调度靠 Scheduler 时间切片（可中断） |

**必读**：[React 核心机制](./React核心机制.md) 第一节「Fiber 架构」、第三节「Virtual DOM & Reconciliation」

**实操**：用 [render-demo.html](/Users/wangdeshi/Desktop/vibe_coding/interview-prep/render-demo.html) 理解渲染管线，再在 `React面试考点地图.md` 第二层「渲染原理」对号入座。

**自测题：**
- Fiber 和 React 15 的 Stack Reconciler 本质区别是什么？
- 为什么要引入时间切片（Time Slicing）？
- `render` 阶段和 `commit` 阶段各自做什么？为什么 `render` 可以中断、`commit` 不能？
- Diff 三原则是什么？为什么 `key` 不能用 `index`？
- 双缓冲 Fiber 树（`current` / `workInProgress`）解决了什么问题？

## Day 4：性能优化（高级核心）

**目标**：把「为什么组件会重渲染 → 怎么阻止不必要的重渲染」这条链路讲透，并会用 Profiler 定位。

**Vue 锚点对照：**

| Vue3 | React |
| --- | --- |
| 依赖收集自动优化，很少手动 | 父组件渲染会带崩子组件，需要手动优化 |
| `v-memo` / `shallowRef` | `React.memo` / `useMemo` / `useCallback` |
| `KeepAlive` | 自己用 `useState` 缓存 + `display` 控制 |

**必读**：[React 核心机制](./React核心机制.md) 第八节「性能优化体系」；[性能优化体系](./性能优化体系.md) 第四节「渲染层优化」

**实操**：
- [RenderOptimization.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/pages/learn/RenderOptimization.tsx)：`memo / useMemo / useCallback` 渲染计数对比
- [FixedVirtualList.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/pages/learn/FixedVirtualList.tsx)：定高虚拟列表

**自测题：**
- 父组件 setState 后，子组件一定会跟着重渲染吗？如何避免？
- `React.memo` 失效的三个常见原因是什么？
- `useCallback` 什么时候该用、什么时候是「过度优化」？
- 2026 高频：`React Compiler` 自动记忆化解决了什么？是不是以后不用手写 `memo` 了？

## Day 5：状态管理与数据请求

**目标**：分清「客户端状态」和「服务端状态」，能讲清 Context / Redux Toolkit / Zustand / TanStack Query 的边界与选型。

**Vue 锚点对照：**

| Vue | React |
| --- | --- |
| Pinia | Redux Toolkit / Zustand |
| `provide / inject` | `Context + useContext` |
| 手写请求 + 响应式缓存 | TanStack Query 管服务端状态 |

**必读**：[Redux核心](./Redux核心.md)、[TanStackQuery核心](./TanStackQuery核心.md)、[React 核心机制](./React核心机制.md) 第五节「状态管理」

**实操**：看 `client/src/stores/counter.ts`（Zustand）和 `client/src/lib/posts.ts`（TanStack Query + Router loader 预取），体会「客户端状态」与「服务端状态」分开管。

**自测题：**
- Context 适合放什么、不适合放什么？为什么不建议把所有状态塞进一个全局 Context？
- Redux Toolkit 的 `createSlice` 内部为什么看起来像「直接改 state」？
- Zustand 和 Redux 的本质区别是什么？面试怎么说？
- TanStack Query 的 `invalidateQueries` 和 `setQueryData` 分别解决什么？

## Day 6：React 19 + 前沿（2026 加分项）

**目标**：把 React 19 的 Actions 体系、`use`、RSC、Suspense 流式 SSR 讲清，作为拉开差距的加分项。

**必读**：[React 核心机制](./React核心机制.md) 第九节「React 19 新特性」

**实操**：[React19Features.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/pages/learn/React19Features.tsx)：`useTransition / useOptimistic / use / useActionState`

**自测题（2026 高频）：**
- `useTransition` 解决什么问题？`isPending` 怎么用？
- `useOptimistic` 和传统乐观更新的区别是什么？
- `use()` 和 `useEffect + useState` 读数据有什么本质区别？
- `useActionState` 把什么逻辑内置了？
- RSC（React Server Components）和 Client Components 怎么选？
- `Suspense` 在流式 SSR 里起什么作用？

## Day 7：全真模拟面试 + 场景题复盘

**目标**：用「面试官追问」方式过一遍 React 必考 12 题，暴露的盲区当天补文档。

**必考 12 题（背完再上考场）：**

1. Fiber 是什么，解决了什么问题？
2. Hooks 为什么不能写在条件语句里？
3. `useState` 是同步还是异步的？批处理怎么理解？
4. `useEffect` 和 `useLayoutEffect` 的区别？
5. `React.memo / useMemo / useCallback` 该不该用？
6. 受控组件和非受控组件的区别？
7. React 的合成事件是什么？为什么要事件委托？
8. `render` 阶段和 `commit` 阶段有什么区别？
9. 为什么 `key` 不能用 `index`？
10. React 19 的 Actions 解决了什么问题？
11. Redux 和 Zustand 的本质区别？
12. 100 个图表大屏 / 长列表怎么优化？

**场景题衔接**：React 侧场景题可复用 [C端场景题-Vue与React](./C端场景题-Vue与React.md) 和 [手撕场景题](./手撕场景题.md) 里的实现，把「Vue 写法」翻译成「React Hooks 写法」就是一次很好的迁移训练。

## 一周自检标准（高级前端分水岭）

能不打磕巴地讲清下面三条，就说明这周没白练：

1. **渲染原理**：状态变了 → 组件函数重新执行 → 产生新 React 元素 → 新旧 Fiber 树 Diff → commit 更新真实 DOM；`render` 可中断、`commit` 不可中断。
2. **Hooks 机制**：靠「固定调用顺序 + Fiber 上的 `memoizedState` 单向链表」保存状态，所以不能写在条件语句里。
3. **性能优化**：React 默认「父变子跟着变」，需要 `memo + useMemo + useCallback` 组合阻断；数据请求用 TanStack Query 把服务端状态和客户端状态分开。

## 来源（2026 检索）

- [React面试AI辅助：Hooks与Fiber高频题](https://www.mianlingai.com/blog/react-interview-ai-guide-2026/)
- [2026前端面试题精选：大厂高频考点与标准答案](https://blog.csdn.net/weixin_47793882/article/details/161018287)
- [100 Essential React Interview Questions in 2026](https://raw.githubusercontent.com/Devinterview-io/react-interview-questions/main/README.md)
- [React 19: What's New for Developers (2026)](https://scrimba.com/articles/react-19-whats-new-for-developers/)
- [React Hooks 核心原理](https://juejin.cn/post/7619219125663907880)
- [React Compiler in 2026: Automatic Memoization & Interview Questions](https://sharpskill.dev/en/blog/react-next/react-compiler-2026-automatic-memoization-interview-questions)
