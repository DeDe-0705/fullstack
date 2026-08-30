import { configureStore } from '@reduxjs/toolkit'
import { counterReducer } from './counterSlice'
import { todoReducer } from './todoSlice'
import { userReducer } from './userSlice'
import { api } from './api'

// configureStore：组合所有 reducer + 自动加入 Redux DevTools + 中间件
export const reduxDemoStore = configureStore({
  reducer: {
    counter: counterReducer,
    todos: todoReducer,
    user: userReducer,
    [api.reducerPath]: api.reducer, // RTK Query 的 reducer
  },
  // 多个 store 时给 DevTools 命名，方便在扩展里区分
  devTools: { name: 'redux-demo' },
  // RTK Query 需要它的 middleware（缓存、失效、乐观更新）
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
})

export type RootState = ReturnType<typeof reduxDemoStore.getState>
export type AppDispatch = typeof reduxDemoStore.dispatch
