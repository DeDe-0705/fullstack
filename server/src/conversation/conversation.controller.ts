import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { MESSAGE_ROLES, MessageRole } from '../database/entities/message.entity';
import { parsePagination } from '../common/pagination';

interface CreateUserBody {
  name?: string;
}

interface CreateConversationBody {
  userId?: string;
  title?: string;
}

interface CreateMessageBody {
  role?: string;
  content?: string;
}

@Controller('api')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('users')
  async createUser(@Body() body: CreateUserBody) {
    const name = body.name?.trim();
    if (!name || name.length > 64) {
      throw new BadRequestException('name 必填且长度不超过 64');
    }
    return this.conversationService.createUser(name);
  }

  @Get('users/by-name/:name')
  async getUserByName(@Param('name') name: string) {
    const user = await this.conversationService.findUserByName(name);
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.conversationService.findUserById(id);
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  @Get('users/:id/conversations')
  async listConversations(
    @Param('id') id: string,
    @Query() query: { limit?: string; offset?: string },
  ) {
    const { limit, offset } = parsePagination(query);
    return this.conversationService.listConversations(id, limit, offset);
  }

  @Post('conversations')
  async createConversation(@Body() body: CreateConversationBody) {
    if (!body.userId) throw new BadRequestException('userId 必填');
    const user = await this.conversationService.findUserById(body.userId);
    if (!user) throw new NotFoundException('用户不存在');
    const title = body.title?.trim();
    return this.conversationService.createConversation(
      body.userId,
      title || undefined,
    );
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query() query: { limit?: string; offset?: string },
  ) {
    const { limit, offset } = parsePagination(query, { limit: 50 });
    return this.conversationService.getHistory(id, limit, offset);
  }

  @Post('conversations/:id/messages')
  async addMessage(@Param('id') id: string, @Body() body: CreateMessageBody) {
    if (!body.role || !(MESSAGE_ROLES as readonly string[]).includes(body.role)) {
      throw new BadRequestException(`role 必须是 ${MESSAGE_ROLES.join('/')}`);
    }
    if (!body.content?.trim()) throw new BadRequestException('content 必填');
    return this.conversationService.addMessage({
      conversationId: id,
      role: body.role as MessageRole,
      content: body.content,
    });
  }
}
