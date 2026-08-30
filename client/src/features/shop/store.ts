import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import type { TypedUseSelectorHook } from 'react-redux'
import { orderReducer } from './orderSlice'

// Redux 的「单一数据源」：整个应用只有这一个 store。
// 这里只放「需要全局流程状态」的订单模块，轻量 UI 状态留给 Zustand，服务端状态留给 TanStack Query
export const shopStore = configureStore({
  reducer: {
    orders: orderReducer,
  },
  // 多个 store 时给 DevTools 命名，方便在扩展里区分
  devTools: { name: 'shop' },
})

export type ShopRootState = ReturnType<typeof shopStore.getState>
export type ShopAppDispatch = typeof shopStore.dispatch

// 带类型的 hooks：避免在组件里到处写 (state: RootState) => ...，也保证 action 类型安全
export const useShopDispatch: () => ShopAppDispatch = useDispatch
export const useShopSelector: TypedUseSelectorHook<ShopRootState> = useSelector
