# 多会话流式回答 — 全局调度方案

流式回答与页面渲染完全解耦：流由全局 store 统一调度，组件只读响应式状态。

## 结构

| 文件 | 职责 |
| --- | --- |
| `types.ts` | `Session` / `MessageItem` / `SessionStatus`（含 `queued`）等类型定义 |
| `Stream.ts` | 单会话流实例：发起问答、逐块写入 messageList、中断与错误处理（纯执行器，不管并发） |
| `scheduler.ts` | 信号量调度器：全局并发上限 6，FIFO 等待队列，支持排队取消与卸载清空 |
| `chatStore.ts` | 全局 store：会话注册、指针切换、两级调度（会话内串行 + 全局并发 6）、持久化与恢复、页面生命周期监听 |
| `fetcher.ts` | 流式接口适配器（示例，按业务接口替换） |

## 使用

```ts
import { ChatStore } from './chatStore';
import { chatFetcher } from './fetcher';

export const chatStore = new ChatStore(chatFetcher); // 自动恢复历史会话

// 发起问答（当前会话）
chatStore.ask({ question: '你好' });

// 切换会话 —— 后台的流不受影响，继续写各自的 messageList
chatStore.switchTo(otherId);

// 组件里直接消费响应式状态，无需订阅流
// const session = chatStore.currentSession.value
// session.messageList / session.status
```

## 关键行为

- **两级调度**：
  - 会话内串行 —— 同一 session 的多次 `ask` 挂到该会话 promise 链尾，消息严格有序，只占用一个全局名额；
  - 全局并发 6 —— 每个任务执行前 `acquire` 信号量，超额排队（session 呈 `queued` 态）。
- **排队可中断**：`abort` 对排队任务直接取消 acquire 等待，对运行中流走 AbortController；状态即时落到 `done`。
- **切换会话不中断流**：`switchTo` 只移动 `currentId` 指针，队列与运行中的流照常。
- **后台回答完成后自动落盘**：流结束时触发 `persist()`，切回来即见最新内容。
- **刷新 / 页面冻结**：`pagehide` + `visibilitychange` 统一中断在跑流、清空排队任务并保存残文；
  恢复时 `active`/`queued` 降级为 `done`，不会出现"幽灵排队"。跨刷新断点续传需服务端支持（SSE `Last-Event-ID` 或 offset）。
- **组件与流无订阅关系**：流直接写入 session 的 reactive 状态，组件读同一份状态。
- **并发上限取 6 的依据**：与浏览器 HTTP/1.1 单域名 6 连接对齐；接口走 HTTP/2 多路复用时此限制可放宽。
