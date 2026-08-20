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

### 2.6 useReducer：复杂状态的 useState 替代品

```js
// 适合：多个状态相互关联、更新逻辑复杂、需要集中管理
function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 }
    case 'decrement':
      return { count: state.count - 1 }
    case 'reset':
      return { count: action.payload }
    default:
      return state
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0 })
// dispatch({ type: 'increment' })
```

**与 Redux 的关系：** `useReducer` 是 Redux 的"组件内版本"——同样的 reducer + dispatch 模式，但状态局限在组件内部，不做全局共享。理解 useReducer 就理解了 Redux 的核心思想。

### 2.7 useId 与 useImperativeHandle

```js
// useId：生成跨 SSR/CSR 一致的唯一 ID（用于表单 label、无障碍）
const id = useId()
<label htmlFor={id}>姓名</label>
<input id={id} />

// useImperativeHandle：限制 ref 暴露给父组件的方法
useImperativeHandle(ref, () => ({
  focus: () => inputRef.current.focus(),  // 只暴露 focus，不暴露整个 DOM
}))
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

### 3.3 render 阶段 vs commit 阶段（精确区分）

```
render 阶段（协调/Reconcile）：
  → 可中断、可恢复
  → 只"计算"哪些节点变了，产出 effect list
  → 不修改真实 DOM
  → 对应源码：beginWork / completeWork

commit 阶段（提交）：
  → 不可中断，必须同步执行完
  → 把 effect list 应用到真实 DOM
  → 对应源码：beforeMutation / mutation / layout
```

**面试加分点：** 常说"React 渲染可中断"其实指的是 render 阶段，commit 阶段是不可中断的。这两个阶段要分清楚。

### 3.4 key 的作用与 index 的坑

```
key 的作用：
  diff 时通过 key 判断子节点是"复用/移动/删除"还是"新建"
  没有 key 时，React 按顺序比较，无法识别"移动"场景

为什么不能用 index 当 key：
  列表头部插入/删除/排序时，index 会整体错位
  → 本应复用的节点被误判为新节点 → 状态错乱、输入内容串位
  正确做法：用稳定且唯一的业务 id（如 item.id）
```

### 3.5 setState 的批处理机制

```
React 18 之前：
  合成事件/生命周期内 → 批处理（多次 setState 合并为一次渲染）
  setTimeout/原生事件 → 不批处理（每次 setState 都立即渲染）

React 18 + createRoot（Automatic Batching）：
  所有更新默认批处理，包括 setTimeout、Promise、原生事件
  → 多次 setState 自动合并，性能更好
```

**函数式更新的意义：** `setCount(c => c + 1)` 拿到的是最新值，避免在连续更新时闭包读到旧值；`setCount(count + 1)` 读到的是"本次渲染"的 count，连续调用可能互相覆盖。

**useState 能不能传「更新完成后回调」？**

- class 组件的 `this.setState(updater, callback)` 第二个参数才是「更新完成后回调」，在 componentDidUpdate 后执行。
- 函数组件的 `useState` / `useReducer` **不支持第二个回调参数**（React 官方明确，传了会警告）。
- 别混淆：`setCount(prev => prev + 1)` 里的函数是「**函数式更新**」，作用是**基于旧值计算新值**，不是「完成后回调」——它可能被延迟调用、甚至多次调用，绝不能当回调用。
- 要做 set 之后的后续事情，用 `useEffect(() => {...}, [count])`：它在 DOM 更新（commit）后执行，能拿到最新状态。

```tsx
// ❌ useState 不支持第二个参数回调
setCount(count + 1, () => console.log('done')) // 会有警告

// ❌ 函数式更新不是回调，别在里面做副作用
setCount(prev => { console.log('不是回调'); return prev + 1 })

// ✅ 正确：用 useEffect 响应状态变化
useEffect(() => {
  console.log('count 更新为', count)
}, [count])
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

## 六、受控组件与非受控组件

### 6.1 核心区别

```
受控组件（Controlled）：
  表单值由 React state 控制，value + onChange 绑定
  数据单一来源：React state，DOM 只是展示

非受控组件（Uncontrolled）：
  表单值由 DOM 自己管理，用 ref 在需要时读取
  数据单一来源：DOM，React 不干预
```

### 6.2 代码对比

```jsx
// 受控：value + onChange，每次输入都走 state 更新
function ControlledInput() {
  const [value, setValue] = useState('')
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}

// 非受控：defaultValue 只设初值，用 ref 在提交时读取
function UncontrolledInput() {
  const inputRef = useRef(null)
  const handleSubmit = () => {
    console.log(inputRef.current.value)  // 提交时才读
  }
  return <input ref={inputRef} defaultValue="" />
}
```

### 6.3 什么时候用哪个

```
用受控组件：
  → 需要实时校验、格式化（手机号、信用卡）
  → 多个输入联动（A 变化影响 B）
  → 需要"数据单一来源"，便于测试和推理

用非受控组件：
  → 简单表单，只在提交时一次性取值
  → 文件上传（<input type="file"> 无法受控，只能非受控）
  → 高频输入的性能敏感场景（大量输入框，避免每次渲染）
```

### 6.4 对照 Vue 的 v-model

Vue 的 `v-model` 本质是"受控思想"的语法糖——它自动帮你做了 `value` + `input` 事件的绑定，你不用手写 onChange。React 则把这个过程显式暴露出来，让你自己用 `value` + `onChange` 实现。理解了这个，你会发现两者底层是同一套"数据驱动视图"的逻辑，只是 React 更啰嗦但更透明。

---

## 七、合成事件系统

### 7.1 什么是合成事件（SyntheticEvent）

React 把原生浏览器事件包装成统一的 `SyntheticEvent` 对象，提供跨浏览器一致的 API。通过 `e.nativeEvent` 可以访问原始的原生事件。

### 7.2 事件委托机制

```
React 17 之前：所有事件统一委托到 document
React 17 之后：委托到 root 容器（createRoot 挂载的节点）

好处：
  1. 跨浏览器兼容：统一封装，抹平差异
  2. 性能：统一监听，而不是每个元素都挂监听器，减少内存
  3. 统一 API：所有事件走同一套合成事件规范
```

### 7.3 为什么 React 17 要从 document 改到 root 容器

```
场景：一个页面有多个 React 实例（微前端、嵌入其他框架）
  document 委托 → 一个实例的事件会冒泡到另一个实例，互相干扰
  root 容器委托 → 每个实例的事件只在自己的根容器内处理，互不干扰
```

### 7.4 与 Vue 的差异

Vue 的事件是直接绑定到具体元素上的原生事件（编译时生成 `addEventListener`），React 则是合成事件 + 委托到根容器。所以 React 里 `e.stopPropagation()` 阻止的是合成事件的冒泡，某些特殊场景下和原生事件行为有细微差别。

### 7.5 合成事件的批量更新关联

React 在合成事件处理函数中会触发**自动批处理**（Automatic Batching）——一次事件里多次 `setState` 只触发一次渲染。这也是为什么"在 setTimeout/原生事件里 setState 的行为和合成事件里不同"（React 18 前）。

---

## 八、性能优化体系

### 8.1 React.lazy + Suspense 代码分割

```jsx
// 路由级懒加载：按需加载 chunk，减小首屏体积
const PostDetail = lazy(() => import('./PostDetail'))

<Suspense fallback={<Loading />}>
  <PostDetail />
</Suspense>
```

核心价值：把不常用的页面/组件拆成独立 chunk，首屏只加载必要代码。

### 8.2 key 的性能影响

```
正确用 key：稳定的唯一标识（id）
  → diff 能精确判断"复用/移动/删除"，最小化 DOM 操作

用 index 当 key 的坑：
  列表头部插入/删除/排序时，index 全部错位
  → 本应复用的节点被误判为"变了"，导致状态错乱（如输入框内容串位）
```

### 8.3 虚拟列表

只渲染可视区域内的列表项，配合 `react-window` / `react-virtual` 等库。核心原理：计算总高度 + 滚动位置，只渲染可视窗口 + 缓冲区内的项，其余用空白占位。适用于万级以上的长列表。

### 8.4 Profiler 定位瓶颈

```jsx
<Profiler id="List" onRender={(id, phase, actualDuration) => {
  console.log(id, phase, actualDuration)  // 找出渲染耗时的组件
}}>
  <List />
</Profiler>
```

配合 React DevTools 的 Profiler 面板，定位"为什么这个组件重渲染了"。

### 8.5 状态设计优化（Colocation）

```
状态下沉：把状态放到真正使用它的最小层级，而不是都提到顶层
  → 状态变化时，只有相关子树重渲染

状态提升：多个兄弟组件共享状态时，才提升到共同父级

核心原则：state 离使用它的组件越近越好（Colocation）
```

---

## 九、React 19 新特性（2026 高频）

### 9.1 Actions 体系（表单 + 异步状态管理）

React 19 引入 Actions，把"表单提交 + 异步状态 + 乐观更新"统一成一套 API，取代大量 `useEffect` + `useState` 的样板代码。

**useActionState**：管理表单提交的状态机

```jsx
import { useActionState } from 'react'

async function submitAction(prevState, formData) {
  const name = formData.get('name')
  const result = await api.createUser(name)
  return { ...prevState, users: [...prevState.users, result] }
}

function Form() {
  const [state, formAction, isPending] = useActionState(submitAction, { users: [] })

  return (
    <form action={formAction}>
      <input name="name" />
      <button disabled={isPending}>
        {isPending ? '提交中...' : '提交'}
      </button>
    </form>
  )
}
```

**useFormStatus**：读取父表单的提交状态

```jsx
function SubmitButton() {
  const { pending } = useFormStatus()  // 必须在 <form> 内部使用
  return <button disabled={pending}>{pending ? '提交中' : '提交'}</button>
}
```

**useOptimistic**：乐观更新，先更新 UI 再等服务器确认

```jsx
const [optimisticMessages, addOptimistic] = useOptimistic(
  messages,
  (current, newMessage) => [...current, newMessage],
)

// 发消息时：先立即显示，再异步请求，失败则回滚
addOptimistic({ id: tempId, text: input, pending: true })
```

### 9.2 use hook：在渲染中直接读取资源

```jsx
import { use } from 'react'

// 读 Promise（配合 Suspense）
const data = use(fetchDataPromise)

// 读 Context（可替代 useContext，且能用条件语句）
const theme = use(ThemeContext)
```

特点：`use` 可以在条件语句中使用（不像其他 Hook 有顺序限制），但必须在渲染期间调用。

### 9.3 RSC（React Server Components）

```
Server Components（服务端组件）：
  → 只在服务端渲染，不发 JS 到客户端
  → 可以直接访问数据库、文件系统
  → 不能用 Hooks、事件处理器
  → 减小客户端 bundle，提升首屏

Client Components（客户端组件）：
  → 处理交互，用 'use client' 标记
  → 可以用 Hooks、事件

关键区分：组件的执行环境由"用途"决定，而不是由"位置"决定
```

### 9.4 ref 作为普通 prop（取代 forwardRef）

```jsx
// React 19 之前：需要 forwardRef
const MyInput = forwardRef((props, ref) => <input ref={ref} {...props} />)

// React 19：ref 直接作为 prop 传入
function MyInput({ ref, ...props }) {
  return <input ref={ref} {...props} />
}
```

### 9.5 Activity（组件显示/隐藏保留状态）

```jsx
<Activity mode="hidden">
  <ExpensiveChart />  {/* 隐藏时保留状态，类似 display:none 但更高效 */}
</Activity>
```

### 9.6 useEffectEvent（实验性）

见 Hooks 章节的闭包陷阱解法——让 Effect 读取最新 props/state 而不触发重新订阅。React 19.2 引入，仍是实验性 API。

---

## 十、React vs Vue：面试常问对比

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

## 十一、高频面试题速答

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

### Q: 受控组件和非受控组件的区别？

受控组件：表单值由 React state 控制（value + onChange），数据单一来源是 state，适合需要实时校验、联动、格式化的场景。非受控组件：表单值由 DOM 自己管理，用 ref 在需要时读取，适合简单表单、文件上传、高频输入性能敏感场景。

### Q: React 的合成事件是什么？为什么要事件委托？

合成事件是 React 包装原生事件的统一对象（SyntheticEvent），提供跨浏览器一致的 API。事件委托到 root 容器（React 17 前是 document），统一监听减少内存占用，并抹平浏览器差异。17 改到 root 是为了支持同一页面多个 React 实例（微前端）互不干扰。

### Q: render 阶段和 commit 阶段有什么区别？

render 阶段（协调）可中断、可恢复，只计算哪些节点变了，不修改真实 DOM；commit 阶段不可中断，把副作用同步应用到真实 DOM。常说"React 渲染可中断"指的是 render 阶段，commit 不可中断。

### Q: 为什么 key 不能用 index？

列表头部插入/删除/排序时 index 会整体错位，导致本应复用的节点被误判为新节点，造成状态错乱（如输入框内容串位）。key 应该用稳定且唯一的业务 id。

### Q: React 19 的 Actions 解决了什么问题？

Actions（useActionState / useFormStatus / useOptimistic）把表单提交、异步状态、乐观更新统一成一套 API，取代了大量 useEffect + useState 的样板代码。useActionState 管理提交状态机，useFormStatus 让深层子组件读取表单 pending 状态，useOptimistic 实现"先更新 UI 再等服务器确认"的乐观更新。

### Q: Redux 和 Zustand 的本质区别？

不是性能（两者都基于 useSyncExternalStore，都支持精准订阅），而是约束程度。Redux 强制所有状态变更走 action → reducer 的可追踪管道，换来大型团队协作的可预测性和调试能力；Zustand 放弃强制约束，换来极简 API 和更少代码。选型：中小应用默认 Zustand，大型团队/合规审计/复杂中间件选 Redux Toolkit。

---

## 十二、交互式 Demo

- [React Hooks 执行流程可视化](./react-hooks-demo.html) — 看 useState/useEffect 在 React 生命周期中的执行时序
- [React vs Vue Diff 对比演示](./diff-compare-demo.html) — 直观对比二者的 diff 策略差异
