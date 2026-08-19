# React 代码实践与问题复盘

> 面向高级前端面试的 React 学习记录。每个主题通过 `client/` 下的可运行代码实践，记录学习内容、踩坑问题与复盘总结。
> 学习起点：2026-08-18

---

## 学习路线总览

基于 2025–2026 大厂（字节/美团/阿里/腾讯/百度）React 高频考点，结合王德师 Vue 主栈背景设计：

| 序号 | 主题 | 状态 | 代码位置 |
|------|------|------|----------|
| 1 | Hooks 闭包陷阱与 setState 机制 | 进行中 | `client/src/pages/learn/HooksClosure.tsx` |
| 2 | useEffect 生命周期与依赖数组 | 完成 | `client/src/pages/learn/UseEffectLifecycle.tsx` |
| 3 | 自定义 Hook 设计（对比 Vue composables） | 完成 | `client/src/pages/learn/CustomHooks.tsx` |
| 4 | 渲染优化（memo/useMemo/useCallback/React Compiler） | 完成 | `client/src/pages/learn/RenderOptimization.tsx` |
| 5 | React 19 新特性（Actions/use/useOptimistic） | 完成 | `client/src/pages/learn/React19Features.tsx` |
| 6 | React 与 Vue 核心差异对比总结 | 完成 | 文档总结（无独立代码） |

---

## 记录规范

每个主题完成后记录以下内容：

- **学习目标**：本主题要解决什么问题、覆盖哪些面试考点
- **核心概念**：关键知识点 + 代码演示（标注"为什么"）
- **踩坑记录**：实践中遇到的问题、错误认知、纠正过程
- **复盘总结**：面试怎么答、和 Vue 的对照、易错点清单

---

## 主题一：Hooks 闭包陷阱与 setState 机制

> 状态：进行中 · 代码：`client/src/pages/learn/HooksClosure.tsx`

### 学习目标

- 理解 useState 的闭包陷阱：为什么定时器/回调里拿到的是旧值
- 理解 setState 的同步/异步行为：React 18/19 中什么场景批量更新、什么场景同步
- 掌握函数式更新 `setState(prev => ...)` 解决闭包陷阱
- 对比 Vue 响应式：为什么 Vue 没有这个问题

### 核心概念

#### 1. 函数组件的每次渲染都是独立「快照」

```tsx
function Counter() {
  const [count, setCount] = useState(0)

  const handleClick = () => {
    setTimeout(() => {
      console.log(count) // 永远是「点击时那次渲染」的 count
    }, 3000)
  }
}
```

**为什么？** React 函数组件没有「响应式」——函数每次执行都创建一套全新的变量和函数。`setTimeout` 里的回调闭包捕获的是**当次渲染**的 `count` 值，之后即使 `count` 变了，旧闭包里的值也不会变。

对比 Vue：

```ts
// Vue：响应式变量是「引用」，读到的永远是当前值
const count = ref(0)
setTimeout(() => console.log(count.value), 3000) // 永远是最新值
```

Vue 通过 `Proxy` 拦截属性访问，`count.value` 是一个「活的引用」；React 的 `count` 只是一个「普通数字」，没有追踪能力。

#### 2. setState 批量更新（Batching）

React 18 之后，**所有场景**（事件处理器、setTimeout、Promise、原生事件）都自动批处理：

```tsx
setCount(count + 1) // 基于旧值 0，计算 0+1=1
setCount(count + 1) // 还是基于旧值 0，计算 0+1=1
setCount(count + 1) // 还是 1，最终 count = 1（不是 3）
```

同一事件里的多次 `setState` 只触发一次渲染，且每次都用同一份旧值。

**解决**：用函数式更新，React 保证 `prev` 是队列中的最新值：

```tsx
setCount(prev => prev + 1) // prev=0 → 1
setCount(prev => prev + 1) // prev=1 → 2
setCount(prev => prev + 1) // prev=2 → 3
```

#### 3. 为什么「直接读 count」永远是旧值

```tsx
setCount(prev => prev + 1)
setCount(prev => prev + 1)
console.log(count) // 仍然是 0！
```

`setCount` 只是把更新排入队列，**不会立即修改当前渲染里的 `count` 变量**。要等下一次渲染，新函数执行时才能拿到新值。

#### 4. React 18 之前 vs 之后

| 场景 | React 17 | React 18+ |
|------|----------|-----------|
| 事件处理器 | 异步（批量） | 异步（批量） |
| setTimeout/Promise | **同步** | 异步（批量） |
| 原生事件监听 | **同步** | 异步（批量） |

> React 18 通过 `createRoot` 启用并发渲染，统一了所有场景的批处理行为。

### 踩坑记录

#### 坑 1：闭包陷阱「看着对、实际错」

实践中最容易踩的是：**先读了 state 再在异步回调里用**。

```tsx
const handleSubmit = () => {
  const { title } = formState // 当前渲染的快照
  setTimeout(async () => {
    await api.save({ title }) // 如果 3 秒内用户改了 formState，这里提交的是旧值
  }, 3000)
}
```

**纠正**：异步回调里要么用 `ref` 存最新值，要么在回调执行时重新读取（如 `useForm` 的 `getValues()`），要么改用函数式更新。

#### 坑 2：误以为 setState 后立即可读

```tsx
setCount(count + 1)
if (count === 1) { /* 永远不会走到，因为 count 还是 0 */ }
```

**纠正**：需要基于新值做判断时，用函数式更新配合 `useEffect` 或在下次渲染中判断。

#### 坑 3：useEffect 依赖数组遗漏

`useEffect(() => { ... }, [])` 空依赖数组意味着只在挂载时执行一次，闭包里的 state 永远是初始值。

### 复盘总结

**面试怎么答「闭包陷阱」：**

1. 先点出本质：React 函数组件每次渲染创建独立快照，闭包捕获的是当次渲染的值
2. 对比 Vue：Vue 的响应式是「活的引用」，React 是「不可变的快照」
3. 解决方案：函数式更新 `setState(prev => ...)`、`useRef` 存最新值、依赖数组正确声明
4. 加分：React 18+ 统一批处理，所有场景的 setState 都是异步合并

**面试怎么答「setState 同步还是异步」：**

> React 18+ 中，setState 在**所有场景**都是异步批处理的。但「异步」不是说用了宏任务/微任务，而是指：**更新不会立即反映到当前渲染的变量上，React 会收集一批更新后统一触发一次渲染**。函数式更新可以保证在队列中拿到最新值。

**和 Vue 的对照：**

| 维度 | Vue 3 | React |
|------|-------|-------|
| 响应式机制 | Proxy 拦截，自动追踪 | 快照 + 重新执行 |
| 状态更新 | 赋值即触发，同 tick 合并 | setState 排队，异步批处理 |
| 闭包陷阱 | 无（引用是活的） | 有（快照是死的） |
| 获取最新值 | 直接读 `ref.value` | 函数式更新 / ref / effect |

---

## 主题二：useEffect 生命周期与依赖数组

> 状态：完成 · 代码：`client/src/pages/learn/UseEffectLifecycle.tsx`

### 学习目标

- 掌握 useEffect 的执行时机（渲染后异步）和 useLayoutEffect 的同步阻塞特性
- 理解依赖数组的比较机制（Object.is）和正确写法
- 理解清理函数的作用和执行时机
- 理解 StrictMode 下 effect 双执行的原因
- 对比 Vue 的 watch / watchEffect / onMounted

### 核心概念

#### 1. useEffect 的执行时机

```
组件渲染 → React 提交 DOM 变更 → 浏览器绘制 → useEffect（异步）
                                  ↑
                    useLayoutEffect（同步，阻塞绘制）
```

- **useEffect**：浏览器绘制**之后**异步执行，不阻塞 UI
- **useLayoutEffect**：DOM 提交后、浏览器绘制**之前**同步执行，会阻塞绘制

**为什么需要 useLayoutEffect？** 当你需要「读取 DOM 尺寸 → 同步修改样式」时，如果在 useEffect 里做，用户会先看到一帧未修改的画面（闪烁）；useLayoutEffect 在绘制前执行，可以避免闪烁。

#### 2. 依赖数组比较机制

React 用 `Object.is` 比较每个依赖：

```tsx
useEffect(() => { /* ... */ }, [count])  // count 变化才重新执行
useEffect(() => { /* ... */ }, [])       // 只挂载时执行一次
useEffect(() => { /* ... */ })           // 每次渲染后都执行
```

**坑**：如果依赖是对象/数组，每次渲染都会创建新引用，`Object.is` 比较永远不相等，effect 会每次都执行。解决方案：用 `useMemo` 缓存引用，或用 `useRef` 存值。

#### 3. 清理函数（Cleanup）

```tsx
useEffect(() => {
  const timer = setInterval(() => {}, 1000)
  const handler = () => {}
  window.addEventListener('resize', handler)

  return () => {
    clearInterval(timer)          // 防止内存泄漏
    window.removeEventListener('resize', handler)
  }
}, [])
```

清理函数执行时机：
1. 组件卸载前
2. **下一次 effect 执行前**（React 先清理上一个 effect，再执行新的）

#### 4. StrictMode 双执行

React 19 开发模式下，StrictMode 会执行 `mount → unmount → remount`：

```
首次渲染 → effect 执行 → 清理函数 → effect 再次执行
```

**为什么？** 帮助开发者发现「没有正确清理副作用」的 bug。生产环境不会双执行。

#### 5. 与 Vue 对比

| React | Vue 3 | 说明 |
|-------|-------|------|
| `useEffect(() => {}, [count])` | `watch(count, () => {})` | 依赖变化时执行 |
| `useEffect(() => {}, [])` | `onMounted(() => {})` | 挂载时执行一次 |
| 清理函数 `return () => {}` | `onUnmounted(() => {})` / `watch` 的 `onCleanup` | 卸载/重新执行前清理 |
| `useLayoutEffect` | Vue 无直接对应（用 `nextTick` + 同步操作近似） | 绘制前同步执行 |
| 手动声明依赖 | `watchEffect` 自动追踪 | React 19 Compiler 正在尝试自动推断 |

### 踩坑记录

#### 坑 1：依赖数组写 `[count]` 但 effect 里用了 `text`

```tsx
useEffect(() => {
  console.log(count, text) // text 变化时不会执行，读到的 text 是旧的
}, [count])
```

**纠正**：ESLint 的 `react-hooks/exhaustive-deps` 会提示，把所有在 effect 里用到的响应式变量都列入依赖。

#### 坑 2：依赖数组里的对象/数组引用不稳定

```tsx
useEffect(() => {
  fetchData({ page: 1 }) // 每次渲染都新对象
}, [{ page: 1 }])        // 永远不相等，effect 每次渲染都执行
```

**纠正**：用 `useMemo` 缓存对象引用，或把原始值直接列入依赖。

#### 坑 3：在 useEffect 里直接 setState 导致死循环

```tsx
useEffect(() => {
  setCount(count + 1) // 触发渲染 → effect 重新执行 → 又 setCount → 死循环
}, [count])
```

**纠正**：确认是否真的需要 effect 同步 state；通常可以用 `useMemo` 派生，或调整依赖数组。

### 复盘总结

**面试怎么答「useEffect vs useLayoutEffect」：**

> useEffect 在浏览器绘制后异步执行，适合数据请求、订阅等不阻塞 UI 的副作用；useLayoutEffect 在 DOM 提交后、绘制前同步执行，适合需要同步读取布局信息并修改 DOM 的场景，避免闪烁。但 useLayoutEffect 会阻塞绘制，滥用会掉帧。

**面试怎么答「StrictMode 下 effect 为什么执行两次」：**

> 这是 React 开发模式下的故意行为，执行 mount → unmount → remount，目的是暴露「没有正确清理副作用」的 bug。生产环境不会双执行。如果你的 effect 在双执行时出问题，说明清理函数写得不完整。

**和 Vue 的对照要点：**

> Vue 的 watch 是「命令式」的——明确告诉它监听谁；watchEffect 是「自动追踪」的——用到什么就追踪什么。React 需要手动声明依赖数组，漏写会导致闭包旧值。React 19 的 Compiler 正在尝试自动推断依赖，但目前手动声明仍是主流。

---

## 主题三：自定义 Hook 设计（对比 Vue composables）

> 状态：完成 · 代码：`client/src/pages/learn/CustomHooks.tsx`

### 学习目标

- 理解自定义 Hook 的设计原则和与普通函数的区别
- 掌握常见自定义 Hook 的手写：usePrevious、useDebounce、useThrottle、useLocalStorage
- 对比 Vue composables 的异同
- 了解大厂面试常见自定义 Hook 场景题（useForm、useRequest、useMergedState 等）

### 核心概念

#### 1. 什么是自定义 Hook？

自定义 Hook = **以 `use` 开头 + 内部调用其他 Hook 的函数**。

```tsx
// 不是 UI 复用，是「状态逻辑」复用
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => { ref.current = value }, [value])
  return ref.current // 返回的是上一次渲染的值
}
```

**为什么必须 use 开头？** React 的 ESLint 插件依赖命名前缀来检查 Hook 规则（不能条件调用、不能在循环里调用）。不以 use 开头，lint 无法识别这是 Hook。

**和普通函数的区别：**

| 普通函数 | 自定义 Hook |
|----------|-------------|
| 不能调用 useState/useEffect | 内部可以调用任何 Hook |
| 每次调用独立执行 | 每次调用创建独立的 state 实例 |
| 不参与渲染生命周期 | 内部 Hook 参与组件渲染周期 |

#### 2. 每个组件实例的 Hook 状态是独立的

```tsx
function ComponentA() {
  const [count, setCount] = useState(0) // A 的 count
  return <div>{count}</div>
}

function ComponentB() {
  const [count, setCount] = useState(0) // B 的 count，和 A 无关
  return <div>{count}</div>
}
```

自定义 Hook 也一样：每个使用它的组件拥有**独立的 state**。这和 Vue composables 的行为不同——Vue 的 composable 如果在模块顶层创建 `ref`，多个组件会**共享**同一个响应式对象。

```ts
// Vue：模块顶层的 ref 是单例
const count = ref(0) // 所有使用这个 composable 的组件共享同一个 count

export function useSharedCounter() {
  return { count }
}
```

#### 3. 常见自定义 Hook 手写模式

**useDebounce（防抖）：**

```tsx
function useDebounce<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer) // 关键：value 变化时清理旧定时器
  }, [value, delay])
  return debounced
}
```

**useThrottle（节流）：**

```tsx
function useThrottle<T>(value: T, interval = 500): T {
  const [throttled, setThrottled] = useState(value)
  const lastRun = useRef(Date.now())
  const pendingValue = useRef(value)

  useEffect(() => {
    const now = Date.now()
    const remaining = interval - (now - lastRun.current)
    if (remaining <= 0) {
      lastRun.current = now
      setThrottled(value)
    } else {
      pendingValue.current = value
      const timer = setTimeout(() => {
        lastRun.current = Date.now()
        setThrottled(pendingValue.current)
      }, remaining)
      return () => clearTimeout(timer)
    }
  }, [value, interval])

  return throttled
}
```

#### 4. 与 Vue composables 对比

| 维度 | React 自定义 Hook | Vue composables |
|------|-------------------|-----------------|
| 复用单元 | 状态逻辑（useState/useEffect 组合） | 响应式逻辑（ref/computed/watch 组合） |
| 状态隔离 | 每次调用独立 | 取决于 ref 定义位置（函数内=独立，模块顶层=共享） |
| 命名约定 | use 前缀 | use 前缀（社区约定） |
| 生命周期 | 随组件渲染周期 | setup 里执行，onMounted 等钩子 |
| 依赖追踪 | 手动声明依赖数组 | 自动追踪 |

### 踩坑记录

#### 坑 1：在自定义 Hook 里条件调用 Hook

```tsx
// ❌ 错误：条件调用 Hook
function useBadHook(flag: boolean) {
  if (flag) {
    const [value, setValue] = useState(0) // 违反 Hook 规则
  }
  // ...
}
```

**纠正**：Hook 必须无条件在顶层调用。条件逻辑放在 Hook 内部，不影响 Hook 调用顺序。

#### 坑 2：usePrevious 的时序理解错误

```tsx
// ❌ React 18 的经典写法：在 render 中读 ref.current
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => { ref.current = value }, [value])
  return ref.current
}
```

**React 19 的问题**：在 render 中读 `ref.current` 违反了 `react-hooks/refs` 规则。并发渲染下 render 可能被中断/重放，此时 effect 尚未执行，`ref.current` 里的值可能不是「上一次已提交渲染」的值。

**React 19 推荐实现**（render 期间比较模式）：

```tsx
function usePrevious<T>(value: T): T | undefined {
  const [current, setCurrent] = useState(value)
  const [previous, setPrevious] = useState<T | undefined>(undefined)

  if (value !== current) {
    setCurrent(value)
    setPrevious(current)
  }

  return previous
}
```

这就是 React 官方文档的「adjusting state during render」模式：在 render 中 setState，React 会在当前渲染结束后立即再渲染一次，确保 UI 一致。

#### 坑 3：把 Vue 的模块级 ref 模式搬到 React

```tsx
// ❌ 错误：React 中在模块顶层定义 state，多个组件共享同一个 state
const [globalCount, setGlobalCount] = useState(0) // 这是错误的用法
```

**纠正**：React 的状态共享用 Zustand/Context/Redux，而不是模块级变量。模块级变量在 React 中不会触发重新渲染。

### 复盘总结

**面试怎么答「自定义 Hook 和普通函数的区别」：**

> 自定义 Hook 是以 use 开头、内部调用其他 Hook 的函数。它复用的是**状态逻辑**而非 UI。每个使用 Hook 的组件实例拥有独立的 state。普通函数不能调用 Hook，也没有参与组件渲染周期的能力。

**面试怎么答「React Hook 和 Vue composable 的异同」：**

> 概念相同：都是逻辑复用的手段。实现不同：React Hook 基于函数组件的快照渲染模型，手动声明依赖；Vue composable 基于 Proxy 响应式系统，自动追踪依赖。状态隔离也不同：React Hook 每次调用独立，Vue 取决于 ref 定义位置。

**面试场景题「手写 useForm Hook」思路：**

```
1. 用 useState 存表单值
2. 用 useRef 存字段注册表
3. 实现 register(name, rules) 返回 onChange/onBlur 等 props
4. 实现 validate() 遍历规则并返回错误
5. 用 useCallback 优化返回的函数引用
```

---

## 主题四：渲染优化（memo / useMemo / useCallback / React Compiler）

> 状态：完成 · 代码：`client/src/pages/learn/RenderOptimization.tsx`

### 学习目标

- 理解 React.memo 的原理（浅比较 props）和适用场景
- 掌握 useMemo 和 useCallback 的区别和底层原理
- 理解「为什么有时候用了反而更慢」
- 了解 React Compiler（React 19）如何自动化 memoization

### 核心概念

#### 1. React.memo 原理

```tsx
const MemoChild = memo(function Child({ value }: { value: number }) {
  return <div>{value}</div>
})
```

React.memo 在渲染前**浅比较**新旧 props：

- 所有 props 相等（`Object.is`）→ 跳过渲染，复用上次结果
- 任一 props 不等 → 正常渲染

**浅比较**意味着：如果 props 里有对象/数组/函数，即使内容相同但引用不同，memo 也会失效。

#### 2. useMemo vs useCallback

```tsx
// useMemo：缓存「计算结果」
const doubled = useMemo(() => value * 2, [value])

// useCallback：缓存「函数引用」
const handleClick = useCallback(() => {
  doSomething(value)
}, [value])

// 本质等价：useCallback(fn, deps) === useMemo(() => fn, deps)
```

**面试常问「useCallback 底层原理」：**

> useCallback 本质是 useMemo 的语法糖——它缓存的是函数引用，而 useMemo 缓存的是函数执行结果。它们都依赖 React 的 Fiber 节点上的 `memoizedState` 链表来存储缓存值。

#### 3. 为什么「有时候用了反而更慢」

**场景 1：组件本身很轻，memo 的比较开销大于渲染开销**

```tsx
// 如果组件只渲染一个 <div>，渲染本身很便宜
// memo 的浅比较反而增加了开销
const LightChild = memo(function LightChild() {
  return <div>hello</div>
})
```

**场景 2：props 每次都是新对象，memo 永远失效**

```tsx
<MemoChild config={{ theme: 'dark' }} />  // 每次渲染都新对象，memo 失效
<MemoChild onClick={() => {}} />          // 每次渲染都新函数，memo 失效
```

**场景 3：useMemo 缓存了「不昂贵」的计算**

```tsx
const result = useMemo(() => 1 + 1, [])  // 过度优化：缓存本身有开销
```

**面试加分回答：**

> React 官方建议**先写代码，再用 Profiler 测量**。不要预优化。memo 的浅比较、useMemo 的依赖比较本身都有开销，如果组件的渲染很轻或 props 变化频繁，优化收益可能为负。React Compiler 的出现正是为了在编译期自动判断哪里值得优化。

#### 4. React Compiler（React 19）

React 19 引入了 React Compiler，在编译阶段：

1. 自动分析组件依赖关系
2. 自动插入 memo / useMemo / useCallback 等效逻辑
3. 不需要开发者手动写优化代码

**影响：** 大厂面试正在转向问「React Compiler 的原理」和「为什么还需要理解手动优化」。

**面试怎么答：**

> React Compiler 通过编译期静态分析，自动推断组件的依赖关系，自动插入 memoization。它解决了 React 18 时代的「优化疲劳」问题。但理解手动优化仍然是必要的：第一，Compiler 不是万能，有边界条件；第二，理解原理才能调试性能问题；第三，老项目不一定启用 Compiler。

### 踩坑记录

#### 坑 1：memo 子组件传了内联对象/函数导致失效

```tsx
// ❌ 错误：每次渲染都创建新对象，memo 失效
<MemoChild style={{ color: 'red' }} />
<MemoChild onClick={() => doSomething()} />
```

**纠正**：用 useMemo 缓存对象、useCallback 缓存函数。

#### 坑 2：useCallback 依赖数组遗漏

```tsx
const handleClick = useCallback(() => {
  console.log(count) // count 变化时 handleClick 不会更新，打印旧值
}, []) // 依赖数组为空
```

**纠正**：把所有在函数里用到的响应式变量都列入依赖，或者用 ref 存最新值。

#### 坑 3：在 map 里给每个子组件传新函数

```tsx
{items.map(item => (
  <MemoChild key={item.id} onDelete={() => handleDelete(item.id)} />
))}
```

**纠正**：让子组件接收 `id` 而不是函数，由父组件统一处理；或用 `useCallback` 配合 `item.id` 缓存每个子组件的回调。

### 复盘总结

**面试怎么答「React.memo 和 useMemo 的区别」：**

> React.memo 是**组件级**优化，浅比较 props 决定是否跳过渲染；useMemo 是**值级**优化，缓存计算结果避免重复计算。它们解决的问题不同：memo 解决不必要的组件渲染，useMemo 解决不必要的计算。

**面试怎么答「什么时候用 useMemo / useCallback」：**

> 三个条件同时满足时才值得用：
> 1. 计算确实昂贵（10 万次循环、大数组处理等）
> 2. 引用稳定性有实际需求（传给 memo 子组件、作为 useEffect 依赖）
> 3. 依赖变化不频繁
> 否则就是过度优化，反而增加开销。

**和 Vue 的对照：**

| 优化手段 | React | Vue 3 |
|----------|-------|-------|
| 组件跳过渲染 | React.memo | 组件 props 比较（Vue 自动优化） |
| 缓存计算 | useMemo | computed（自动缓存） |
| 稳定函数引用 | useCallback | 无需（Vue 的响应式追踪不需要） |
| 编译期优化 | React Compiler（19） | Vue Compiler（静态分析已内置） |
| 手动优化频率 | 高（React 18）→ 低（React 19） | 低（Vue 自动处理大部分） |

---

## 主题五：React 19 新特性（Actions / use / useOptimistic）

> 状态：完成 · 代码：`client/src/pages/learn/React19Features.tsx`

### 学习目标

- 掌握 React 19 的核心新特性：Actions、use()、useOptimistic、useTransition 增强
- 理解 use() 和 useEffect 的本质区别
- 理解 useOptimistic 乐观更新的实现原理
- 了解 React Compiler 和 Server Components 对面试的影响

### 核心概念

#### 1. Actions —— 表单/异步操作的一等公民

React 19 引入了 Actions，把「异步操作」提升为一等公民：

```tsx
// React 18：手动管理 pending 状态
const [isPending, setIsPending] = useState(false)
const handleSubmit = async (e) => {
  setIsPending(true)
  try {
    await api.submit(data)
  } finally {
    setIsPending(false)
  }
}

// React 19：Actions 自动管理 pending
const [state, formAction, isPending] = useActionState(submitAction, initialState)
<form action={formAction}>...</form>
```

**Actions 的核心价值：**

1. **自动 pending 状态**：`useFormStatus` / `useActionState` 返回的 `isPending` 自动管理
2. **乐观更新支持**：配合 `useOptimistic` 使用
3. **并发安全**：React 保证 action 执行期间状态一致
4. **渐进增强**：无 JS 时 form action 也能工作

#### 2. use() —— 在 render 中读取 Promise/Context

```tsx
function UserProfile() {
  // use() 直接「读取」Promise，suspend 组件直到数据就绪
  const user = use(fetchUserPromise)
  return <div>{user.name}</div>
}

// 配合 Suspense 展示 fallback
<Suspense fallback={<Loading />}>
  <UserProfile />
</Suspense>
```

**use() vs useEffect：**

| | useEffect | use() |
|---|-----------|-------|
| 执行时机 | 渲染后异步 | render 中同步 |
| 数据获取 | 先渲染 → 加载 → 再渲染 | Suspense 等待 → 渲染 |
| 状态管理 | 需要 useState + loading | 无需手动管理 |
| 适用场景 | 传统数据请求 | Suspense 数据预取、RSC |

**面试要点：** use() 必须在 Suspense 边界内使用（或配合错误边界），且不能在 try/catch 中使用。

#### 3. useOptimistic —— 乐观更新

```tsx
const [optimisticState, addOptimistic] = useOptimistic(
  realState,
  (currentState, optimisticValue) => [...currentState, optimisticValue],
)

// 发送消息时：
addOptimistic(newMessage) // 立即显示（不等服务器）
await api.send(newMessage) // 后台请求
// 成功后 React 自动用 realState 替换 optimisticState
```

**原理：** React 维护一个「乐观状态」的副本。当 action 执行时，先用乐观值更新 UI；action 完成后，用真实状态替换。失败则回滚。

#### 4. React Compiler

React 19 的 Compiler 在编译期自动分析组件，自动插入 memo / useMemo / useCallback。这是 React 团队对「优化疲劳」的回应。

**影响面试的方式：**

> 2025-2026 大厂面试不再只问「useMemo 和 useCallback 的区别」，开始问「React Compiler 的原理」和「有了 Compiler 还需要手动优化吗」。

### 踩坑记录

#### 坑 1：use() 在 Suspense 外使用导致报错

```tsx
// ❌ 错误：没有 Suspense 边界
function App() {
  const data = use(promise) // 报错：找不到 Suspense 边界
  return <div>{data}</div>
}
```

**纠正**：`use()` 必须配合 `<Suspense>` 使用。

#### 坑 2：useOptimistic 的 reducer 没有正确实现回滚

```tsx
// ❌ 错误：乐观更新后失败不会自动回滚
const [optimistic] = useOptimistic(realState, (state, value) => {
  state.push(value) // 直接修改原数组
  return state
})
```

**纠正**：reducer 必须**不可变更新**，返回新数组/对象。

#### 坑 3：use() 的 Promise 每次渲染都重新创建导致无限循环

```tsx
function Component() {
  const promise = fetchData() // ❌ 每次渲染都创建新 Promise
  const data = use(promise)    // 无限 suspend
}
```

**纠正**：Promise 必须缓存（模块级变量、useMemo、或 React Cache）。

### 复盘总结

**面试怎么答「React 19 有哪些重要新特性」：**

> 1. **Actions**：表单/异步操作的一等公民，自动管理 pending 状态
> 2. **use()**：在 render 中读取 Promise/Context，配合 Suspense
> 3. **useOptimistic**：简化乐观更新
> 4. **React Compiler**：编译期自动 memoization
> 5. **Server Components**：服务端组件（需框架支持）
> 6. **ref as prop**：ref 可以作为普通 prop 传递
> 7. **Document Metadata**：直接在组件中写 `<title>`、`<meta>`

**面试怎么答「use() 和 useEffect 的区别」：**

> use() 在 render 阶段同步读取资源，组件会 suspend 直到数据就绪；useEffect 在渲染后异步执行，需要配合 useState 管理 loading 状态。use() 配合 Suspense 提供了声明式的数据加载模式，是 React 向「数据预取 + Suspense」方向演进的标志。

**面试怎么答「useTransition 和 useDeferredValue 的区别」：**

> useTransition 标记「状态更新」为低优先级，返回 isPending 供 UI 展示；useDeferredValue 标记「值」为低优先级，延迟更新旧值。useTransition 控制「更新本身」，useDeferredValue 控制「值的传递」。共同点是都基于 React 18+ 的并发渲染，让高优先级更新可以打断低优先级更新。

---

## 主题六：React 与 Vue 核心差异对比总结

> 状态：完成 · 文档总结（无独立代码）

### 学习目标

串联前面五个主题的知识点，形成「React vs Vue」的完整对比框架，直接可用于面试回答。

### 核心对比

#### 1. 响应式机制

| 维度 | Vue 3 | React |
|------|-------|-------|
| 实现方式 | Proxy 拦截 get/set | 快照 + 重新执行函数 |
| 状态变化感知 | 自动追踪依赖 | 显式 setState 触发 |
| 更新粒度 | 组件级（通过编译器优化到节点级） | 组件级（Fiber + 并发调度） |
| 闭包陷阱 | 无 | 有（需函数式更新/ref） |
| 状态更新 | 赋值即触发 | setState 排队，批处理 |

**面试话术：**

> Vue 通过 Proxy 在运行时拦截属性访问，自动收集依赖；React 没有响应式拦截，状态变化通过 setState 通知 React 重新执行组件函数。这是两者最根本的设计差异，由此衍生出闭包陷阱、依赖数组、memoization 等 React 特有的概念。

#### 2. 渲染机制

| 维度 | Vue 3 | React |
|------|-------|-------|
| 虚拟 DOM | 编译器优化（静态标记、Block Tree） | Fiber 树（可中断、优先级调度） |
| Diff 算法 | 双端对比 + 静态提升 | 单端遍历 + 并发可中断 |
| 渲染调度 | 微任务批量（nextTick） | Scheduler 优先级调度 |
| 编译期优化 | 模板编译（静态分析） | React Compiler（19+） |

**面试话术：**

> Vue 的编译器在编译模板时做了大量静态分析（静态提升、预字符串化、patchFlag），运行时 diff 更快；React 的 JSX 太灵活，编译优化难度高，所以走了一条不同的路：Fiber 架构实现可中断渲染，React 19 的 Compiler 才开始补编译期优化。

#### 3. 组件通信

| 方式 | Vue 3 | React |
|------|-------|-------|
| 父子传值 | props + emit | props + 回调函数 |
| 跨层级 | provide/inject | Context |
| 全局状态 | Pinia | Zustand/Redux |
| 双向绑定 | v-model 语法糖 | 手动 onChange |
| 插槽 | slot / 具名插槽 / 作用域插槽 | children / render props |

**面试话术：**

> Vue 的通信更「声明式」：v-model 双向绑定、provide/inject 跨层级注入；React 更「函数式」：一切通过 props 传递，双向绑定要手动写 value + onChange。React 的 Context 和 Vue 的 provide/inject 概念相同，但 React Context 的 value 变化会导致所有消费者重新渲染，需要用 memo 或拆分 Context 优化。

#### 4. 逻辑复用

| 方式 | Vue 3 | React |
|------|-------|-------|
| 组合式 | composables（组合 ref/computed/watch） | 自定义 Hook（组合 useState/useEffect） |
| 依赖追踪 | 自动 | 手动声明依赖数组 |
| 状态隔离 | 取决于 ref 位置 | 每次调用独立 |
| 生命周期 | onMounted/onUnmounted | useEffect 返回清理函数 |

#### 5. 性能优化

| 优化手段 | Vue 3 | React |
|----------|-------|-------|
| 缓存计算 | computed（自动缓存） | useMemo（手动声明依赖） |
| 跳过渲染 | 编译器自动优化 | React.memo（手动） |
| 稳定引用 | 无需 | useCallback（手动） |
| 编译期优化 | 模板编译（内置） | React Compiler（19+） |
| 异步渲染 | 无（同步 diff） | useTransition/useDeferredValue |

**面试话术：**

> Vue 的优化大量内建于编译器和响应式系统，开发者基本不需要手动优化；React 18 之前优化主要靠开发者手动 memo/useMemo/useCallback，React 19 的 Compiler 正在自动化。但 React 的并发渲染（useTransition/useDeferredValue/Suspense）是 Vue 目前不具备的，这是 React 在复杂交互场景的优势。

### 面试高频追问

#### 追问 1：「你更熟悉 Vue，为什么面试 React 岗位？」

**回答框架：**

> 两者核心思想相通：组件化、声明式 UI、单向数据流、虚拟 DOM。我熟悉 Vue 的响应式原理，这帮助我更快理解 React 的渲染模型——Vue 是「自动追踪」，React 是「快照 + 重执行」。在 client 脚手架中我已经实践了 React 19 + TanStack Query + Zustand，核心机制都能说清楚。

#### 追问 2：「React 和 Vue 的 Diff 有什么区别？」

> Vue 3 的 diff 利用了编译期的静态标记（patchFlag），跳过静态节点，只 diff 动态部分；React 的 diff 是运行时单端遍历，但通过 Fiber 架构实现了可中断。Vue 优化的是「diff 速度」，React 优化的是「调度能力」。

#### 追问 3：「React 的 Fiber 和 Vue 的响应式谁更好？」

> 没有绝对优劣。Fiber 的优势在于大应用下的可中断渲染和优先级调度，避免长任务阻塞 UI；Vue 的响应式优势在于更细粒度的更新和更少的手动优化。React 适合复杂交互和大团队协作，Vue 适合快速开发和中小型项目。

### 复盘总结

**面试回答「React vs Vue」的万能框架：**

1. **响应式机制**：Proxy 自动追踪 vs 快照 + 重执行
2. **渲染调度**：同步 diff + 编译器优化 vs Fiber 可中断 + 优先级调度
3. **逻辑复用**：composables 自动追踪 vs Hooks 手动依赖
4. **性能优化**：内置自动 vs 手动 memo（React 19 后改善）
5. **生态和适用场景**：Vue 中小型、快速迭代；React 大型复杂、生态丰富

**关键结论（面试直接引用）：**

> 两者的设计哲学不同：Vue 追求「开发者体验」——响应式自动追踪、模板编译优化，让开发者少写代码；React 追求「可预测性」——显式 setState、不可变数据、函数式编程，让状态变化更容易追踪。理解这一点，就能解释两者所有 API 设计的差异。

---

## 学习进度总览

| 主题 | 完成日期 | 核心收获 |
|------|----------|----------|
| 1. Hooks 闭包陷阱与 setState | 2026-08-18 | 快照模型、批处理、函数式更新 |
| 2. useEffect 生命周期 | 2026-08-18 | 执行时机、依赖数组、清理函数 |
| 3. 自定义 Hook | 2026-08-18 | 逻辑复用、与 composables 对比 |
| 4. 渲染优化 | 2026-08-18 | memo/useMemo/useCallback 原理 |
| 5. React 19 新特性 | 2026-08-18 | Actions/use/useOptimistic/Compiler |
| 6. React vs Vue 对比 | 2026-08-18 | 响应式/渲染/通信/优化全维度 |

## 下一步建议

1. **运行代码验证**：`cd client && pnpm dev`，逐个访问 `/learn/*` 页面，实际体验闭包陷阱、useEffect 时序、渲染计数
2. **模拟面试检验**：让我用面试官追问风格，针对以上主题进行 React 模拟面试
3. **补充手写题**：React 手写题（useForm、虚拟列表、useRequest 等）可以作为下一轮学习
4. **深入 React Compiler**：阅读 React Compiler 源码/文档，理解编译期优化的边界条件

---

## 附录：学习过程中遇到的问题汇总

> 记录学习过程中实际遇到的概念困惑、环境提示和调试工具使用。

### 问题 1：Provider 怎么理解？

**问题**：项目中用了 ConfigProvider、QueryClientProvider，但 Provider 到底是什么意思？

**核心理解**：Provider 在组件树中创建一个「数据作用域」，让所有子组件不用层层传 props 就能直接拿到数据。

```
没有 Provider：App → Layout → Header → Button 逐层传 props
有 Provider：  <Provider value={data}> <Button /> </Provider> 直接用 useContext 取
```

**关键规则**：

- 就近原则：子组件拿到的是离它最近的 Provider 的值
- Provider 值变化 → 所有消费者重新渲染
- Provider 本身不渲染 DOM，是逻辑边界

**与 Vue 对比**：Vue `provide/inject` 概念相同，但 Vue 需要 `provide(ref)` 才能响应式更新；React Context 天然响应式，但所有消费者会重新渲染。

### 问题 2：控制台提示「development build of React」

**问题**：`pnpm dev` 启动后控制台提示 "This page is using the development build of React"。

**结论**：正常提示，不是错误。开发版包含调试代码，体积大、性能慢但有详细报错。生产部署前运行 `pnpm build`，Vite 自动用生产版 React 构建。

### 问题 3：React DevTools 的 Components 和 Profiler 面板

**问题**：控制台提示打开开发者工具后会出现 Components 和 Profiler 标签。

**用途**：

| 面板 | 用途 | 学习场景 |
|------|------|----------|
| Components | 查看组件树、props、state、hooks | 验证闭包陷阱中 state 是旧值 |
| Profiler | 录制渲染、分析性能 | 验证 memo 是否阻止了渲染 |

### 问题 4：usePrevious 的 React 19 规范问题

**问题**：经典 usePrevious 实现（用 useRef + useEffect）在 React 19 中是否还有问题？

**结论**：逻辑正确但不符合 React 19 规范。经典实现在 render 中读 `ref.current`，并发渲染下可能读到不一致的值。React 19 推荐用 useState + render 期间比较的模式（「adjusting state during render」）。

详见「主题三 → 踩坑记录 → 坑 2」的修正说明。
