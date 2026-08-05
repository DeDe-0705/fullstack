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

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
