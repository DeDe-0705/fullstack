/**
 * 聊天流式会话 — 类型定义
 */

export type SessionStatus =
  | 'idle'
  | 'queued' // 已入队，等待并发名额（或排在本会话上一问之后）
  | 'active'
  | 'done'
  | 'error';

export interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** 是否已完成。assistant 消息在流式写入中为 false */
  done: boolean;
  error?: string;
  createdAt: number;
}

export interface Meta {
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: number;
  status: SessionStatus;
  messageList: MessageItem[];
  meta: Meta;
  stream: Stream;
}

/** 流发起的问答请求参数 */
export interface AskPayload {
  question: string;
  [key: string]: unknown;
}

/** 流式接口适配器：实际项目里替换成你的 SSE / fetch 实现 */
export type StreamFetcher = (
  payload: AskPayload,
  signal: AbortSignal
) => Promise<ReadableStream<Uint8Array>>;

/** 会话级取消信号：store 的调度循环监听它跳过/中止任务 */
export interface CancelToken {
  cancelled: boolean;
}

/** 持久化到 localStorage 的快照（不含 stream 实例） */
export interface SessionSnapshot {
  id: number;
  status: SessionStatus;
  messageList: MessageItem[];
  meta: Meta;
}

// 前向引用，真实定义在 Stream.ts
import type { Stream } from './Stream';
