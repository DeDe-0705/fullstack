import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../database/entities/conversation.entity';
import { Message } from '../database/entities/message.entity';
import { TasksService } from './tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  providers: [TasksService],
})
export class TasksModule {}
