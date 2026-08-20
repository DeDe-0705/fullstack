import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Conversation } from '../database/entities/conversation.entity';
import { Message } from '../database/entities/message.entity';
import { BusinessException } from '../exceptions/business.exception';
import {
  AddMessageInput,
  Page,
  PaginationOptions,
} from './interfaces/conversation.types';

export type { AddMessageInput, Page } from './interfaces/conversation.types';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
  ) { }

  // 显式注册：用户名已存在时返回业务码 10001，不允许静默复用
  async createUser (name: string): Promise<User> {
    const trimmed = name.trim();
    const existing = await this.userRepo.findOne({ where: { name: trimmed } });
    if (existing) throw new BusinessException(10001, '用户名已存在');
    return this.userRepo.save(this.userRepo.create({ name: trimmed }));
  }

  async findUserById (id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  // 存在性校验下沉到 service：controller 只接线，不判断
  async getUserById (id: string): Promise<User> {
    const user = await this.findUserById(id);
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async getUserByName (name: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { name } });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async listConversations (
    userId: string,
    pagination: PaginationOptions = {},
  ): Promise<Page<Conversation>> {
    const { limit = 20, offset = 0 } = pagination;
    const [items, total] = await this.conversationRepo.findAndCount({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async createConversation (userId: string, title?: string): Promise<Conversation> {
    // 会话必须挂在真实用户下
    await this.getUserById(userId);
    return this.conversationRepo.save(
      this.conversationRepo.create({ userId, title: title?.trim() || '新对话' }),
    );
  }

  async editConversation (conversationId: string, userId: string, title: string): Promise<Conversation> {
    // criteria 带上 userId：条件不匹配就 affected=0，天然防越权改他人会话
    const result = await this.conversationRepo.update(
      { id: conversationId, userId },
      { title: title.trim() }
    );

    if (result.affected === 0) {
      throw new NotFoundException('会话不存在或无权限');
    }
    // update 只发 UPDATE 不返回实体，raw 是驱动层结果；重新查一次返回给前端
    return this.getConversationById(conversationId);
  }

  async getConversationById (id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException('会话不存在');
    return conversation;
  }

  async getHistory (
    conversationId: string,
    pagination: PaginationOptions = {},
  ): Promise<Page<Message>> {
    const { limit = 50, offset = 0 } = pagination;
    // 先按 id 倒序取最近一段，再反转为正序返回，顺序稳定且天然支持分页
    const [rows, total] = await this.messageRepo.findAndCount({
      where: { conversationId },
      order: { id: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items: rows.reverse(), total };
  }

  async addMessage (input: AddMessageInput): Promise<Message> {
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
