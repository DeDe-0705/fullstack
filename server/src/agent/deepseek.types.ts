// DeepSeek Chat Completions API 的类型定义
// 官方文档：https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/
// 按文档字段定义 request / response，方便后续在接口层透出用量等信息

export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export type DeepSeekThinkingMode = 'enabled' | 'disabled';

// 文档枚举只有 low/high/max；medium/xhigh 为兼容映射值
export type DeepSeekReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type DeepSeekFinishReason =
  | 'stop'
  | 'length'
  | 'content_filter'
  | 'tool_calls'
  | 'insufficient_system_resource';

// ---------- messages ----------

export interface DeepSeekSystemMessage {
  role: 'system';
  content: string;
  /** 可选的参与者名称，帮助模型区分相同角色的参与者 */
  name?: string;
}

export interface DeepSeekUserMessage {
  role: 'user';
  content: string;
  name?: string;
}

export interface DeepSeekToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** 模型生成的 JSON 参数，可能非法，调用前需要自行校验 */
    arguments: string;
  };
}

export interface DeepSeekAssistantMessage {
  role: 'assistant';
  content: string | null;
  name?: string;
  /** Beta：强制模型以该前缀内容开始回答（需 base_url=/beta） */
  prefix?: boolean;
  /** Beta：对话前缀续写时，作为最后一条思维链内容的输入（prefix 必须为 true） */
  reasoning_content?: string | null;
  tool_calls?: DeepSeekToolCall[];
}

export interface DeepSeekToolMessage {
  role: 'tool';
  content: string;
  /** 此消息所响应的 tool call ID */
  tool_call_id: string;
}

export type DeepSeekChatMessage =
  | DeepSeekSystemMessage
  | DeepSeekUserMessage
  | DeepSeekAssistantMessage
  | DeepSeekToolMessage;

// ---------- request ----------

export interface DeepSeekToolFunction {
  name: string;
  description: string;
  /** JSON Schema，省略表示参数为空 */
  parameters?: Record<string, unknown>;
  /** Beta：strict 模式，保证输出符合 JSON Schema */
  strict?: boolean;
}

export interface DeepSeekTool {
  type: 'function';
  function: DeepSeekToolFunction;
}

export type DeepSeekToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };

export interface DeepSeekResponseFormat {
  type: 'text' | 'json_object';
}

export interface DeepSeekThinking {
  /** enabled=思考模式（默认），disabled=非思考模式 */
  type: DeepSeekThinkingMode;
  /** 推理强度，默认 high；目前仅 deepseek-v4-flash 支持三档 */
  reasoning_effort?: DeepSeekReasoningEffort;
}

export interface DeepSeekStreamOptions {
  /** 流式最后在 [DONE] 前多返回一个带 usage 的块 */
  include_usage?: boolean;
}

export interface DeepSeekChatRequest {
  messages: DeepSeekChatMessage[];
  model: string;
  thinking?: DeepSeekThinking | null;
  /** 单次请求最多生成的 completion token 数 */
  max_tokens?: number | null;
  response_format?: DeepSeekResponseFormat | null;
  /** string 或最多 16 个 string，遇到即停止生成 */
  stop?: string | string[] | null;
  /** true 时以 SSE 流式返回增量，流以 data: [DONE] 结束 */
  stream?: boolean | null;
  /** 仅 stream=true 时可设置 */
  stream_options?: DeepSeekStreamOptions | null;
  /** 采样温度 0~2，默认 1；通常与 top_p 二选一调整 */
  temperature?: number | null;
  top_p?: number | null;
  /** 最多 128 个 function；tool_choice 默认在有工具时为 auto */
  tools?: DeepSeekTool[] | null;
  tool_choice?: DeepSeekToolChoice | null;
  /** 返回输出 token 的对数概率 */
  logprobs?: boolean | null;
  /** 0~20，指定每个输出位置返回 top N token 的对数概率（需 logprobs=true） */
  top_logprobs?: number | null;
  /** 业务侧用户标识，用于内容安全、KVCache 缓存隔离与调度隔离；勿放隐私信息 */
  user_id?: string | null;
  // frequency_penalty / presence_penalty 已废弃，不再定义
}

// ---------- response ----------

export interface DeepSeekUsage {
  /** 模型 completion 产生的 token 数 */
  completion_tokens: number;
  /** prompt token 数 = prompt_cache_hit_tokens + prompt_cache_miss_tokens */
  prompt_tokens: number;
  /** 命中上下文缓存的 prompt token 数 */
  prompt_cache_hit_tokens?: number;
  /** 未命中上下文缓存的 prompt token 数 */
  prompt_cache_miss_tokens?: number;
  total_tokens: number;
  /** 实际响应中会出现 cached_tokens（命中缓存的 prompt token 数） */
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    /** 思考模式产生的思维链 token 数 */
    reasoning_tokens?: number;
  };
}

export interface DeepSeekLogprobToken {
  token: string;
  logprob: number;
  /** UTF-8 字节表示；无对应字节时为 null */
  bytes: number[] | null;
  top_logprobs: DeepSeekLogprobToken[];
}

export interface DeepSeekLogprobs {
  content: DeepSeekLogprobToken[] | null;
  reasoning_content?: DeepSeekLogprobToken[] | null;
}

export interface DeepSeekChatCompletionChoice {
  index: number;
  message: DeepSeekAssistantMessage;
  finish_reason: DeepSeekFinishReason;
  logprobs?: DeepSeekLogprobs | null;
}

export interface DeepSeekChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: DeepSeekChatCompletionChoice[];
  usage?: DeepSeekUsage;
  system_fingerprint?: string;
}

// ---------- streaming chunk ----------

/** 流式返回的 tool_calls 增量：按 index 分片，id/name 只在首个分片出现，arguments 跨分片拼接 */
export interface DeepSeekStreamToolCallPart {
  index: number;
  id?: string;
  type?: 'function';
  function?: { name?: string; arguments?: string };
}

export interface DeepSeekChatStreamDelta {
  content?: string | null;
  reasoning_content?: string | null;
  role?: 'assistant';
  tool_calls?: DeepSeekStreamToolCallPart[];
  logprobs?: DeepSeekLogprobs | null;
}

export interface DeepSeekChatChunk {
  id?: string;
  object?: 'chat.completion.chunk';
  created?: number;
  model?: string;
  system_fingerprint?: string;
  choices?: Array<{
    index?: number;
    delta?: DeepSeekChatStreamDelta;
    finish_reason?: DeepSeekFinishReason | null;
    logprobs?: DeepSeekLogprobs | null;
  }>;
  /** 普通 chunk 为 null；开启 stream_options.include_usage 后，[DONE] 前的最后一块带完整用量 */
  usage?: DeepSeekUsage | null;
}
