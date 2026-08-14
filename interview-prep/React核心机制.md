# React 核心机制

> 你的简历写了"兼具 React 项目能力"，面试官大概率会问。不需要面面俱到，但核心机制要能说清楚。

---

## 一、Fiber 架构

### 1.1 为什么需要 Fiber？

React 15 的 Stack Reconciler 是同步递归的——一旦开始 diff 就不能中断，主线程被长时间占用会导致掉帧。

```
问题场景：
一个包含 3000 个节点的组件更新
  → Stack Reconciler：同步遍历 3000 个节点
  → 主线程被占用 100ms+
  → 掉帧、用户点击无响应

Fiber 的解决思路：
  → 将 diff 拆分为可中断的小任务
  → 每个任务执行完检查是否有更高优先级的工作
  → 有则让出主线程，闲时再继续
```

### 1.2 Fiber 节点的数据结构

```js
// Fiber 节点核心字段
{
  // 静态属性（描述节点本身）
  type: 'div',          // 组件类型
  key: null,            // key
  props: {...},         // 属性
  stateNode: domNode,   // 对应的真实 DOM

  // 链表属性（构建 Fiber 树）
  return: parentFiber,  // 父节点
  child: firstChild,    // 第一个子节点
  sibling: nextSibling, // 下一个兄弟节点

  // 工作相关
  alternate: oldFiber,  // 指向旧 Fiber（双缓冲）
  effectTag: 'UPDATE',  // 副作用标记（增/删/改）
  lanes: 0,             // 优先级
}
```

### 1.3 双缓冲机制（Double Buffering）

```
React 同时维护两棵 Fiber 树：
  current tree   → 当前屏幕上显示的（通过 alternate 指向 workInProgress）
  workInProgress → 正在内存中构建的新树

Commit 阶段完成后：
  workInProgress → 变成新的 current tree
  root.current = finishedWork  // 切换指针
```

**好处：** 内存中构建新树完成后一次性替换，保证视觉一致性；构建过程中旧树不受影响。

### 1.4 工作循环（Work Loop）

```
render 阶段（可中断）：
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress)
    // 深度优先遍历 Fiber 树
    // shouldYield() 检查是否需要让出主线程
  }

commit 阶段（不可中断）：
  1. beforeMutation  (getSnapshotBeforeUpdate)
  2. mutation        (DOM 更新)
  3. layout          (useLayoutEffect)
```

---

## 二、Hooks 原理

### 2.1 Hooks 的存储结构

```js
// 每个 Fiber 节点维护一个 hooks 链表
fiber.memoizedState → hook1 → hook2 → hook3 → null

// 每个 hook 的数据结构
{
  memoizedState: currentValue,  // 当前值
  queue: {                      // 更新队列
    pending: update1 → update2 → ...
  },
  next: nextHook,               // 链表指针
}
```

**为什么要按顺序调用？** Hook 的查找依赖链表顺序。条件调用会打乱索引，导致状态错乱。

### 2.2 useState 源码级原理

```js
function useState(initialState) {
  const hook = mountWorkInProgressHook() // 创建/获取 hook 节点

  // 惰性初始化
  if (typeof initialState === 'function') {
    initialState = initialState()
  }

  // 首次渲染挂载初始值
  if (hook.memoizedState === undefined) {
    hook.memoizedState = initialState
  }

  // 计算新状态
  const newState = processUpdateQueue(hook.queue)
  if (newState !== undefined) {
    hook.memoizedState = newState
  }

  const dispatch = (action) => {
    // 创建 update 对象，加入 queue
    const update = {
      action,
      next: null,
      lane: requestUpdateLane()
    }
    enqueueUpdate(hook.queue, update)
    // 触发重新渲染
    scheduleUpdateOnFiber(fiber, lane)
  }

  return [hook.memoizedState, dispatch]
}
```

### 2.3 useEffect vs useLayoutEffect

```
useEffect:
  执行时机：render → commit(DOM更新) → 浏览器绘制 → useEffect
  用途：数据请求、订阅、手动 DOM 操作（不阻塞渲染）
  特点：异步，不阻塞浏览器绘制

useLayoutEffect:
  执行时机：render → commit(DOM更新) → useLayoutEffect → 浏览器绘制
  用途：需要在绘制前同步读取/修改 DOM
  特点：同步，会阻塞浏览器绘制
```

### 2.4 useMemo vs useCallback

```js
// useMemo：缓存计算结果，依赖变化才重新计算
const expensive = useMemo(() => compute(a, b), [a, b])

// useCallback：缓存函数引用，依赖变化才创建新函数
const onClick = useCallback(() => doSomething(a), [a])

// useCallback(fn, deps) 等价于 useMemo(() => fn, deps)
```

### 2.5 useRef

```js
// useRef 创建的是 { current: initialValue } 对象
// 修改 .current 不会触发重新渲染
// 适合：DOM 引用、保存可变值（不需要触发渲染的值）
const countRef = useRef(0)
countRef.current++ // 不触发渲染
```

---

## 三、Virtual DOM & Reconciliation（协调）

### 3.1 Diff 算法三原则

```
1. 不同类型 → 销毁重建
   <div> → <span>：整个子树替换

2. 同类型 → 复用并更新属性
   <div className="a"> → <div className="b">：只更新 className

3. 通过 key 标识子节点
   key 用于判断节点是新增/删除/移动
```

### 3.2 Fiber Diff 的单链表遍历

```
performUnitOfWork(fiber):
  1. beginWork(fiber)：进入节点，diff 子节点
  2. completeWork(fiber)：离开节点，收集副作用链

遍历顺序（深度优先）：
  Root
  ├── Child1
  │   ├── Grandchild1-1
  │   └── Grandchild1-2
  ├── Child2
  │   └── Grandchild2-1
  └── ...

副作用链 (effect list)：
  Root → Child1(update) → Grandchild1-2(placement) → Child2(deletion) → null
  commit 阶段按此链表依次执行 DOM 操作
```

---

## 四、并发模式（Concurrent Mode）

### 4.1 核心思想

```
传统模式：渲染任务不可中断
并发模式：渲染任务可被更高优先级的任务打断

优先级分类（Lanes 模型）：
  用户交互（点击、输入）—— 高优先级
  数据请求后的渲染 —— 默认优先级
  离屏内容 —— 低优先级
  useTransition 包裹的 —— 过渡优先级
```

### 4.2 useTransition

```js
function SearchPage() {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleInput(e) {
    // 高优先级：立即更新输入框
    setQuery(e.target.value)

    // 低优先级：可以被中断的搜索结果更新
    startTransition(() => {
      setResults(search(e.target.value))
    })
  }

  return (
    <div>
      <input value={query} onChange={handleInput} />
      {isPending && <Spinner />}
      <SearchResults results={results} />
    </div>
  )
}
```

### 4.3 Suspense

```js
// 数据请求 + Suspense 的声明式加载
const LazyComponent = React.lazy(() => import('./Heavy'))

<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>
```

---

## 五、状态管理

### 5.1 Context 的注意点

```js
// Context value 变化时，所有消费者都会重新渲染
// 即使消费者只用到了 value 中的一小部分也会重新渲染

// 解决方案：拆分 Context
<ThemeContext.Provider>     // 主题
  <UserContext.Provider>    // 用户信息
    <SettingsContext.Provider> // 设置
      <App />
    </SettingsContext.Provider>
  </UserContext.Provider>
</ThemeContext.Provider>
```

### 5.2 第三方库选型

| 库 | 适用场景 | 特点 |
|---|---------|------|
| Zustand | 中小型应用 | 极简 API，TypeScript 友好，无 Provider 包裹 |
| Redux Toolkit | 大型团队应用 | 生态完善，devtools 强大，模板代码多 |
| Jotai/Recoil | 原子化状态 | 精准订阅，避免无关渲染 |
| React Query | 服务端状态 | 缓存、去重请求、自动重新获取 |

---

## 六、React vs Vue：面试常问对比

| 维度 | React | Vue |
|------|-------|-----|
| 响应式原理 | 不可变数据 + 手动 setState + 整体 re-render | Proxy + 自动依赖追踪 + 精准更新 |
| 模板 vs JSX | JSX（纯 JS 表达式） | 模板语法（指令、修饰符）+ JSX 支持 |
| 组件更新粒度 | 组件级（需 memo/useMemo 手动优化） | 组件级 + 自动追踪（几乎不需要手动优化） |
| Diff 优化 | Fiber + 双缓冲 + 可中断 | Block Tree + PatchFlags + 静态提升 |
| 状态管理 | 第三方为主（Redux/Zustand） | Pinia（官方） |
| 学习曲线 | 陡峭（需理解不可变性、闭包陷阱等） | 平缓（模板语法接近 HTML） |
| 灵活性 vs 规范 | 灵活（同一功能多种写法） | 规范（推荐的写法就一种） |

**面试话术：** React 更偏"函数式"和"不可变数据"，更新粒度较粗需要手动优化；Vue 更偏"自动"，Proxy 精准追踪依赖，几乎不需要手动优化。技术选型取决于团队偏好和项目需求。

### Vue 开发者转 React：三个必须补的差异

1. **不可变数据 + 整体 re-render**：`setState` 产生新状态，组件函数整体重新执行，父组件渲染会带动子组件，需要 `memo` / `useMemo` / `useCallback` 手动优化；Vue 是可变数据 + 自动依赖追踪，更新更精准
2. **Hooks 依赖数组 + 闭包**：`useEffect` 不会自动追踪依赖，需要手动声明 deps，依赖漏写或闭包过期值是最常见的坑；对应 Vue `watch` / `watchEffect` / `computed` 的自动追踪
3. **JSX 是表达式而非模板**：`className`、style 对象、事件、key、Hooks 调用顺序都是 JS 语义；Vue 模板有编译期优化（PatchFlags / 静态提升），React 主要靠运行时 Fiber / 并发调度

---

## 七、高频面试题速答

### Q: Fiber 是什么，解决了什么问题？

Fiber 是 React 16 引入的新协调引擎。核心改变：将同步递归的 diff 拆分为可中断的异步任务，通过 `requestIdleCallback`（实际用 Scheduler 包）分片执行，避免长时间占用主线程。每个 Fiber 节点在内存中是链表节点（return/child/sibling），支持暂停和恢复。

### Q: Hooks 为什么不能写在条件语句里？

Hook 按调用顺序存储在 Fiber 节点的链表中。条件调用会打乱顺序，导致状态错乱。React 通过调用顺序来匹配 hook 和 state，而非通过 key。

### Q: useState 是同步还是异步的？

React 18 以前：在合成事件和生命周期中是异步批处理的，在 setTimeout/原生事件中是同步的。
React 18 + createRoot：所有更新默认批处理（Automatic Batching），setTimeout 中也是异步的。

### Q: useEffect 和 useLayoutEffect 的区别？

useEffect 在浏览器绘制后异步执行，适合数据请求、订阅等不阻塞渲染的操作。useLayoutEffect 在 DOM 更新后、浏览器绘制前同步执行，适合需要在绘制前读取 DOM 尺寸/位置的操作。大多数情况用 useEffect 就够了。

### Q: React.memo、useMemo、useCallback 该不该用？

- React.memo：只有在 props 比较开销大且渲染开销也大的组件上用。别到处包。
- useMemo：计算开销大的派生数据。
- useCallback：只在传给子组件且子组件用了 React.memo 时用。不配合 memo 的 useCallback 是自我安慰。

---

## 八、交互式 Demo

- [React Hooks 执行流程可视化](./react-hooks-demo.html) — 看 useState/useEffect 在 React 生命周期中的执行时序
- [React vs Vue Diff 对比演示](./diff-compare-demo.html) — 直观对比二者的 diff 策略差异
