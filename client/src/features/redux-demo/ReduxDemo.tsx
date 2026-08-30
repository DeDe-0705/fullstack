import { Provider } from "react-redux";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import {
  addTodo,
  removeTodo,
  selectAllTodos,
  selectDoneTodos,
  toggleTodo,
} from "./todoSlice";
import { decrement, increment, incrementByAmount, reset } from "./counterSlice";
import { fetchUser } from "./userSlice";
import { useAppDispatch, useAppSelector } from "./hooks";
import { reduxDemoStore } from "./store";
import { useGetPostsQuery } from "./api";

// 页面用独立的 Provider 包裹：main.tsx 已有一个 shop 的 Redux Provider，
// 这里局部覆盖，让 demo 的 useSelector 读到 reduxDemoStore（演示多个 store 隔离）
export function ReduxDemo() {
  return (
    <Provider store={reduxDemoStore}>
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: 16,
          display: "grid",
          gap: 16,
        }}
      >
        <Typography.Title level={3}>
          Redux Toolkit 全部核心用法
        </Typography.Title>
        <CounterPanel />
        <TodoPanel />
        <UserPanel />
        <PostsPanel />
      </div>
    </Provider>
  );
}

// 1. createSlice 基础 + Immer
function CounterPanel() {
  const value = useAppSelector((s) => s.counter.value);
  const dispatch = useAppDispatch();

  return (
    <Card title="① createSlice（基础 + Immer + PayloadAction）">
      <Space direction="vertical">
        <Typography.Text strong>count = {value}</Typography.Text>
        <Space>
          <Button onClick={() => dispatch(increment())}>+1</Button>
          <Button onClick={() => dispatch(decrement())}>-1</Button>
          <Button onClick={() => dispatch(incrementByAmount(5))}>
            +5（带 payload）
          </Button>
          <Button onClick={() => dispatch(reset())}>重置</Button>
        </Space>
        <Typography.Text type="secondary">
          reducer 里直接改 state（Immer 内部做不可变），actions 自动生成
        </Typography.Text>
      </Space>
    </Card>
  );
}

// 2. createEntityAdapter + createSelector
function TodoPanel() {
  const todos = useAppSelector(selectAllTodos);
  const doneTodos = useAppSelector(selectDoneTodos);
  const dispatch = useAppDispatch();
  const [text, setText] = useState("");

  return (
    <Card title="② createEntityAdapter + createSelector（实体管理 + 记忆化 selector）">
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <Input
            value={text}
            placeholder="输入待办"
            onChange={(e) => setText(e.target.value)}
            onPressEnter={() => {
              if (text.trim()) {
                dispatch(addTodo({ id: Date.now(), text, done: false }));
                setText("");
              }
            }}
          />
          <Button
            type="primary"
            onClick={() => {
              if (text.trim()) {
                dispatch(addTodo({ id: Date.now(), text, done: false }));
                setText("");
              }
            }}
          >
            添加
          </Button>
        </Space>
        <List
          size="small"
          bordered
          dataSource={todos}
          renderItem={(todo) => (
            <List.Item
              actions={[
                <Button
                  key="toggle"
                  type="link"
                  onClick={() =>
                    dispatch(
                      toggleTodo({
                        id: todo.id,
                        changes: { done: !todo.done },
                      }),
                    )
                  }
                >
                  {todo.done ? "标记未完成" : "标记完成"}
                </Button>,
                <Button
                  key="del"
                  type="link"
                  danger
                  onClick={() => dispatch(removeTodo(todo.id))}
                >
                  删除
                </Button>,
              ]}
            >
              <Typography.Text delete={todo.done}>{todo.text}</Typography.Text>
            </List.Item>
          )}
        />
        <Typography.Text type="secondary">
          已完成 {doneTodos.length} 条（selectDoneTodos 是 createSelector
          记忆化结果）
        </Typography.Text>
      </Space>
    </Card>
  );
}

// 3. createAsyncThunk + extraReducers（异步三态）
function UserPanel() {
  const user = useAppSelector((s) => s.user.user);
  const status = useAppSelector((s) => s.user.status);
  const error = useAppSelector((s) => s.user.error);
  const dispatch = useAppDispatch();

  return (
    <Card title="③ createAsyncThunk + extraReducers（异步 pending/fulfilled/rejected）">
      <Space direction="vertical">
        <Button
          loading={status === "loading"}
          onClick={() => dispatch(fetchUser(1))}
        >
          加载用户（模拟 800ms 请求）
        </Button>
        {status === "loading" && <Spin size="small" />}
        {status === "succeeded" && (
          <Alert type="success" message={`加载成功：${user?.name}`} />
        )}
        {status === "failed" && (
          <Alert type="error" message={error ?? "失败"} />
        )}
      </Space>
    </Card>
  );
}

// 4. RTK Query createApi（服务端状态 + 缓存）
function PostsPanel() {
  const { data, isFetching, isError } = useGetPostsQuery();
  return (
    <Card title="④ RTK Query createApi（服务端状态、自动缓存 + loading/error）">
      {isFetching && <Spin size="small" />}
      {isError && <Alert type="error" message="加载失败（需 server 启动）" />}
      {data && (
        <List
          size="small"
          dataSource={data}
          renderItem={(post) => (
            <List.Item>
              <Tag color="blue">#{post.id}</Tag> {post.title}
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
