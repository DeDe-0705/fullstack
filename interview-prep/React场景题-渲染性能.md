# React 场景题 — 渲染性能（大数据渲染 + 时间切片）

> 场景题最容易把两个维度混在一起：**大数据渲染**和**时间切片**。
> 前者解决「渲染量太大」，后者解决「渲染耗时阻塞交互」。面试先分清这一点，再给方案。

## 一、定位：两类问题，两个维度

| | 大数据渲染 | 时间切片 |
| --- | --- | --- |
| 解决什么问题 | 渲染节点太多，总量大 | 渲染耗时长，阻塞交互 |
| 手段 | 虚拟列表 / 分批渲染 / Canvas | useTransition / useDeferredValue |
| 本质 | 减少工作量 | 让出主线程保交互 |

一句话：大数据渲染是「少干点」，时间切片是「让主线程能喘口气」。两者经常配合，但不能互相替代。

## 二、大数据渲染场景

### 2.1 虚拟列表（定高 / 不定高）

**定高虚拟列表**（核心：只渲染可视区 + 缓冲区）：

```tsx
const startIndex = Math.floor(scrollTop / itemHeight)
const visibleCount = Math.ceil(viewportHeight / itemHeight)
const endIndex = startIndex + visibleCount + overscan
```

- 总高度 = `itemHeight * count`，用撑高层撑出滚动条；
- 滚动时计算 `startIndex/endIndex`，只渲染这一段；
- 用 `transform: translateY(offsetY)` 定位可视区。

> 可运行 Demo：[FixedVirtualList.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/pages/learn/FixedVirtualList.tsx)

**不定高虚拟列表（详细原理）**：动态测量每项高度 + 高度缓存 + 预估位置。库：`react-window` / `react-virtual` / `TanStack Virtual`。

和定高的本质区别：定高是「位置 = index × itemHeight」一步算出；不定高每项高度未知，位置 = 前面所有项高度的**前缀和**，不能 O(1) 定位。

四个步骤：

1. **预估高度**：初始按 `ESTIMATED_HEIGHT` 估算每项高度，算出粗略位置；
2. **实测修正**：`ResizeObserver` 测量渲染项的真实 DOM 高度，写进缓存；
3. **前缀和重算**：实测高度变化后重算 `positions`（每项 top/bottom），后续项位置动态修正；
4. **二分查找**：根据 `scrollTop` 用二分找到起始/结束 index（O(log n)）。

```tsx
// 前缀和：实测高度优先，未测量用预估
const positions = useMemo(() => {
  let top = 0
  return items.map((_, i) => {
    const height = measuredHeights[i] ?? ESTIMATED_HEIGHT
    const pos = { index: i, top, height, bottom: top + height }
    top += height
    return pos
  })
}, [items, measuredHeights])

// 二分查找起始 index：第一个 bottom > scrollTop
```

**一句话：** 不定高虚拟滚动 = 预估高度 + ResizeObserver 实测修正 + 前缀和定位 + 二分查找。

> 可运行 Demo：[VariableVirtualList.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/pages/learn/VariableVirtualList.tsx)

### 2.2 分批渲染（时间分片）

把 1 万条数据拆成多批，用 `requestIdleCallback` / `requestAnimationFrame` 逐批渲染，避免一次性长任务卡死：

```tsx
function renderInBatches(list, batchSize) {
  let i = 0
  function next() {
    const batch = list.slice(i, i + batchSize)
    append(batch)
    i += batchSize
    if (i < list.length) requestIdleCallback(next)
  }
  requestIdleCallback(next)
}
```

### 2.3 Canvas 替代 DOM

海量节点（图表、热力图、散点图）用 Canvas 绘制，避免成千上万个 DOM 节点。适合「重展示、轻交互」的场景。

### 2.4 IntersectionObserver 懒加载 + 回收

进入视口才初始化，滚出视口 `dispose` 释放实例和事件，控制「同时存在的渲染单元数量」。

## 三、时间切片场景

时间切片解决「响应性」，核心是**把渲染标成低优先级，让输入/点击等紧急更新插队**。

### 3.1 大结果集渲染阻塞输入（时间切片的典型场景）

```tsx
const [input, setInput] = useState('')
const deferredInput = useDeferredValue(input) // 低优先级

<input value={input} onChange={e => setInput(e.target.value)} />
<SearchResults query={deferredInput} />
```

前提是「**结果量巨大导致渲染耗时**」：比如一次渲染 5000 条结果要 200ms，占满主线程，输入框卡死。输入框用 `input`（紧急、立即更新），结果列表用 `deferredInput`（可中断、低优先级），配合时间切片让主线程在渲染结果之间继续响应输入。

**注意「搜索卡顿」有两层，别混：**

- 网络层：请求慢、旧结果覆盖新结果 → 防抖 + AbortController（与时间切片无关）；
- 渲染层：结果量大、渲染耗时阻塞输入 → useDeferredValue + 时间切片（这才是时间切片）。

### 3.2 大列表渲染 + 用户交互

```tsx
const [isPending, startTransition] = useTransition()

startTransition(() => {
  setBigData(newData) // 低优先级，可中断，让点击/滚动优先
})
```

### 3.3 实时数据高频更新

实时数据（股票/监控）高频刷新时，`useDeferredValue` 跳过中间态，只渲染最新值，避免每 100ms 一次的重渲染打满主线程。

## 四、完整方案（两者配合，面试这样答）

以「搜索框 + 5000 条结果」为例：

```
① 防抖：减少无效请求（网络层）
② useDeferredValue：结果渲染标为低优先级（时间切片保交互）
③ 虚拟列表：只渲染可视区（降低渲染量）
④ memo / useMemo：减少无谓子组件渲染
```

四层分别解决：请求量、响应性、渲染量、重复计算。

## 五、大表单状态设计（组件拆分 + useRef 汇总）

**核心矛盾：** 状态局部化（字段自己 useState）性能好，但提交时字段值散落；状态提升（都放父组件）提交方便，但全表单 re-render。

**解法：字段内部持有状态（局部），同时通过 onChange 上报，父组件用 `useRef` 收集（不触发 re-render），提交时从 ref 读全部。**

```tsx
// 父组件：useRef 收集值，不 setState，不 re-render
function BigForm() {
  const valuesRef = useRef<Record<string, string>>({})

  const handleFieldChange = useCallback((name: string, value: string) => {
    valuesRef.current[name] = value // 只写 ref
  }, [])

  const handleSubmit = () => submitApi(valuesRef.current)

  return (
    <form onSubmit={handleSubmit}>
      <NameField onChange={handleFieldChange} />
      <AgeField onChange={handleFieldChange} />
    </form>
  )
}

// 字段组件：自己 useState，变化时上报
function NameField({ onChange }: { onChange: (name: string, v: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <input
      value={value}
      onChange={(e) => {
        setValue(e.target.value)          // 局部更新，只有本字段 re-render
        onChange('name', e.target.value)  // 上报，父组件只写 ref
      }}
    />
  )
}
```

**方案对比：**

| 方案 | 性能 | 汇总 | 适用 |
| --- | --- | --- | --- |
| 受控提升（全放父组件） | ❌ 全表单 re-render | ✅ | 字段少 |
| 非受控 + FormData | ✅ | ✅ | 提交取一次、不需实时校验 |
| 字段局部 useState + 父组件 useRef 汇总 | ✅ | ✅ | 推荐（兼顾两者） |
| Zustand + selector | ✅ | ✅ | 跨组件共享复杂状态 |
| react-hook-form | ✅ 最好 | ✅ | 生产首选（非受控 + register） |

**面试话术：** 大表单要兼顾「字段变化不带动全表单」和「提交能汇总」，用状态局部化 + 上报汇总：字段自己 useState，变化时 onChange 上报，父组件 useRef 收集（不 re-render），提交读 ref。生产里用 react-hook-form，内部就是非受控 + 提交统一取值。

## 六、和 Vue 对照

| | React | Vue |
| --- | --- | --- |
| 大数据渲染 | 虚拟列表 / react-window / TanStack Virtual | 虚拟列表 / v-memo / shallowRef |
| 交互保响应 | useTransition / useDeferredValue | 依赖收集精准更新，天然不易卡 |
| 优化方式 | 手动 memo + React Compiler 自动 | 响应式自动优化 |

## 七、面试话术模板

> 大数据渲染和时间切片是两个维度：前者用虚拟列表/分批/Canvas 减少渲染量，后者用 useTransition/useDeferredValue 把长渲染标成低优先级，配合可中断 + 时间切片让交互优先。搜索卡顿这种场景，我会四层一起做：防抖减请求、useDeferredValue 保输入流畅、虚拟列表减节点、memo 减重复渲染。注意时间切片只对并发更新生效，普通 setState 不可中断，它也不减少总耗时，只解决卡死。

## 来源（2026 检索）

- [React Compiler in 2026: Automatic Memoization & Interview Questions](https://sharpskill.dev/en/blog/react-next/react-compiler-2026-automatic-memoization-interview-questions)
- [Frontend Engineering in 2026: Mastering Performance and DX](https://dev.to/aindrila_bhattacharjee_0f/frontend-engineering-in-2026-mastering-performance-and-dx-3ogm)
- [React Coding Interview Questions 2026](https://playcode.io/blog/react-coding-interview-questions-2026)
