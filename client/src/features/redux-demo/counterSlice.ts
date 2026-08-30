import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface CounterState {
  value: number
}

// createSlice：最基础的用法，自动生成 actions 和 reducer
// Immer 让你在 reducer 里「直接改」state，实际是做了不可变拷贝
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 } as CounterState,
  reducers: {
    increment(state) {
      state.value += 1 // 看起来是直接改，实际 Immer 内部不可变
    },
    decrement(state) {
      state.value -= 1
    },
    // PayloadAction 带参数
    incrementByAmount(state, action: PayloadAction<number>) {
      state.value += action.payload
    },
    reset(state) {
      state.value = 0
    },
  },
})

export const { increment, decrement, incrementByAmount, reset } = counterSlice.actions
export const counterReducer = counterSlice.reducer
