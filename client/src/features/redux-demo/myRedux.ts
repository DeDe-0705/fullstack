import { createSlice, configureStore } from "@reduxjs/toolkit";

interface IState {
  count: number;
}

const initialState: IState = {
  count: 0,
}

const demoSlic = createSlice({
  name: "demo",
  initialState, // 初始状态
  reducers: {
    increment: (state) => {
      state.count += 1;
    },
    decrement: (state) => {
      state.count -= 1;
    },
    // // 可以接受额外参数的 reducer 函数
    incrementByAmount: (state, action) => {
      state.count += action.payload;
    }
  }
})
// 通过increment, decrement, incrementByAmount派发动作
// 通过counterSlice.reducer处理动作


// configureStore 函数的作用是创建一个 Redux store。
// 它接受一个包含 reducer 函数和其他配置选项的对象，并返回一个 Redux store 实例。
// getState()：用于获取当前的状态。
// dispatch(action)：用于派发一个动作，以触发状态的更新。
// subscribe(listener)：用于添加一个状态变化的监听器，当状态发生变化时会被调用。
// replaceReducer(nextReducer)：用于替换当前的 reducer。
