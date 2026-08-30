import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

interface User {
  id: number
  name: string
}

interface UserState {
  user: User | null
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
}

// createAsyncThunk：自动生成 pending / fulfilled / rejected 三个 action
// 异步逻辑写在这里（演示用模拟延迟，生产里换成真实请求）
export const fetchUser = createAsyncThunk<User, number>(
  'user/fetch',
  async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { id, name: `用户 ${id}` }
  },
)

const userSlice = createSlice({
  name: 'user',
  initialState: { user: null, status: 'idle', error: null } as UserState,
  reducers: {},
  // extraReducers：处理 createAsyncThunk 的三个状态
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user = action.payload
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.error.message ?? '请求失败'
      })
  },
})

export const userReducer = userSlice.reducer
