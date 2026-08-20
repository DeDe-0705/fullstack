import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Conversation } from '../database/entities/conversation.entity';
import {
  Message,
  MessageRole,
  MessageStatus,
  MessageToolCall,
  MessageUsage,
} from '../database/entities/message.entity';

export interface Page<T> {
  items: T[];
  total: number;
}

// 落库消息的可选元信息：状态、token 用量、思考耗时、模型、工具轨迹（仅 assistant 消息使用）
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

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
  ) {}

  // 显式注册：用户名已存在时返回 409，不允许静默复用
  async createUser(name: string): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { name } });
    if (existing) throw new ConflictException('用户名已存在');
    return this.userRepo.save(this.userRepo.create({ name }));
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findUserByName(name: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { name } });
  }

  async listConversations(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<Page<Conversation>> {
    const [items, total] = await this.conversationRepo.findAndCount({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async createConversation(userId: string, title = '新对话'): Promise<Conversation> {
    return this.conversationRepo.save(this.conversationRepo.create({ userId, title }));
  }

  async getHistory(
    conversationId: string,
    limit: number,
    offset: number,
  ): Promise<Page<Message>> {
    // 先按 id 倒序取最近一段，再反转为正序返回，顺序稳定且天然支持分页
    const [rows, total] = await this.messageRepo.findAndCount({
      where: { conversationId },
      order: { id: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items: rows.reverse(), total };
  }

  async addMessage(input: AddMessageInput): Promise<Message> {
    const message = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        reasoning: input.reasoning ?? null,
        status: input.status ?? 'completed',
        tokenUsage: input.tokenUsage ?? null,
        thinkingMs: input.thinkingMs ?? null,
        provider: input.provider ?? null,
        model: input.model ?? null,
        toolCalls: input.toolCalls ?? null,
      }),
    );
    // 会话列表按 updated_at 倒序，新消息刷新会话的更新时间
    await this.conversationRepo.update(
      { id: input.conversationId },
      { updatedAt: new Date() },
    );
    return message;
  }
}
