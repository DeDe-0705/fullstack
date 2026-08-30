import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { submitOrder } from './mockApi'
import type { Order, OrderPayload } from './types'

// 下单流程的状态机：idle -> processing -> success / failed
export type OrderStatus = 'idle' | 'processing' | 'success' | 'failed'

interface OrderState {
  status: OrderStatus
  error?: string
  currentOrder?: Order
  history: Order[]
}

const initialState: OrderState = {
  status: 'idle',
  history: [],
}

// createAsyncThunk：自动生成 pending / fulfilled / rejected 三个 action，
// 异步逻辑（调用 mock 下单 API）写在这里，成功后返回 Order
export const submitOrderThunk = createAsyncThunk<Order, OrderPayload>(
  'orders/submit',
  submitOrder,
)

// createSlice 里可以直接「修改」state，因为 Immer 内部做了不可变拷贝 ——
// 这是 Redux Toolkit 相比传统 Redux 最大的 DX 提升
const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    resetOrderStatus (state) {
      state.status = 'idle'
      state.error = undefined
      state.currentOrder = undefined
    },
    setOrderStatus (state, action) {
      state.status = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitOrderThunk.pending, (state) => {
        state.status = 'processing'
        state.error = undefined
      })
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

export const { resetOrderStatus } = orderSlice.actions
export const orderReducer = orderSlice.reducer
