# Redux 核心（含 Redux Toolkit）

> 面向 React 状态管理的面试专题。现代项目基本都用 Redux Toolkit（RTK），不再手写 createStore/switch。

---

## 一、三大原则

1. **单一数据源（Single Source of Truth）**：整个应用的状态存在一个 store 里。
2. **State 只读**：唯一改法是 `dispatch(action)`，不能直接改 state。
3. **Reducer 是纯函数**：`(state, action) => newState`，同输入必同输出、无副作用。

---

## 二、单向数据流

```text
View（用户操作）→ dispatch(action) → Reducer → 新 state → Store → 触发 View 重渲染
```

数据只朝一个方向流动，状态变化可预测、可追踪、可调试（时间旅行）。

---

## 三、核心概念

| 概念 | 作用 |
| --- | --- |
| Store | 全局唯一状态容器 |
| Action | 描述「发生了什么」的对象 `{ type, payload }` |
| Reducer | 纯函数，根据 action 计算新 state |
| Dispatch | 触发 action 的方法 |
| Selector | 从 store 里取数据的函数 |
| Middleware | 中间件，处理副作用/异步（如 thunk） |

---

## 四、Redux Toolkit 现代写法

### 4.1 createSlice + configureStore

```js
// counterSlice.js
import { createSlice } from '@reduxjs/toolkit'

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1 },          // 看着像「可变」，实际走 Immer
    incrementBy: (state, action) => { state.value += action.payload },
  },
})

export const { increment, incrementBy } = counterSlice.actions
export default counterSlice.reducer
```

```js
// store.js
import { configureStore } from '@reduxjs/toolkit'
import counterReducer from './counterSlice'

export const store = configureStore({
  reducer: { counter: counterReducer },
})
```

```jsx
// 组件
import { useSelector, useDispatch } from 'react-redux'

const value = useSelector((state) => state.counter.value)
const dispatch = useDispatch()

dispatch(increment())
```

关键点：

- `createSlice` 用 `name + reducer 名` 自动生成 action type（如 `counter/increment`），免手写常量。
- `configureStore` 内置 thunk、Redux DevTools、immutable 检查。
- **Immer**：RTK 内置，reducer 里能写「可变」语法，底层自动做不可变更新。

### 4.2 reducers vs extraReducers

- `reducers`：本 slice 自己定义的同步 action。
- `extraReducers`：处理**外部** action，最常见是 `createAsyncThunk` 生成的 pending/fulfilled/rejected。

### 4.3 RTK 完整数据流闭环

```
createSlice(name, initialState, reducers, extraReducers)
  ├─ actions：同步 action creator（如 resetOrderStatus）
  └─ reducer：交给 store

createAsyncThunk
  └─ thunk action creator（如 submitOrderThunk）

configureStore({ reducer: { orders: orderReducer } })
  └─ store

useDispatch / useSelector
  ├─ dispatch(action)  → 改 state
  └─ selector(state)   → 读 state
```

两条触发路径：

```ts
// 同步 action：来自 orderSlice.actions
dispatch(resetOrderStatus())

// 异步 thunk：由 createAsyncThunk 单独导出
dispatch(submitOrderThunk({ items, totalPrice, address }))
```

关键点：

- action creator 只负责「描述发生了什么」，不会改 state。
- 只有 `dispatch` 才会让 reducer 执行、更新 state。
- 读 state 用 selector，且应订阅最小切片，避免整树重渲染。

面试标准回答（一句话链路）：

> 先用 `createSlice` 定义 `name / initialState / reducers`，自动生成 `actions` 和 `reducer`；再用 `configureStore` 把各 slice 的 reducer 组合成全局 store。改状态必须 `dispatch(action)`，action 来自 `slice.actions`（同步）或 `createAsyncThunk`（异步三态交给 `extraReducers` 处理）；读状态用 `useSelector` 按需订阅切片。这套严格约束换来 state 只读、reducer 纯函数、单向数据流，最终实现可预测、可调试、可时间旅行。

### 4.4 react-redux：Provider / useDispatch / useSelector 与多 store

`react-redux` 的三个关键角色：

- `Provider`：把 store 注入 React Context，子组件才能通过 hooks 访问。
- `useDispatch`：从**最近的 Provider** 取出 `store.dispatch`，返回 dispatch 函数。
- `useSelector`：订阅 store 中的某个 state 切片。

关键认知：

1. **`useDispatch` 不知道 store 里有哪些 reducer**。reducer 是在 `configureStore` 里决定的，`useDispatch` 只是从 Context 拿 dispatch。
2. **多 store 靠 Provider 嵌套隔离**，不是靠 hook 声明。内层 Provider 会覆盖外层：

```tsx
// main.tsx：全局 shopStore
<Provider store={shopStore}>
  {/* ReduxDemo 内部再包一层，局部覆盖 */}
  <Provider store={reduxDemoStore}>...</Provider>
</Provider>
```

3. **typed hooks 是类型标注，不是绑定 store**：

```ts
export const useShopDispatch: () => ShopAppDispatch = useDispatch
export const useShopSelector: TypedUseSelectorHook<ShopRootState> = useSelector
```

这不会改变运行时行为，只是告诉 TypeScript dispatch 和 state 的类型；运行时仍由最近的 Provider 决定。

4. **直接使用 `useDispatch` 能跑，但会丢类型**：默认返回 `Dispatch<UnknownAction>`，`createAsyncThunk` 的 `.unwrap()` 类型推断不准确，`useSelector` 也要每处手写 `RootState`。多 store 场景应分别为每个 store 封装 typed hooks。

react-redux v9.1+ 的现代写法：

```ts
export const useShopDispatch = useDispatch.withTypes<ShopAppDispatch>()
export const useShopSelector = useSelector.withTypes<ShopRootState>()
```

### 4.5 在 React 组件外访问 store

Redux store 本身不依赖 React，是普通 JS 对象。组件内用 hooks，组件外可以直接操作 store 实例。

```ts
import { shopStore } from './store'
import { resetOrderStatus } from './orderSlice'

function externalHelper() {
  // 读：拿当前状态快照
  const status = shopStore.getState().orders.status

  // 写：派发 action
  shopStore.dispatch(resetOrderStatus())
}
```

需要监听变化时手动订阅：

```ts
const unsubscribe = shopStore.subscribe(() => {
  console.log('状态变了：', shopStore.getState().orders.status)
})
```

`createAsyncThunk` 内部也能通过第二个参数访问：

```ts
const thunk = createAsyncThunk('orders/submit', async (payload, { getState, dispatch }) => {
  const state = getState() as RootState
  dispatch(someOtherAction())
})
```

适用场景：axios 拦截器、WebSocket 回调、定时任务、工具函数、单元测试。

注意：外部 `getState()` 只拿快照，不会自动触发 React 重渲染；组件内仍应使用 `useSelector/useDispatch` 以获得响应式订阅。

### 4.6 extraReducers 响应外部 action 与跨 slice 联动

`extraReducers` 不限于 `createAsyncThunk`，它处理的是「本 slice 自己 `reducers` 之外的 action」，常见场景：

1. `createAsyncThunk` 的 `pending/fulfilled/rejected` 三态。
2. 其他 slice 的同步 action（跨 slice 联动）。
3. 手动派发的全局 action（如 reset）。
4. RTK Query 生成的 action，通常用 `builder.addMatcher`。
5. 用 `addMatcher` 统一匹配一类 action（如所有 `/rejected`）。

跨 slice 联动示例：

```ts
// authSlice 导出同步 action creator
export const { logout } = authSlice.actions

// cartSlice 在 extraReducers 里响应 logout
import { logout } from '../auth/authSlice'

extraReducers: (builder) => {
  builder.addCase(logout, (state) => {
    state.items = []
  })
}
```

关键结论：

- **响应方 slice 必须注册进 store**，否则它的 reducer 不会被调用，无法响应。
- **被引用 action 的来源 slice 不一定注册**：`logout` 只是 action creator，匹配靠 `action.type` 字符串，不靠来源 slice 是否注册。
- `dispatch(action)` 是「广播通知」：store 会把 action 传给所有已注册的 reducer，只有内部匹配了该 `action.type` 的 reducer 才会更新状态，其余原样返回。

---

## 五、异步：createAsyncThunk

`createAsyncThunk` 自动把一个异步请求拆成「三态」：

```js
const fetchUser = createAsyncThunk('user/fetch', async (id) => {
  return await api.getUser(id)
})

const userSlice = createSlice({
  name: 'user',
  initialState: { data: null, loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => { state.loading = true })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
  },
})
```

面试要点：`createAsyncThunk` 自动派发 `pending / fulfilled / rejected` 三个 action，在 `extraReducers` 里用 builder 链式处理。

### 5.1 与 extraReducers 搭配的三个细节

1. **action type 前缀**：`createAsyncThunk` 的第一个参数是前缀，自动生成 `前缀/pending`、`前缀/fulfilled`、`前缀/rejected`。
2. **拿结果**：
   - `fulfilled`：`action.payload` 是 thunk 返回值。
   - `rejected`：`action.error` 是错误对象；如需自定义错误值，用 `rejectWithValue`。
3. **组件里 dispatch 返回 Promise**：`await dispatch(thunk).unwrap()`，成功返回 fulfilled 值，失败抛错；错误通常交给 extraReducers 写进 state，组件用 selector 读取。

`rejectWithValue` 示例：

```js
const submitOrder = createAsyncThunk(
  'orders/submit',
  async (payload, { rejectWithValue }) => {
    try {
      return await api.submit(payload)
    } catch (err) {
      return rejectWithValue(err.message)
    }
  },
)

extraReducers: (builder) => {
  builder.addCase(submitOrder.rejected, (state, action) => {
    // 使用 rejectWithValue 时，自定义错误在 action.payload
    state.error = action.payload
  })
}
```

---

## 六、中间件：thunk vs saga

| | redux-thunk | redux-saga |
| --- | --- | --- |
| 实现 | action 返回一个函数 | 基于 Generator 的副作用函数 |
| 写法 | 在 action creator 里写异步 | 用 saga 监听、分离副作用 |
| 学习成本 | 低 | 高（几十个 API） |
| 适用 | 大多数场景，RTK 已内置 | 复杂副作用编排、竞态/取消 |

---

## 七、Redux vs Zustand

| | Redux Toolkit | Zustand |
| --- | --- | --- |
| 约束 | 强制 action → reducer 管道 | 无强制约束，直接 set |
| 模板代码 | 较多 | 极简 |
| DevTools / 中间件 | 完善 | 支持但轻量 |
| 适用 | 大型团队、复杂中间件 | 中小型应用 |

> 面试话术：两者都基于 `useSyncExternalStore` 支持精准订阅，本质区别是「约束程度」。Redux 用强制约束换可预测性，Zustand 用放弃约束换极简。

---

## 八、高频考点速查

1. **三大原则？** → 单一数据源、state 只读、reducer 纯函数。
2. **为什么 reducer 必须是纯函数？** → 可预测、可时间旅行调试、便于 diff 比较。
3. **单向数据流？** → view → dispatch → reducer → store → view。
4. **createSlice 怎么生成 action type？** → `name + reducer 名` 自动拼接。
5. **reducers 和 extraReducers 区别？** → 前者处理本 slice 同步 action，后者处理外部 action（如 createAsyncThunk）。
6. **createAsyncThunk 的三态？** → pending / fulfilled / rejected。
7. **thunk 和 saga 区别？** → thunk 函数式轻量，saga 基于 Generator 重编排。

---

## 来源

- Redux 面试全解析（三大原则、纯函数）：https://www.yuque.com/guluguluwater-qkq0t/qbbqks/gc7gfphra19aezl7
- Redux Toolkit 源码架构（createSlice/createAsyncThunk 三态）：https://juejin.cn/post/7521160007855095843
- EasyInterview Redux 面试指南（createSlice action type、extraReducers）：https://easyinterview.me/blogs/the-interview-questions-that-matter/redux-interview-guide

---

## 附录：immer 与 createAsyncThunk 机理深挖（2026-09-06 面试盲区补档）

### 1. immer 工作原理（三件套必背：Proxy + copy-on-write + 结构共享）

`createSlice` 的 reducers 里 `state.count++` 不违反不可变原则——state 是 immer 的 draft：

```
produce(baseState, recipe)：
1. draft = Proxy(baseState)
2. recipe 里的写操作被 Proxy 拦截 → copy-on-write：
   只复制【被修改路径上的节点】再改，未触碰的分支保持原引用
3. 返回新对象 —— 结构共享（structural sharing）
4. 特例：draft 未被修改 → 直接返回原 state（白送的 bailout）
```

一句话：写的是**可变语法**，产出的是**不可变更新**。

### 2. Redux 为什么坚持不可变（根只有一条：引用比较）

- **根本原因**：useSelector/connect 用 `===` 浅比较判断切片变没变。直接改原对象 → 引用不变 → 判定没变 → **UI 不更新**（Redux 最常见 bug）
- 衍生好处（都建立在"引用变 = 内容变"上）：时间旅行调试、任意时点快照可信、memo/pure render 成立
- immer 结构共享恰好保证该等式：没变的分支引用不变，变了的路径引用必新

### 3. createAsyncThunk 三态为什么在 extraReducers

- `pending/fulfilled/rejected` 是 thunk **运行时自动 dispatch** 的 action，不是组件手动 dispatch 的
- `reducers` 收**本 slice 的同步 action**；`extraReducers` 收**外部 action**（thunk 三态、其他 slice 的 action）
- 更本质：Redux 约定 **reducer 必须同步纯函数**，异步逻辑属于 action 层；三态是异步操作的生命周期事件，天然归 extraReducers
