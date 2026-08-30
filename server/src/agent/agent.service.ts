import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConversationService } from '../conversation/conversation.service';
import { ToolsService } from '../tools/tools.service';
import { BusinessException } from '../exceptions/business.exception';
import { RedisLockService } from '../redis/lock.service';
import { MqService } from '../mq/mq.service';
import type { MessageUsage } from '../database/entities/message.entity';
import {
  ChatMessage,
  ChatToolCall,
  MODEL_PROVIDERS,
  ModelProvider,
  ModelToolDefinition,
} from './providers/model-provider';
import {
  AgentChatInput,
  AgentStreamEvent,
  AgentToolTrace,
} from './interfaces/agent.types';

export type {
  AgentChatInput,
  AgentDonePayload,
  AgentStreamEvent,
  AgentToolTrace,
} from './interfaces/agent.types';

const SYSTEM_PROMPT =
  '你是出入预约系统的 AI 助手。你可以调用 get_user_info 工具查询用户信息。' +
  '回答保持简洁，使用中文；需要数据时先调用工具，再基于工具结果回答。';

// 「同一会话同时只允许一个进行中的回复」分布式锁：
// 锁 TTL 5 分钟，是进程崩溃时的最后兜底；60s 后 MQ 延迟消息做卡死检查，
// 携带业务校验（回复是否落库），比无脑等 TTL 更早释放崩溃残留的锁
const REPLY_LOCK_TTL_MS = 300_000;
const STUCK_CHECK_DELAY_MS = 60_000;

@Injectable()
export class AgentService {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly toolsService: ToolsService,
    private readonly lockService: RedisLockService,
    private readonly mqService: MqService,
    // 供应商注册表：按 input.provider 取用，新增供应商只需在 AgentModule 注册
    @Inject(MODEL_PROVIDERS)
    private readonly providers: Map<string, ModelProvider>,
  ) {}

  // 加会话回复锁 + 登记 MQ 卡死检查；返回 null 表示抢锁失败
  private async acquireReplyLock(
    conversationId: string,
  ): Promise<{ lockKey: string; token: string } | null> {
    const lockKey = `lock:conv:${conversationId}:reply`;
    const token = await this.lockService.acquire(lockKey, REPLY_LOCK_TTL_MS);
    if (!token) return null;
    await this.mqService.publishDelayedLockRelease(
      { lockKey, token, conversationId, acquiredAt: Date.now() },
      STUCK_CHECK_DELAY_MS,
    );
    return { lockKey, token };
  }

  private resolveProvider(name?: string): ModelProvider {
    const key = name ?? 'deepseek';
    const provider = this.providers.get(key);
    if (!provider) {
      throw new BadRequestException(`不支持的模型供应商: ${key}`);
    }
    return provider;
  }

  async chat(input: AgentChatInput) {
    const provider = this.resolveProvider(input.provider);
    const ctx = await this.prepareChat(input);
    const { conversationId, messages, toolDefinitions } = ctx;

    const lock = await this.acquireReplyLock(conversationId);
    if (!lock) {
      throw new BusinessException(20002, '当前会话正在生成回复，请稍后再试');
    }

    try {
      const traces: AgentToolTrace[] = [];
      let reply = '';
      let reasoning = '';
      let usage: MessageUsage | null = null;

      // 工具调用循环：模型可能连续调用多个工具，最多 5 轮防止死循环
      for (let round = 0; round < 5; round += 1) {
        const result = await provider.chat(messages, toolDefinitions);
        usage = this.mergeUsage(usage, result.usage);
        if (result.toolCalls.length === 0) {
          reply = result.content;
          reasoning = result.reasoning;
          break;
        }

        // assistant 的 toolCalls 必须原样回传，模型才能对上工具结果
        messages.push({ role: 'assistant', content: null, toolCalls: result.toolCalls });
        for (const call of result.toolCalls) {
          const args = this.parseToolArguments(call.arguments);
          const toolResult = await this.toolsService.execute(call.name, args);
          traces.push({
            name: call.name,
            arguments: call.arguments,
            result: toolResult,
          });
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: toolResult,
          });
        }
      }

      if (!reply) reply = '（工具调用轮次已达上限，未得到最终回复）';
      // 非流式无法区分思考与生成阶段，thinkingMs 不落库（默认 null）
      await this.conversationService.addMessage({
        conversationId,
        role: 'assistant',
        content: reply,
        reasoning,
        status: 'completed',
        tokenUsage: usage,
        provider: provider.provider,
        model: provider.model,
        toolCalls: traces.length > 0 ? traces : null,
      });

      return { reply, conversationId, toolCalls: traces, usage };
    } finally {
      // 正常释放走 finally；MQ 延迟消息只做崩溃/卡死的兜底检查
      await this.lockService.release(lock.lockKey, lock.token);
    }
  }

  // 流式对话：边生成边把 reasoning/content/工具轨迹透传给前端，结束后落库
  async *chatStream(
    input: AgentChatInput,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentStreamEvent> {
    const provider = this.resolveProvider(input.provider);
    const ctx = await this.prepareChat(input);
    const { conversationId, messages, toolDefinitions } = ctx;

    const lock = await this.acquireReplyLock(conversationId);
    if (!lock) {
      throw new BusinessException(20002, '当前会话正在生成回复，请稍后再试');
    }

    const traces: AgentToolTrace[] = [];
    let reply = '';
    let reasoning = '';
    let usage: MessageUsage | null = null;
    let persisted = false;
    let failed = false;
    let thinkingStartedAt: number | null = null;
    let contentStartedAt: number | null = null;
    const calcThinkingMs = () =>
      thinkingStartedAt && contentStartedAt
        ? contentStartedAt - thinkingStartedAt
        : null;

    // 先告知前端会话 ID：首次提问会自动建会话，前端停止生成时也能按 ID 刷新历史
    yield { kind: 'ready', conversationId };

    try {
      for (let round = 0; round < 5; round += 1) {
        let toolCalls: ChatToolCall[] = [];
        for await (const event of provider.streamChat(
          messages,
          toolDefinitions,
          signal,
        )) {
          if (event.kind === 'usage') {
            usage = this.mergeUsage(usage, event.usage);
            yield event;
          } else if (event.kind === 'reasoning') {
            thinkingStartedAt ??= Date.now();
            reasoning += event.delta;
            yield { kind: 'reasoning', delta: event.delta };
          } else if (event.kind === 'content') {
            contentStartedAt ??= Date.now();
            // 每轮增量都转发并累积；最终落库的是整个回合的完整文本
            reply += event.delta;
            yield { kind: 'content', delta: event.delta };
          } else {
            toolCalls = event.toolCalls;
          }
        }

        if (toolCalls.length === 0) break;

        messages.push({
          role: 'assistant',
          content: reply || null,
          toolCalls,
        });
        for (const call of toolCalls) {
          const args = this.parseToolArguments(call.arguments);
          const toolResult = await this.toolsService.execute(call.name, args);
          traces.push({
            name: call.name,
            arguments: call.arguments,
            result: toolResult,
          });
          yield {
            kind: 'tool',
            name: call.name,
            arguments: call.arguments,
            result: toolResult,
          };
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: toolResult,
          });
        }
      }

      if (!reply) reply = '（工具调用轮次已达上限，未得到最终回复）';
      const saved = await this.conversationService.addMessage({
        conversationId,
        role: 'assistant',
        content: reply,
        reasoning,
        status: 'completed',
        tokenUsage: usage,
        thinkingMs: calcThinkingMs(),
        provider: provider.provider,
        model: provider.model,
        toolCalls: traces.length > 0 ? traces : null,
      });
      persisted = true;
      yield {
        kind: 'done',
        conversationId,
        toolCalls: traces,
        usage,
        thinkingMs: calcThinkingMs(),
        assistantMessage: saved,
      };
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      // 客户端中途断开/出错时也把已生成内容落库，避免对话上下文丢失；
      // status 区分用户中断（aborted）与上游异常（error）
      if (!persisted && reply.trim()) {
        await this.conversationService.addMessage({
          conversationId,
          role: 'assistant',
          content: reply,
          reasoning,
          status: failed ? 'error' : 'aborted',
          tokenUsage: usage,
          thinkingMs: calcThinkingMs(),
          provider: provider.provider,
          model: provider.model,
          toolCalls: traces.length > 0 ? traces : null,
        });
      }
      // 正常释放走 finally；MQ 延迟消息只做崩溃/卡死的兜底检查
      await this.lockService.release(lock.lockKey, lock.token);
    }
  }

  private async prepareChat(input: AgentChatInput) {
    if (!input.message?.trim()) throw new BadRequestException('message 必填');
    // 用户必须真实存在（不存在时 service 抛 404）
    await this.conversationService.getUserById(input.userId);

    let conversationId = input.conversationId;
    if (!conversationId) {
      // 没指定会话就新建一个，标题取消息前 20 字，前端列表好辨认
      const created = await this.conversationService.createConversation(
        input.userId,
        input.message.slice(0, 20),
      );
      conversationId = created.id;
    }

    await this.conversationService.addMessage({
      conversationId,
      role: 'user',
      content: input.message,
    });

    const { items: history } = await this.conversationService.getHistory(
      conversationId,
      { limit: 20 },
    );
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      // 历史只持久化 user/assistant，tool/system 不会出现在这里
      ...history
        .filter((item) => item.role === 'user' || item.role === 'assistant')
        .map((item) => ({
          role: item.role as 'user' | 'assistant',
          content: item.content,
        })),
    ];

    // 领域格式的工具定义，wire 格式转换由各供应商 service 内部完成
    const toolDefinitions: ModelToolDefinition[] = this.toolsService
      .list()
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: this.toolsService.toJsonSchema(tool),
      }));

    return { conversationId, messages, toolDefinitions };
  }

  private parseToolArguments(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // 模型偶发返回非法 JSON 时降级为空对象，保证工具执行不中断
      return {};
    }
  }

  // 工具循环可能多次请求模型，用量按字段累加，方便整体展示/统计
  private mergeUsage(
    target: MessageUsage | null,
    next: MessageUsage | null,
  ): MessageUsage | null {
    if (!next) return target;
    return {
      completion_tokens: (target?.completion_tokens ?? 0) + next.completion_tokens,
      prompt_tokens: (target?.prompt_tokens ?? 0) + next.prompt_tokens,
      prompt_cache_hit_tokens:
        (target?.prompt_cache_hit_tokens ?? 0) + (next.prompt_cache_hit_tokens ?? 0),
      prompt_cache_miss_tokens:
        (target?.prompt_cache_miss_tokens ?? 0) + (next.prompt_cache_miss_tokens ?? 0),
      total_tokens: (target?.total_tokens ?? 0) + next.total_tokens,
      prompt_tokens_details: {
        cached_tokens:
          (target?.prompt_tokens_details?.cached_tokens ?? 0) +
          (next.prompt_tokens_details?.cached_tokens ?? 0),
      },
      completion_tokens_details: {
        reasoning_tokens:
          (target?.completion_tokens_details?.reasoning_tokens ?? 0) +
          (next.completion_tokens_details?.reasoning_tokens ?? 0),
      },
    };
  }
}
