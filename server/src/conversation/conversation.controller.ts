import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

// controller 只负责路由注册与参数接线；存在性校验、trim、分页解析等业务逻辑都在 service
@Controller('api')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('users')
  createUser(@Body() body: CreateUserDto) {
    return this.conversationService.createUser(body.name);
  }

  @Get('users/by-name/:name')
  getUserByName(@Param('name') name: string) {
    return this.conversationService.getUserByName(name);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.conversationService.getUserById(id);
  }

  @Get('users/:id/conversations')
  listConversations(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.conversationService.listConversations(id, query);
  }

  @Post('conversations')
  createConversation(@Body() body: CreateConversationDto) {
    return this.conversationService.createConversation(body.userId, body.title);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.conversationService.getHistory(id, query);
  }

  @Post('conversations/:id/messages')
  addMessage(@Param('id') id: string, @Body() body: CreateMessageDto) {
    return this.conversationService.addMessage({
      conversationId: id,
      role: body.role,
      content: body.content,
    });
  }
}
