# TanStack Query 核心：useQuery / useMutation

> 面向 React 数据请求的面试专题，结合本仓库 `client/` 真实代码。TanStack Query（原 React Query）负责管理「服务端状态」。

---

## 一、定位：服务端状态管理

和 Zustand/Redux 这类「客户端状态」不同，TanStack Query 专门管「服务端状态」：请求缓存、去重、后台刷新、失效重取、乐观更新。

一句话：**服务端数据用 TanStack Query，客户端 UI 状态用 Zustand**。

### 1.1 如何区分客户端状态 vs 服务端状态

核心判断标准：**这份数据的权威源头在哪里，谁说了算。**

- **服务端状态**：源头在服务器 / 数据库，前端只是缓存快照，可能过期，需要失效重取、后台同步、多端一致。例如商品列表、用户信息、文章内容。
- **客户端状态**：源头在当前浏览器 / 会话，不需要与服务端同步，刷新后可能丢失。例如当前 tab、主题、表单草稿、搜索关键词。

| 维度 | 服务端状态 | 客户端状态 |
|---|---|---|
| 数据源头 | 服务器 / 数据库 | 当前浏览器会话 |
| 会不会过期 | 会，需要失效重取 | 不会 |
| 要不要同步 | 要 | 不要 |
| 谁管理 | TanStack Query / SWR | Zustand / Redux / Context |
| 例子 | 商品列表、用户信息 | 主题、tab、购物车本地草稿 |

判断口诀：

1. 「服务器上这个数据变了，我这边要不要跟着变？」要 → 服务端状态。
2. 「刷新页面后，应该从服务器重新拿，还是从本地恢复？」从服务器 → 服务端状态。
3. 「这个状态只属于这台设备、当前用户当前操作吗？」是 → 客户端状态。

容易混淆的点：登录态要拆开看——「当前是否登录」的 UI 标志可放客户端状态；「用户资料 / 权限」是服务端状态，应用 TanStack Query 拉取。

---

## 二、useQuery —— 读（GET）

```tsx
const { data, isPending, isError, error, isFetching } = useQuery({
  queryKey: ['posts', 'list'],
  queryFn: () => fetchPosts(),
})
```

- `isPending`：首次加载中
- `isFetching`：任何请求中（含后台刷新，此时缓存仍可用）
- `isError` / `error`：失败状态

---

## 三、useMutation —— 写（POST/PUT/DELETE）

### 3.1 和 useQuery 的本质区别

| | useQuery | useMutation |
| --- | --- | --- |
| 方向 | 读（GET） | 写（增删改） |
| 执行方式 | 自动、声明式（挂载即执行） | 手动、命令式（调 `mutate` 才执行） |
| 缓存 | 有缓存、去重、自动重取 | 不缓存结果 |
| 触发时机 | 组件挂载 / 依赖变化 | 用户操作（点击提交） |

### 3.2 完整生命周期

```text
onMutate（请求前，乐观更新）→ mutationFn（发请求）→ onSuccess / onError → onSettled（收尾）
```

关键回调：

- `mutationFn`：真正执行变更的函数
- `onMutate`：请求前执行，可返回 `context` 供失败时回滚
- `onSuccess`：成功后，通常 `invalidateQueries` 让缓存失效
- `onError`：失败后，可用 `context` 回滚
- `onSettled`：无论成败都执行（关闭 loading、最终对齐服务端）

### 3.3 结合本仓库 Posts.tsx

```tsx
const mutation = useMutation({
  mutationFn: createPost,      // 发 POST 新增帖子
  onSuccess: () => {
    // 让列表缓存失效，自动触发重新拉取（面试高频）
    queryClient.invalidateQueries({ queryKey: ['posts', 'list'] })
    message.success('发布成功')
    form.resetFields()
  },
  onError: (err) => message.error(`发布失败：${err.message}`),
})

// 用户提交时手动触发
<Button loading={mutation.isPending} onClick={() => mutation.mutate(formData)}>
  发布
</Button>
```

### 3.4 乐观更新（进阶，面试高频）

先立刻更新 UI，服务器确认失败再回滚：

```tsx
const mutation = useMutation({
  mutationFn: addTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] })  // 防止并发的后台刷新覆盖乐观数据
    const previous = queryClient.getQueryData(['todos'])       // 备份旧数据
    queryClient.setQueryData(['todos'], (old) => [...old, newTodo]) // 乐观更新
    return { previous }                                        // 返回 context
  },
  onError: (_err, _newTodo, context) => {
    queryClient.setQueryData(['todos'], context.previous)      // 失败回滚
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] })     // 最终和服务端对齐
  },
})
```

### 3.5 mutate vs mutateAsync

- `mutate`：返回 `undefined`（fire-and-forget），用 `onSuccess`/`onError` 处理结果。
- `mutateAsync`：返回 `Promise`，可以 `await` 拿到结果，但需要自己 try/catch。

### 3.6 常用状态字段

| 字段 | 含义 |
| --- | --- |
| `isIdle` | 尚未触发 |
| `isPending` / `isLoading` | 请求进行中 |
| `isSuccess` | 成功 |
| `isError` | 失败 |
| `data` / `error` | 结果 / 错误对象 |

---

## 四、invalidateQueries：写后同步读缓存

写入成功后，读缓存里的旧数据已过时。`queryClient.invalidateQueries({ queryKey })` 会把匹配的 query 标记为 stale（失效），保证「写后读到最新数据」。

注意：invalidateQueries 本身**只是标记失效**，真正重新发请求是后续自动行为，且默认只对「活跃」的 query 生效：

- 活跃的 query（当前有组件挂载订阅）→ 立即自动重新拉取
- 非活跃的 query → 只标记失效，等下次有组件用它时才拉取（可用 `refetchType: 'all'` 强制全部重取）

queryKey 支持前缀匹配：`invalidateQueries({ queryKey: ['posts'] })` 会匹配 `['posts','list']`、`['posts','detail',1]` 等所有以 `['posts']` 开头的 key。

三种让缓存更新的方式：

1. **invalidateQueries**（最常用）：标记失效 → 后台重取。
2. **setQueryData**：手动直接改缓存（乐观更新用）。
3. **refetchQueries / removeQueries**：显式重取 / 删除。

---

## 五、QueryClient：缓存中枢

QueryClient 是 TanStack Query 的**中央缓存管理器**，所有查询缓存、失效、预取都由它负责。通过 `QueryClientProvider` 注入 React 树，`useQuery` / `useMutation` 内部通过 context 拿到它。

### 5.1 配置（结合本仓库 queryClient.ts）

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,  // 30s 内数据视为新鲜，切页回来不重新请求
      retry: 1,
    },
  },
})
```

### 5.2 staleTime vs gcTime（面试高频）

| 参数 | 含义 | 默认 |
| --- | --- | --- |
| `staleTime` | 数据多久后变「陈旧(stale)」，陈旧后下次挂载/聚焦会后台刷新，**不清缓存** | 0（每次挂载都拉） |
| `gcTime` | 缓存保留时长，超过且**无人订阅**时被垃圾回收（v5 名，原名 cacheTime） | 5 分钟 |

关键点：

- `gcTime` 只在「没有活跃订阅者（组件已卸载）」后才开始计时；组件挂载期间它不起作用。
- 通常要求 `gcTime >= staleTime`，否则数据可能还没被用到就被回收。

### 5.3 核心方法

| 方法 | 作用 |
| --- | --- |
| `getQueryData(key)` | 同步读缓存 |
| `setQueryData(key, data)` | 直接写缓存（乐观更新用） |
| `invalidateQueries(key)` | 标记失效 → 触发重取 |
| `prefetchQuery(key, fn)` | 预取数据放入缓存（路由预加载） |
| `cancelQueries(key)` | 取消进行中的请求 |
| `removeQueries` / `clear` | 删除缓存 |

### 5.4 注入 React 树

```tsx
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

---

## 六、高频考点速查

1. **useMutation 和 useQuery 区别？** → 写 vs 读；手动命令式 vs 自动声明式；不缓存 vs 缓存。
2. **useMutation 的生命周期？** → onMutate → mutationFn → onSuccess/onError → onSettled。
3. **写完数据后列表怎么更新？** → onSuccess 里 invalidateQueries 让缓存失效重取。
4. **什么是乐观更新？怎么回滚？** → onMutate 先改缓存 + 备份 context，onError 用 context 回滚，onSettled 最终 invalidate 对齐。
5. **mutate 和 mutateAsync 区别？** → mutate 返回 undefined，mutateAsync 返回 Promise。
6. **staleTime 和 gcTime 区别？** → staleTime 决定数据多久变陈旧（触发后台刷新，不清缓存）；gcTime 决定缓存多久后被回收（只在无订阅者时计时）。
7. **QueryClient 是什么？** → 中央缓存管理器，负责缓存、失效、预取，通过 QueryClientProvider 注入。

---

## 附录：竞态隔离与占位数据（2026-09-06 面试盲区补档）

### 1. Query 天然处理竞态的机制：queryKey 隔离（不是 AbortController！）

```js
useQuery({
  queryKey: ['search', keyword],  // keyword 变 = 换一个缓存槽位
  queryFn: ({ signal }) => fetch(`/api/search?q=${keyword}`, { signal }).then(r => r.json()),
});
```

- 快速输入时每个关键词是**独立缓存槽位**：旧请求（如「手环」）响应回来写入的是旧槽位 `['search','手环']`，而组件当前订阅 `['search','小米手环']`——**读不到旧数据，错乱在数据结构上不存在**
- `signal` 是 queryFn context 自带的 AbortSignal，传给 fetch 后 Query 会在查询失效/重新发起时**自动 abort**——作用是**省带宽**，不是防错乱
- 准确表述：取消逻辑不用手写（传 signal 即可）；竞态正确性由 queryKey 隔离保证，取消只是优化

### 2. placeholderData：旧数据占位防闪烁

```js
import { keepPreviousData } from '@tanstack/react-query';
useQuery({ queryKey: ['search', keyword], queryFn, placeholderData: keepPreviousData });
// v4 写法：keepPreviousData: true；v5 函数式：placeholderData: (prev) => prev
```

- 新 key 数据未回前**继续展示上一 key 的数据**，列表不闪空 loading
- **术语精确**：`placeholderData` 只是占位展示，**不写入缓存**；`initialData` 会当真数据写进缓存——两者别混
