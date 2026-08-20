import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

export const MESSAGE_ROLES = ['user', 'assistant', 'tool', 'system'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const MESSAGE_STATUS = ['completed', 'aborted', 'error'] as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[number];

// 落库的工具调用轨迹，与 agent 层的 AgentToolTrace 结构一致（结构类型天然兼容，避免 entity 依赖 service）
export interface MessageToolCall {
  name: string;
  arguments: string;
  result: string;
}

// 供应商无关的 token 用量结构：核心三字段为 OpenAI 兼容格式，主流模型一致；
// 缓存命中、推理 token 等扩展字段声明为可选，接入新供应商时按此结构适配
export interface MessageUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

@Entity('messages')
// 拉取会话历史按 id 排序：自增 id 单调递增，索引 (conversation_id, id) 能覆盖查询
@Index('idx_messages_conversation_id', ['conversationId', 'id'])
export class Message {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'conversation_id', type: 'bigint', unsigned: true })
  conversationId!: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    // 删除会话时级联清理消息，避免孤儿数据
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ type: 'varchar', length: 16 })
  role!: MessageRole;

  @Column({ type: 'text' })
  content!: string;

  // assistant 的思考过程；普通消息为空，不参与正文渲染
  @Column({ type: 'text', nullable: true })
  reasoning!: string | null;

  // 仅 assistant 消息有意义：completed 正常完成 / aborted 用户中断（content 为已生成的部分内容）/ error 异常
  @Column({ type: 'varchar', length: 16, default: 'completed' })
  status!: MessageStatus;

  // token 用量；列名避开 MySQL 保留字 USAGE
  @Column({ name: 'token_usage', type: 'json', nullable: true })
  tokenUsage!: MessageUsage | null;

  // 思考耗时（毫秒）：首次 reasoning 增量到首次 content 增量
  @Column({ name: 'thinking_ms', type: 'int', unsigned: true, nullable: true })
  thinkingMs!: number | null;

  // 供应商标识：deepseek/kimi/minimax 等，用户可切换模型后按供应商聚合/筛选
  @Column({ type: 'varchar', length: 32, nullable: true })
  provider!: string | null;

  // 生成该消息的模型，便于换模型后回溯历史回答来源
  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null;

  // 本轮工具调用轨迹；无工具调用为 null
  @Column({ name: 'tool_calls', type: 'json', nullable: true })
  toolCalls!: MessageToolCall[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
