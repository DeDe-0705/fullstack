import {
  createEntityAdapter,
  createSelector,
  createSlice,
  type EntityState,
} from '@reduxjs/toolkit'

export interface Todo {
  id: number
  text: string
  done: boolean
}

// createEntityAdapter：规范化管理实体集合（byId + ids），内置 CRUD reducer
const todosAdapter = createEntityAdapter<Todo>()

const todoSlice = createSlice({
  name: 'todos',
  initialState: todosAdapter.getInitialState(),
  reducers: {
    // adapter 提供的 reducer 可以直接作为 slice 的 reducer
    addTodo: todosAdapter.addOne,
    toggleTodo: todosAdapter.updateOne,
    removeTodo: todosAdapter.removeOne,
  },
})

export const { addTodo, toggleTodo, removeTodo } = todoSlice.actions
export const todoReducer = todoSlice.reducer

// selector：从 root state 取 todos 切片
const selectTodosState = (state: { todos: EntityState<Todo, number> }) => state.todos

// adapter 自带的 selector：selectAll / selectById
export const { selectAll: selectAllTodos, selectById: selectTodoById } =
  todosAdapter.getSelectors(selectTodosState)

// createSelector：记忆化派生数据，输入不变则不重算
export const selectDoneTodos = createSelector(selectAllTodos, (todos) =>
  todos.filter((t) => t.done),
)

export const selectUndoneTodos = createSelector(selectAllTodos, (todos) =>
  todos.filter((t) => !t.done),
)
