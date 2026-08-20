import type {
  Message,
  MessageUsage,
} from '../../database/entities/message.entity';

// Agent 编排层的领域类型：service 入参、工具轨迹、SSE 流式事件。
// HTTP 请求体见 dto/，供应商协议见 providers/model-provider.ts

export interface AgentChatInput {
  userId: string;
  conversationId?: string;
  message: string;
  /** 用户选择的供应商，缺省走默认（当前为 deepseek） */
  provider?: string;
}

export interface AgentToolTrace {
  name: string;
  arguments: string;
  result: string;
}

export interface AgentDonePayload {
  conversationId: string;
  toolCalls: AgentToolTrace[];
  /** 整轮（可能含多轮工具调用）聚合后的 token 用量 */
  usage: MessageUsage | null;
  /** 思考耗时：首次 reasoning 增量到首次 content 增量的毫秒数 */
  thinkingMs: number | null;
  /** 落库后的完整消息（含 status/tokenUsage/toolCalls 等元信息），前端直接写入缓存 */
  assistantMessage: Omit<Message, 'conversation'>;
}

export type AgentStreamEvent =
  | { kind: 'ready'; conversationId: string }
  | { kind: 'reasoning'; delta: string }
  | { kind: 'content'; delta: string }
  | { kind: 'tool'; name: string; arguments: string; result: string }
  | { kind: 'usage'; usage: MessageUsage }
  | ({ kind: 'done' } & AgentDonePayload);
