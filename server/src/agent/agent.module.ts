import { Module } from '@nestjs/common';
import { ConversationModule } from '../conversation/conversation.module';
import { ToolsModule } from '../tools/tools.module';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { DeepSeekService } from './deepseek.service';

@Module({
  imports: [ConversationModule, ToolsModule],
  controllers: [AgentController],
  providers: [AgentService, DeepSeekService],
})
export class AgentModule {}
