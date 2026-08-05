import { Module } from '@nestjs/common';
import { ConversationModule } from '../conversation/conversation.module';
import { ToolsService } from './tools.service';

@Module({
  imports: [ConversationModule],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
