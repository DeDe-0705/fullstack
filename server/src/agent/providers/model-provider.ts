import type { MessageUsage } from '../../database/entities/message.entity';

// 模型供应商抽象层：供应商无关的领域类型 + 统一接口。
// 各家 API 的 wire 格式（snake_case、字段命名差异）只允许出现在各自的 service 内部，
// 出了 service 边界一律是这里定义的领域格式，AgentService 只依赖 ModelProvider。

/** 工具调用（领域格式）：供应商的 tool_calls[].function 结构拍平后的形态 */
export interface ChatToolCall {
  id: string;
  name: string;
  /** 模型生成的 JSON 参数原文，可能非法，执行前需自行解析校验 */
  arguments: string;
}

/** 对话消息（领域格式）：assistant 的 toolCalls / tool 的 toolCallId 用 camelCase */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** assistant 消息携带：本轮模型请求的工具调用 */
  toolCalls?: ChatToolCall[];
  /** tool 消息携带：对应的工具调用 id，供应商靠它对号入座 */
  toolCallId?: string;
}

/** 工具定义（领域格式），由各供应商 service 转成自己的 wire 格式 */
export interface ModelToolDefinition {
  name: string;
  description: string;
  /** JSON Schema，省略表示参数为空 */
  parameters: Record<string, unknown>;
}

/** 流式事件（领域格式）：reasoning/content 为增量，tool_calls 流式结束后一次性输出完整调用 */
export type ModelStreamEvent =
  | { kind: 'reasoning'; delta: string }
  | { kind: 'content'; delta: string }
  | { kind: 'tool_calls'; toolCalls: ChatToolCall[] }
  | { kind: 'usage'; usage: MessageUsage };

export interface ModelChatResult {
  content: string;
  reasoning: string;
  toolCalls: ChatToolCall[];
  usage: MessageUsage | null;
}

/** 每个供应商 service 实现此接口，AgentService 通过注册表按 provider 名取用 */
export interface ModelProvider {
  /** 供应商标识：deepseek/kimi/minimax 等，同时作为注册表的 key */
  readonly provider: string;
  /** 当前使用的模型名，落库到消息元信息 */
  readonly model: string;
  chat(
    messages: ChatMessage[],
    tools: ModelToolDefinition[],
  ): Promise<ModelChatResult>;
  streamChat(
    messages: ChatMessage[],
    tools: ModelToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<ModelStreamEvent>;
}

/** NestJS 注入 token：Map<provider 名, ModelProvider 实例>，新增供应商时往 Map 里注册即可 */
export const MODEL_PROVIDERS = Symbol('MODEL_PROVIDERS');
