# TanStack Query 核心：useQuery / useMutation

> 面向 React 数据请求的面试专题，结合本仓库 `client/` 真实代码。TanStack Query（原 React Query）负责管理「服务端状态」。

---

## 一、定位：服务端状态管理

和 Zustand/Redux 这类「客户端状态」不同，TanStack Query 专门管「服务端状态」：请求缓存、去重、后台刷新、失效重取、乐观更新。

一句话：**服务端数据用 TanStack Query，客户端 UI 状态用 Zustand**。

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

写入成功后，读缓存里的旧数据已过时。`queryClient.invalidateQueries({ queryKey })` 会把匹配的 query 标记为 stale 并触发重新拉取，保证「写后读到最新数据」。

三种让缓存更新的方式：

1. **invalidateQueries**（最常用）：标记失效 → 后台重取。
2. **setQueryData**：手动直接改缓存（乐观更新用）。
3. **refetchQueries / removeQueries**：显式重取 / 删除。

---

## 五、高频考点速查

1. **useMutation 和 useQuery 区别？** → 写 vs 读；手动命令式 vs 自动声明式；不缓存 vs 缓存。
2. **useMutation 的生命周期？** → onMutate → mutationFn → onSuccess/onError → onSettled。
3. **写完数据后列表怎么更新？** → onSuccess 里 invalidateQueries 让缓存失效重取。
4. **什么是乐观更新？怎么回滚？** → onMutate 先改缓存 + 备份 context，onError 用 context 回滚，onSettled 最终 invalidate 对齐。
5. **mutate 和 mutateAsync 区别？** → mutate 返回 undefined，mutateAsync 返回 Promise。
