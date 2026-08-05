import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DeepSeekChatChunk,
  DeepSeekChatCompletion,
  DeepSeekChatMessage,
  DeepSeekChatRequest,
  DeepSeekReasoningEffort,
  DeepSeekTool,
  DeepSeekToolCall,
  DeepSeekUsage,
} from './deepseek.types';

// 对外继续暴露类型，调用方不用关心定义在哪个文件
export type {
  DeepSeekChatMessage,
  DeepSeekReasoningEffort,
  DeepSeekTool,
  DeepSeekToolCall,
  DeepSeekUsage,
} from './deepseek.types';

export interface DeepSeekChatResult {
  content: string;
  reasoning: string;
  toolCalls: DeepSeekToolCall[];
  /** 非流式返回的整轮用量；为后续前端展示/用量统计预留 */
  usage: DeepSeekUsage | null;
}

export type DeepSeekStreamEvent =
  | { kind: 'reasoning'; delta: string }
  | { kind: 'content'; delta: string }
  | { kind: 'tool_calls'; toolCalls: DeepSeekToolCall[] }
  | ({ kind: 'usage' } & DeepSeekUsage);

@Injectable()
export class DeepSeekService {
  // DeepSeek 提供 OpenAI 兼容接口，用原生 fetch 直接调，依赖最少、原理最透明
  async chat(
    messages: DeepSeekChatMessage[],
    tools: DeepSeekTool[],
  ): Promise<DeepSeekChatResult> {
    const res = await fetch(this.endpoint(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(messages, tools, false)),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(
        `DeepSeek API 调用失败: ${res.status} ${text.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as DeepSeekChatCompletion;
    const message = data.choices[0]?.message;
    return {
      content: message?.content ?? '',
      reasoning: message?.reasoning_content ?? '',
      toolCalls: message?.tool_calls ?? [],
      usage: data.usage ?? null,
    };
  }

  // 流式对话：SSE 逐块解析后转成事件，调用方（AgentService）负责把工具调用回合拼回完整对话
  async *streamChat(
    messages: DeepSeekChatMessage[],
    tools: DeepSeekTool[],
    signal?: AbortSignal,
  ): AsyncGenerator<DeepSeekStreamEvent> {
    const res = await fetch(this.endpoint(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(messages, tools, true)),
      // 流式响应可能持续较久，120s 兜底；外部 signal（客户端断开）优先
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(120_000)])
        : AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(
        `DeepSeek API 调用失败: ${res.status} ${text.slice(0, 200)}`,
      );
    }
    if (!res.body) {
      throw new BadRequestException('DeepSeek 未返回流式内容');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // tool_calls 会按 index 分多次到达，先累积，流结束后一次性输出完整调用
    const toolCallByIndex = new Map<number, DeepSeekToolCall>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;

          let chunk: DeepSeekChatChunk;
          try {
            chunk = JSON.parse(data) as DeepSeekChatChunk;
          } catch {
            // 个别非 JSON 的心跳/注释行直接跳过，不影响主流程
            continue;
          }
          // include_usage 开启后，[DONE] 前的最后一块带完整用量，先透传给调用方
          if (chunk.usage) {
            yield { kind: 'usage', ...chunk.usage };
          }
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
            yield { kind: 'reasoning', delta: delta.reasoning_content };
          }
          if (typeof delta.content === 'string' && delta.content) {
            yield { kind: 'content', delta: delta.content };
          }
          for (const part of delta.tool_calls ?? []) {
            const current = toolCallByIndex.get(part.index) ?? {
              id: '',
              type: 'function' as const,
              function: { name: '', arguments: '' },
            };
            if (part.id) current.id = part.id;
            if (part.function?.name) current.function.name = part.function.name;
            if (part.function?.arguments) {
              current.function.arguments += part.function.arguments;
            }
            toolCallByIndex.set(part.index, current);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (toolCallByIndex.size > 0) {
      yield { kind: 'tool_calls', toolCalls: [...toolCallByIndex.values()] };
    }
  }

  private endpoint(): string {
    const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
    return `${baseUrl}/chat/completions`;
  }

  private headers(): Record<string, string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('未配置 DEEPSEEK_API_KEY，请在 server/.env 中填写');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  // 统一请求体：thinking 开启 + reasoning_effort + stream 开关
  private buildBody(
    messages: DeepSeekChatMessage[],
    tools: DeepSeekTool[],
    stream: boolean,
  ): DeepSeekChatRequest {
    const rawEffort = process.env.DEEPSEEK_REASONING_EFFORT;
    const reasoningEffort: DeepSeekReasoningEffort =
      rawEffort === 'low' ||
      rawEffort === 'medium' ||
      rawEffort === 'high' ||
      rawEffort === 'xhigh' ||
      rawEffort === 'max'
        ? rawEffort
        : 'high';
    return {
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
      messages,
      tools,
      tool_choice: 'auto',
      stream,
      // 思考模式与强度按官方文档放在 thinking 对象内；模型先输出 reasoning_content 再输出正文
      thinking: { type: 'enabled', reasoning_effort: reasoningEffort },
      // 流式时额外请求用量块，供后续前端展示/用量统计
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    };
  }
}
