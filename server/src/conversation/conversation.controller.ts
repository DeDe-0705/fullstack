import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { parsePagination } from '../common/pagination';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('api')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('users')
  async createUser(@Body() body: CreateUserDto) {
    return this.conversationService.createUser(body.name.trim());
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
  async createConversation(@Body() body: CreateConversationDto) {
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
  async addMessage(@Param('id') id: string, @Body() body: CreateMessageDto) {
    return this.conversationService.addMessage({
      conversationId: id,
      role: body.role,
      content: body.content,
    });
  }
}
