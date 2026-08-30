# Zustand 与 React Router 用法（数据路由 + 状态管理）

> 以 `client/` 脚手架为实践样本，整理 Zustand 状态管理和 React Router v7 数据路由的用法、中间件、loader 预取与常见陷阱。面向高级前端面试和日常开发。

---

## 一、状态分类总纲

先分清“什么状态放哪”，这是面试和架构设计的底层逻辑：

| 状态类型 | 放哪 | 例子 |
|---|---|---|
| 服务端状态 | TanStack Query / SWR | 商品列表、详情、接口缓存 |
| 客户端 UI 状态 | Zustand / Context | 登录态、主题、购物车、表单草稿、UI 开关 |
| URL 状态 | Router searchParams / path | 筛选条件、分页、当前路由 |
| 表单状态 | React Hook Form / 自研 | 受控表单、校验 |
| 复杂领域状态、需要时间旅行 | Redux Toolkit | 严格约束、多人协作的业务状态机 |

核心原则：**服务端数据不要塞进 Redux/Zustand**，容易产生 stale bug；客户端 UI 状态也不要放服务端缓存库。

---

## 二、Zustand

### 2.1 create 与 selector

```ts
import { create } from 'zustand'

interface CounterState {
  count: number
  increment: () => void
}

export const useCounterStore = create<CounterState>()((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}))
```

组件里用 selector 订阅最小切片：

```ts
const count = useCounterStore((s) => s.count)
const increment = useCounterStore((s) => s.increment)
```

关键点：**不要一次性解构整个 store**，否则任何字段变化都重渲染；selector 返回的引用要稳定。

### 2.2 set 与 get

- `set((state) => ...)`：基于最新 state 计算新值，避免闭包拿到旧值。
- `get()`：在 action、异步回调、组件外读取最新状态，只读、不订阅、不触发更新。
- 组件外读用 `useStore.getState()`，组件内响应式订阅用 `useStore(selector)`。

```ts
create<State>((set, get) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  double: () => set({ count: get().count * 2 }),
}))
```

### 2.3 派生数据不要存进 store

可计算出来的值用普通函数在外部计算，避免“一份数据多处存”导致不一致：

```ts
export function selectCartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}
```

### 2.4 persist：持久化

```ts
import { persist, createJSONStorage } from 'zustand/middleware'

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({ items: [], add: (id) => set((s) => ({ items: [...s.items, id] })) }),
    {
      name: 'shop-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }), // 只持久化数据字段
      version: 1,
    },
  ),
)
```

要点：只存可序列化数据；SSR 下 `localStorage` 不可用，需要 `skipHydration` 或手动 `rehydrate`；store 上会挂 `.persist` API（`rehydrate`、`clearStorage`、`hasHydrated`）。

### 2.5 subscribeWithSelector：精准订阅

默认 `subscribe(listener)` 监听整个 store；`subscribeWithSelector` 让 `subscribe` 支持 selector：

```ts
import { subscribeWithSelector } from 'zustand/middleware'

const useStore = create<State>()(
  subscribeWithSelector((set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
  })),
)

const unsubscribe = useStore.subscribe(
  (s) => s.count,
  (count, prevCount) => console.log(prevCount, '->', count),
)
```

用途：React 之外监听某个字段变化、执行副作用、与第三方库集成。

### 2.6 immer：可变写法

先安装 `immer`，再用中间件，`set` 里可以直接改 draft：

```ts
import { immer } from 'zustand/middleware/immer'

const useStore = create<State>()(
  immer((set) => ({
    nested: { count: 0 },
    increment: () => set((state) => { state.nested.count += 1 }),
  })),
)
```

适合深层嵌套更新；简单 `set({ count: 1 })` 或高频敏感场景不必引入。

### 2.7 自定义中间件：logger

中间件本质是「接收 `StateCreator`，返回新的 `StateCreator`」，通过包一层 `set` 注入逻辑：

```ts
import type { StateCreator, StoreMutatorIdentifier } from 'zustand'

type Logger = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string,
) => StateCreator<T, Mps, Mcs>

type LoggerImpl = <T>(
  f: StateCreator<T, [], []>,
  name?: string,
) => StateCreator<T, [], []>

const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
  const loggedSet: typeof set = (...args) => {
    const prev = get()
    set(...(args as Parameters<typeof set>))
    console.log(`[${name ?? 'store'}]`, { prev, next: get() })
  }
  return f(loggedSet, get, store)
}

export const logger = loggerImpl as unknown as Logger
```

### 2.8 中间件组合顺序

顺序有讲究，推荐从外到内：

```ts
persist(devtools(subscribeWithSelector(immer(...))))
```

- `persist` 放最外层，序列化最终状态到 storage。
- `devtools` 用于 Redux DevTools 调试。
- `subscribeWithSelector` 需要拿到不可变状态做精准订阅。
- `immer` 放最里层，把可变写法转换成不可变状态。

### 2.9 常见陷阱

- selector 返回新对象/数组引用 → 每次都重渲染甚至无限循环；用原子 selector 或 `useShallow`。
- 组件里用 `useStore.getState()` 读取 → 不会订阅，状态变化不重渲染。
- 服务端数据放进 Zustand → 缓存、失效、重取都要手写，交给 TanStack Query。

---

## 三、React Router v7（数据路由 Data Mode）

### 3.1 三种模式

| 模式 | 用法 | 适用 |
|---|---|---|
| Declarative | `<BrowserRouter>` + `<Routes>` | 纯声明式、无数据加载 |
| Data | `createBrowserRouter` + `RouterProvider` | SPA 数据路由，loader/action |
| Framework | Vite 插件 + 文件路由 | 全栈/SSR/类型安全路由 |

`client/` 用的是 Data Mode。

### 3.2 路由对象与 RouteObject

```tsx
import { createBrowserRouter } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'posts', element: <Posts /> },
      { path: 'posts/:id', element: <PostDetail /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
```

`routes` 的类型是 `RouteObject[]`；自定义数据用 `handle` 字段挂载，而不是像 Vue Router 那样有内置 `meta`。

### 3.3 Outlet / Link / useNavigate / useSearchParams

- `Outlet`：子路由渲染的出口，父布局里放 `<Outlet />`，切换子路由时只换这里的内容，父布局复用。
- `Link`：声明式导航，更新 URL 触发重新匹配，不整页刷新。
- `useNavigate()`：编程式跳转。
- `useSearchParams()`：把筛选/分页等状态放进 URL，可分享、可回退、刷新保持。

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const category = searchParams.get('category') ?? undefined
```

### 3.4 loader 预取 + TanStack Query

路由 loader 在组件渲染前预取数据，配合 TanStack Query 缓存避免 loading 闪烁：

```tsx
{
  path: 'posts/:id',
  loader: ({ params }) =>
    queryClient.ensureQueryData(postDetailOptions(Number(params.id))),
  element: <PostDetail />,
}
```

组件里用相同的 `queryKey` 调用 `useQuery`，直接命中缓存：

```tsx
const { data } = useQuery(productDetailOptions(productId))
```

核心：`queryKey` 是数据的唯一身份标识，`loader` 预取和组件读取必须用同一份 options。

### 3.5 useMatches + handle：菜单 / 面包屑

路由对象用 `handle` 挂菜单元数据，`useMatches()` 读取当前匹配链：

```ts
type MenuMeta = { label: string; hideInMenu?: boolean }

{
  path: 'posts',
  handle: { menu: { label: '帖子' } },
  element: <Posts />,
}
```

```tsx
const matches = useMatches()
const selectedMatch = [...matches]
  .reverse()
  .find((m) => (m.handle as { menu?: MenuMeta } | undefined)?.menu)
```

完整菜单可以从 `routes` 递归生成，让路由配置成为菜单的唯一数据源。

### 3.6 路由与菜单单一数据源

避免在布局里再手写一份 path：路由树里通过 `handle.menu` 声明菜单，用工具函数把路由树转成菜单项，`Layout` 里直接消费。

---

## 四、面试高频问答

**Q：Zustand 和 Redux 的本质区别？**

不是“集中 vs 分散”，而是约束程度和心智模型：Redux 用 action/reducer 强制单向数据流、可预测、可回放；Zustand 用 hook + set，追求最小样板和灵活订阅。服务端状态统一交给 TanStack Query。

**Q：什么时候新建一个 Zustand store？**

出现以下信号：同一份状态被多个不相关组件读写、props drilling 很深、状态跨路由/刷新保留、需要 DevTools 追踪。组件内临时值用 `useState`，服务端数据用 TanStack Query。

**Q：`set((state) => ...)` 和 `get()` 有什么区别？**

`set` 回调里的 `state` 是更新时的基准状态，用于基于旧值原子更新；`get()` 随时读最新快照，不触发更新，常用于 action 内“先读再决定”和组件外逻辑。

**Q：React Router 的 `Outlet` 是干嘛的？**

它是子路由的渲染出口。嵌套路由的父组件里放 `<Outlet />`，匹配到的子路由元素就渲染在这里；父布局复用，只替换 Outlet 内容。

**Q：Data Mode 的 `loader` 和 `useEffect` 拉数据有什么区别？**

`loader` 在路由切换时并行、提前执行，数据准备好才渲染目标路由，避免先渲染再请求的 loading 瀑布；配合 `queryClient.ensureQueryData` 还能预取缓存。

---

## 五、来源

- Zustand 官方文档：`persist`、`subscribeWithSelector`、`immer`、自定义中间件类型签名
- React Router 官方文档《Using handle》：`handle` + `useMatches` 的元数据扩展模式
- React Router v7 迁移与 Data Mode 教程：`createBrowserRouter`、`loader`、三种模式
- 2025–2026 状态管理趋势：服务端状态用 TanStack Query、客户端状态用 Zustand/Context、表单用 RHF
