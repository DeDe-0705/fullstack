# React 场景实战：Router + TanStack Query + Zustand + Redux

> 目标：用一个「商品列表 → 商品详情 → 购物车 → 结算下单」的电商小闭环，
> 把 React 面试里最常问的四个工程化能力串起来，讲清「每个库解决哪类问题、边界在哪、什么时候用哪个」。
>
> 可运行代码：`client/src/features/shop/`，路由入口 `/shop`。

## 一、场景地图与四库职责边界

```
商品列表(/shop) ──筛选放 URL──> 商品详情(/shop/product/:id)
      │                                │
      │  TanStack Query（服务端状态）    │
      └────────── 加入购物车 ───────────┘
                      │
                      ▼
                 购物车(/shop/cart)
                 Zustand（客户端 UI 状态，持久化）
                      │
                      ▼
                 结算(/shop/checkout)
                 Redux Toolkit（下单流程状态机）
```

| 库 | 管什么 | 为什么用它 | 典型场景 |
| --- | --- | --- | --- |
| React Router | 路由、动态参数、URL 状态 | URL 即状态，可分享/回退/刷新保持 | 页面导航、`/product/:id`、筛选条件 |
| TanStack Query | 服务端状态（数据 + 请求状态） | 自动缓存/失效/重试/loading/error，避免手写请求状态 | 商品列表、详情、下单写操作 |
| Zustand | 轻量客户端全局状态 | 无 Provider、selector 最小订阅、样板少 | 购物车、主题、登录会话 |
| Redux Toolkit | 复杂全局流程状态 | 单一 store、纯 reducer、中间件、devtools | 下单流程、复杂表单、多步向导 |

**一句话记忆：**
- 数据「从服务端来」→ TanStack Query；
- 状态「只在浏览器里，且跨组件共享、逻辑简单」→ Zustand；
- 状态「是全局流程、需要规范化和中间件、团队协作」→ Redux Toolkit；
- 状态「只属于当前 URL/页面、需要可分享可回退」→ 放进 URL（searchParams）。

## 二、React Router：URL 即状态

### 2.1 路由结构（嵌套 + 动态参数）

```tsx
{
  path: "shop",
  element: <ShopLayout />,        // 二级布局，负责导航 + Outlet
  children: [
    { index: true, element: <ProductList /> },
    {
      path: "product/:id",        // 动态参数
      loader: ({ params }) =>     // loader 预取
        queryClient.ensureQueryData(productDetailOptions(Number(params.id))),
      element: <ProductDetail />,
    },
    { path: "cart", element: <CartPage /> },
    { path: "checkout", element: <CheckoutPage /> },
  ],
}
```

### 2.2 筛选条件为什么放 searchParams 而不是 useState

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const category = searchParams.get('category') ?? undefined
```

- **可分享**：`/shop?category=数码` 复制给别人，对方打开就是同一筛选结果；
- **可回退**：浏览器前进/后退能回到上一个筛选；
- **可刷新**：刷新后筛选不丢；
- **可被 loader 读取**：SSR/预取阶段能拿到筛选条件。

而 `useState` 存的筛选状态刷新就没了，也无法从 URL 推断。面试常追问这一点。

## 三、TanStack Query：服务端状态

### 3.1 列表与详情分开缓存

```ts
export const productListOptions = (category?: string) =>
  queryOptions({
    queryKey: ['products', 'list', category ?? 'all'],  // key 编码筛选条件
    queryFn: () => fetchProducts(category),
    staleTime: 60_000,
  })

export const productDetailOptions = (id: number) =>
  queryOptions({
    queryKey: ['products', 'detail', id],              // key 精确到 id
    queryFn: () => fetchProduct(id),
    staleTime: 60_000,
  })
```

- 不同分类有独立缓存，切回旧分类直接命中缓存，不发请求；
- 列表页与详情页的缓存互不污染；
- `staleTime` 决定「多久内是新鲜的」，新鲜期内 `useQuery` 直接读缓存。

### 3.2 loader 预取 + useQuery 命中缓存

路由 loader 里 `queryClient.ensureQueryData(...)` 先把数据放进缓存，
组件内 `useQuery(productDetailOptions(id))` 再读同一份缓存，就不会闪 loading。
这是 React Router Data API 与 TanStack Query 结合的主流模式，面试加分项。

### 3.3 读数据的完整状态

```tsx
const { data, isPending, isError, error, refetch } = useQuery(productListOptions(category))
```

不用手动维护 `loading / error / data`，TanStack Query 帮你管好，还能失败重试。

## 四、Zustand：轻量客户端状态

### 4.1 购物车 store（含持久化）

```ts
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (productId) => set((state) => ({ ... })),
      // ...
    }),
    { name: 'shop-cart' },  // 自动同步到 localStorage
  ),
)
```

### 4.2 selector 最小订阅

```tsx
const addItem = useCartStore((s) => s.addItem)             // 只订阅 action，稳定引用
const cartCount = useCartStore((s) => selectCartCount(s.items)) // 只订阅派生 number
```

只有「订阅的切片」变化时组件才重渲染，这是 Zustand 比 Context 更适合全局状态的原因之一。

### 4.3 派生数据用函数算，不塞进 store

```ts
export function selectCartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}
```

避免「一份数据多处存」导致不同步：数量、合计都从 `items` 算出来，而不是再存一份 `total`。

## 五、Redux Toolkit：下单流程状态机

### 5.1 createAsyncThunk + extraReducers

```ts
export const submitOrderThunk = createAsyncThunk<Order, OrderPayload>(
  'orders/submit',
  submitOrder,          // 异步逻辑：调 mock 下单 API
)

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    resetOrderStatus(state) { state.status = 'idle' },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitOrderThunk.pending, (state) => { state.status = 'processing' })
      .addCase(submitOrderThunk.fulfilled, (state, action) => {
        state.status = 'success'
        state.currentOrder = action.payload
        state.history.unshift(action.payload)
      })
      .addCase(submitOrderThunk.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? '下单失败'
      })
  },
})
```

- `createAsyncThunk` 自动生成 `pending / fulfilled / rejected` 三个 action；
- `createSlice` 里可以直接「修改」`state`，因为 Immer 做了不可变拷贝；
- 下单流程就是标准状态机：`idle -> processing -> success / failed`。

### 5.2 组件里 dispatch 并解包结果

```tsx
const dispatch = useShopDispatch()

const submit = async () => {
  try {
    await dispatch(submitOrderThunk({ items, totalPrice: total, address })).unwrap()
    clear()  // 成功后清空购物车
  } catch {
    // rejected 分支由 extraReducers 写入 error，页面按状态渲染
  }
}
```

`unwrap()` 把 fulfilled 的结果解包出来；失败会抛错，页面状态仍由 Redux 决定。

## 六、高频面试问答

### Q1：Zustand 和 Redux 的本质区别？怎么选？

**答**：两者都是客户端全局状态管理，但哲学不同。

- **Redux** 强调「单一 store + 纯 reducer + 派发 action」，状态变化可预测、可追溯，适合复杂全局流程、多人协作、需要 devtools/中间件的场景；缺点是样板代码相对多。
- **Zustand** 用 `create` 生成一个 hook，组件按需订阅，无 Provider、样板少，适合轻量 UI 状态（主题、购物车、弹窗、会话）。

选型标准：**看状态的复杂度和团队规模**，而不是看名字。简单 UI 状态用 Zustand，复杂业务流程用 Redux Toolkit。

### Q2：TanStack Query 和 Redux 都管数据，有什么区别？

**答**：管的是两类不同状态。

- **TanStack Query 管服务端状态**：数据源在服务端，有缓存、失效、重试、竞态、loading/error 等「请求生命周期」；
- **Redux 管客户端状态**：数据源在浏览器，是应用运行时产生的 UI/流程状态。

不要用 Redux 去手写「请求三态 + 缓存失效」，那是重复造 TanStack Query 的轮子；也不要拿 TanStack Query 存纯 UI 状态，它没有这个职责。

### Q3：为什么筛选条件放 URL，而不是全局 store？

**答**：因为筛选是「当前页面的视图状态」，它天然和 URL 绑定，需要可分享、可回退、刷新保持。放 URL 还能让 loader 在渲染前拿到条件做预取。全局 store 适合「跨页面共享的客户端状态」，而筛选条件通常不需要跨页面共享。

### Q4：React Router 的 loader 是什么？和 useEffect 里请求有什么区别？

**答**：loader 是路由级别的数据加载函数，在「进入路由、渲染组件之前」执行，配合 `useLoaderData` 或缓存工具可以做到「数据先到、页面后渲染」，减少 loading 闪烁；而 `useEffect` 里的请求发生在组件渲染之后，会先渲染空壳再等数据，容易出现瀑布请求和闪烁。

## 七、项目关联话术（面试时挂上真实经验）

```
在理想汽车做 LiPeople 门户时，我实际处理过这类分层：
- 菜单、鉴权、路由用微前端基座统一管理，对应 React Router 的「URL 即状态 + 嵌套路由」；
- 服务端数据（人事/组织/薪酬）走统一请求层 + 缓存，对应 TanStack Query 的服务端状态；
- 用户偏好、临时筛选等 UI 状态用轻量 store，对应 Zustand；
- 涉及多步骤流程、需要可追踪的状态才用 Redux/流程型 store。

这套「服务端状态 / 客户端状态 / URL 状态」三分的思维，是我选型和设计的关键。
```

## 八、C 端场景扩展实操（可运行）

> 把 C 端最高频的「搜索联想」「Feed 无限滚动」也做成可运行 Demo，
> 路由入口 `/c-end`，代码在 `client/src/features/cend/`。

### 8.1 搜索联想：防抖 + 竞态 + 高亮

页面：`/c-end/search`，代码 [SearchPage.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/features/cend/SearchPage.tsx)。

三个 C 端高频点一次讲清：

1. **防抖**：`useDebounce(input, 300)`，用户停下 300ms 才发请求，减少请求量；
2. **竞态**：TanStack Query 的 `queryFn` 拿到 `signal`，新输入到来时自动 `abort` 旧请求，从根源避免「旧结果覆盖新结果」；
3. **高亮**：用 React 元素分段渲染 `<mark>`，而不是 `dangerouslySetInnerHTML`，避免 XSS。

```tsx
const debounced = useDebounce(input, 300)
const deferred = useDeferredValue(debounced)

const { data, isFetching } = useQuery({
  queryKey: ['search', deferred],
  queryFn: ({ signal }) => searchProducts(deferred, signal),
  enabled: deferred.trim().length > 0,
})
```

**高频追问：`useDeferredValue` 和 `useDebounce` 有什么区别？**

- `useDebounce` 是「延时更新值」，本质是减少请求/计算次数，值在 300ms 后才真正变化；
- `useDeferredValue` 是「把这次更新标记为低优先级」，值会尽快更新，但 React 优先渲染高优先级内容（输入框），结果列表在空闲时再渲染。
- 两者可以叠加：先用防抖减少请求，再用 `useDeferredValue` 让列表渲染不阻塞输入。

### 8.2 Feed 无限滚动：useInfiniteQuery + IntersectionObserver

页面：`/c-end/feed`，代码 [FeedPage.tsx](/Users/wangdeshi/Desktop/vibe_coding/client/src/features/cend/FeedPage.tsx)。

```tsx
const {
  data, fetchNextPage, hasNextPage, isFetchingNextPage, status,
} = useInfiniteQuery({
  queryKey: ['feed'],
  queryFn: ({ pageParam }) => fetchFeedPage(pageParam as number),
  initialPageParam: 0,
  getNextPageParam: (lastPage) => lastPage.nextCursor,  // 上一页返回下一页游标
})

const items = data?.pages.flatMap((page) => page.items) ?? []
```

- **游标分页**：`getNextPageParam` 用上一页的 `nextCursor` 作为下一页入参，返回 `null` 表示没有更多；
- **IntersectionObserver 哨兵**：观察底部一个 `div`，进入可视区就 `fetchNextPage()`，不用手动监听 `scroll` 计算距离；
- **预加载**：`rootMargin: '200px'` 提前 200px 触发，减少用户等待感；
- **`useInfiniteQuery` vs 普通 `useQuery`**：前者自动维护 `pages` 数组和分页游标，后者只适合单次请求。

### 8.3 秒杀 / 防重复下单：复用 Redux 状态机

秒杀的本质是一个状态机 + 幂等，不用单独造轮子，直接复用 Shop 场景里的 Redux 思路：

```
未开始 -> 可抢 -> 抢购中(pending) -> 成功(fulfilled) / 失败(rejected)
```

- **倒计时**：用服务端时间校准，`setInterval` + 卸载清理；
- **防重复**：点击后置灰 + 本地限频 + 前端生成 `requestId` 作为幂等键；
- **异步结果**：提交后轮询/长连接查询，而不是同步等接口返回。

这部分对应 [C端场景题-Vue与React](./C端场景题-Vue与React.md) 第 4 节「秒杀/活动页」，答题时把 Redux `createAsyncThunk` 的 `pending/fulfilled/rejected` 讲出来就是加分项。

## 来源（2026 检索）

- [2026前端面试题精选：大厂高频考点与标准答案](https://blog.csdn.net/weixin_47793882/article/details/161018287)
- [100 Essential React Interview Questions in 2026](https://raw.githubusercontent.com/Devinterview-io/react-interview-questions/main/README.md)
- [React Router + TanStack Query 数据预取（官方文档）](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [Redux Toolkit createAsyncThunk 官方文档](https://redux-toolkit.js.org/api/createAsyncThunk)
- [TanStack Query useInfiniteQuery 官方文档](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
