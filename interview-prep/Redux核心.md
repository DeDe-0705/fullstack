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
