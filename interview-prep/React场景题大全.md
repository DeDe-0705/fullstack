# React 场景题大全（2026 大厂版）

> 覆盖 React 高频场景题的完整方案与解释。每个场景按「场景 → 考点 → 方案 → 面试话术」组织。
> 渲染性能和 Profiler 有专门文档，这里做精简 + 引用。

## 一、渲染性能

### 1.1 大列表 / 百万级数据渲染

**场景：** 渲染 1 万甚至百万条数据，首屏慢、滚动卡。

**考点：** 虚拟列表、减少渲染量。

**方案：**

1. **虚拟列表**：只渲染可视区 + overscan 缓冲，不渲染全量。定高用简单计算，不定高用动态测量 + 高度缓存（react-window / react-virtual / TanStack Virtual）；
2. **数据分页/懒加载**：接口不要一次返回百万条，分页或游标加载；
3. **memo + useCallback**：滚动时只重渲染新进入可视区的项。

**面试话术：** 大数据渲染先做虚拟列表，只渲染可视区，配合数据分页和 memo 减少无谓重渲染；定高好做，不定高要动态测量并缓存高度。

> 详细：[React场景题-渲染性能.md](./React场景题-渲染性能.md)

### 1.2 100 个图表大屏

**场景：** 大屏渲染 100+ 图表给老板看。

**考点：** 按需渲染、实例回收、Canvas。

**方案：**

1. `IntersectionObserver` 进入视口才初始化图表，滚出 `dispose()` 释放；
2. 限制同时实例数；
3. Canvas 优先于 SVG（海量数据）；
4. `echarts/core` 按需注册，图表库单独 vendor chunk。

**面试话术：** 大屏是「可见性驱动 + 按需渲染 + 可降级」：进入视口才 init、滚出 dispose、限制实例数、Canvas 优先、静态快照降级。

### 1.3 高频更新导致输入卡顿

**场景：** 搜索/实时数据高频更新，输入卡顿。

**考点：** useDeferredValue / useTransition、时间切片。

**方案：**

1. `useDeferredValue(value)`：让低优先级的派生值滞后更新，跳过中间态；
2. `useTransition`：手动标记重计算为非紧急；
3. 虚拟列表配合降低渲染量。

**面试话术：** 用 useDeferredValue 把结果渲染标为低优先级，配合时间切片让输入优先，连续输入时中间态被跳过，只渲染最新值。

## 二、状态设计

### 2.1 大表单状态管理

**场景：** 30 字段大表单，一个字段变化带动全表单 re-render。

**考点：** 状态局部化、组件拆分。

**方案：**

1. 每个字段拆成独立组件，各自 `useState`（状态局部化）；
2. 提交汇总：字段变化时 `onChange` 上报，父组件用 `useRef` 收集（不 re-render），提交时读 ref；
3. 生产用 react-hook-form（非受控 + register）。

**面试话术：** 状态局部化避免全表单 re-render，提交时通过 onChange 上报 + 父组件 useRef 汇总，生产用 react-hook-form。

> 详细代码：[React场景题-渲染性能.md](./React场景题-渲染性能.md) 第五节

### 2.2 状态提升导致全列表重渲染

**场景：** 点击一个列表项，整个列表都卡。

**考点：** 状态放错位置、默认 re-render。

**方案：**

1. 状态下沉：把「选中状态」放每个 item 内部，点击只 re-render 自己；
2. 单选互斥：用 store（Zustand）+ **selector 订阅布尔值**（`s.selectedId === myId`），只有选中状态变化的两项重渲染；
3. `memo + useCallback` 作为补充。

**面试话术：** 全列表重渲染的根因是状态提升 + 默认 re-render；把状态下沉，单选用 store + selector 精准订阅布尔值。

### 2.3 跨组件共享状态（Context vs Zustand vs Redux）

**场景：** 多个不相关组件需要共享同一份状态。

**考点：** 状态库选型、Context 的局限。

**方案：**

- **Context**：适合低频变化（主题、语言）；值一变所有消费者重渲染；
- **Zustand**：轻量，selector 精准订阅，适合客户端 UI 状态；
- **Redux Toolkit**：复杂全局流程、中间件、devtools，适合大型协作。

**面试话术：** Context 适合低频配置，值变化会带动所有消费者；需要精准订阅用 Zustand；复杂流程、多人协作用 Redux Toolkit。原则是「服务端状态用 TanStack Query，客户端状态按复杂度选 Context/Zustand/Redux」。

## 三、表单

### 3.1 受控 vs 非受控选型

**场景：** 表单字段需要实时校验还是提交时取一次。

**方案：**

- 需要实时校验/格式化/联动 → 受控（value + onChange）；
- 只在提交取一次、不关心输入过程 → 非受控（defaultValue + ref / FormData）；
- `input type=file` 只能非受控（value 只读，安全限制）。

**面试话术：** 受控数据源是 state，适合实时校验；非受控数据源是 DOM，适合提交取一次、性能敏感场景；文件上传天生非受控。

### 3.2 多步骤表单

**场景：** 分多步填写的表单，要保存中间状态、支持回退。

**方案：**

1. 每步一个组件，状态存在上层 store（Zustand），持久化到 localStorage；
2. 用 `useReducer` 管理步骤状态机（当前步、是否完成）；
3. 回退时从 store 恢复。

**面试话术：** 多步表单用 useReducer 管步骤状态机，数据放 store 并 persist 持久化，回退从 store 恢复。

## 四、搜索与输入

### 4.1 防抖 + 竞态

**场景：** 输入实时联想，要求不卡顿、不出现旧结果覆盖新结果。

**方案：**

1. `useDebounce` 300ms 减少请求；
2. `AbortController` 或 TanStack Query 的 signal 取消旧请求；
3. `useDeferredValue` 降低输入渲染压力。

**面试话术：** 防抖减少请求，AbortController 取消在途请求解决竞态，useDeferredValue 保输入流畅。

### 4.2 联想词 + 高亮

**方案：**

1. 结果高亮用 React 元素分段渲染 `<mark>`，不用 `dangerouslySetInnerHTML`（防 XSS）；
2. 缓存历史联想结果（LRU）。

## 五、列表

### 5.1 无限滚动（useInfiniteQuery）

**场景：** Feed 流、下拉加载更多。

**方案：**

```tsx
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['feed'],
  queryFn: ({ pageParam }) => fetchFeed(pageParam),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => lastPage.nextCursor, // 游标分页
})
```

底部哨兵用 `IntersectionObserver` 触发 `fetchNextPage`，`rootMargin: 200px` 提前加载。

### 5.2 分页表格

**方案：** 服务端分页 + TanStack Query 的 queryKey 带页码；切页时缓存命中则秒开；表格用 memo 避免整表重渲染。

## 六、数据请求

### 6.1 缓存 + 乐观更新

**场景：** 点赞/收藏，点击要立即反馈。

**方案（TanStack Query useMutation）：**

```tsx
useMutation({
  mutationFn: like,
  onMutate: async (id) => {          // 先改 UI
    await queryClient.cancelQueries(['post'])
    const prev = queryClient.getQueryData(['post'])
    queryClient.setQueryData(['post'], optimistic)
    return { prev }                   // 保存回滚快照
  },
  onError: (err, id, ctx) => queryClient.setQueryData(['post'], ctx.prev), // 失败回滚
})
```

**面试话术：** 乐观更新用 onMutate 先改 UI 并保存快照，失败 onError 回滚，成功 onSuccess 失效重取。

### 6.2 错误处理 + 重试

**方案：** TanStack Query 自带 `retry`；组件里用 Error Boundary 兜底；错误态 UI 独立，不整页崩溃。

## 七、错误边界

### 7.1 Error Boundary + 兜底

**场景：** 某个组件渲染报错，不能让整页白屏。

**方案：**

```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err, info) { reportError(err, info) }
  render() { return this.state.hasError ? <Fallback /> : this.props.children }
}
```

**考点：** Error Boundary 只能捕获子组件的**渲染错误**，捕获不了事件处理器、异步错误。函数组件用 `useErrorBoundary`（第三方）或 class。

## 八、路由与权限

### 8.1 路由守卫 + 权限

**方案：**

1. React Router 的 loader 里做鉴权（重定向未登录）；
2. 权限按钮级控制用组件封装 `<Auth role="admin">`；
3. 路由懒加载 `React.lazy` + Suspense。

### 8.2 懒加载 + 代码分割

```tsx
const Detail = lazy(() => import('./Detail'))
<Suspense fallback={<Loading />}><Detail /></Suspense>
```

路由级懒加载减小首屏体积。

## 九、SSR

### 9.1 SSR 场景 + hydration

**方案：**

1. SSR 首屏快、SEO 好，代价是服务器成本 + 水合复杂度；
2. hydration mismatch：不稳定值（随机数、`Date.now()`）放 `onMounted` / `<ClientOnly>`，稳定 id 用 `useId`；
3. 流式 SSR：Suspense + `renderToPipeableStream` 边渲染边输出。

## 十、组件设计

### 10.1 组件复用（自定义 Hook）

**场景：** 多个组件有相同的「状态 + 副作用」逻辑。

**方案：** 抽成自定义 Hook（`useOnlineStatus` / `useDebounce` / `useLocalStorage`），逻辑聚合复用。

### 10.2 受控 vs 非受控（组件 API 设计）

**方案：** 可复用的表单组件，最好同时支持受控和非受控（value + defaultValue），让调用方选择。

## 来源（2026 检索）

- [2026前端面试题精选：大厂高频考点与标准答案](https://blog.csdn.net/weixin_47793882/article/details/161018287)
- [Netflix React Interview Questions (2026)](https://www.greatfrontend.com/zh-CN/blog/netflix-react-interview-questions)
- [Top 30 Scenario-Based React Interview Questions (2026)](http://www.careeryoucare.in/2026/04/top-30-scenario-based-react-interview.html)
- [2026 前端面试趋势与 React 核心技术解析](http://cnnetsun.cn/a/4204331)
