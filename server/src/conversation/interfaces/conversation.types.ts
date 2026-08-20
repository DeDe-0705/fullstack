import type {
  MessageRole,
  MessageStatus,
  MessageToolCall,
  MessageUsage,
} from '../../database/entities/message.entity';

// Conversation 模块的领域类型：分页结构与 service 入参

export interface Page<T> {
  items: T[];
  total: number;
}

// 落库消息的可选元信息：状态、token 用量、思考耗时、供应商、模型、工具轨迹（仅 assistant 消息使用）
export interface AddMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  reasoning?: string | null;
  status?: MessageStatus;
  tokenUsage?: MessageUsage | null;
  thinkingMs?: number | null;
  provider?: string | null;
  model?: string | null;
  toolCalls?: MessageToolCall[] | null;
}
