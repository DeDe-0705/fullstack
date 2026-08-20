import { Module } from '@nestjs/common';
import { ConversationModule } from '../conversation/conversation.module';
import { ToolsModule } from '../tools/tools.module';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { DeepSeekService } from './providers/deepseek.service';
import { MODEL_PROVIDERS, ModelProvider } from './providers/model-provider';

@Module({
  imports: [ConversationModule, ToolsModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    DeepSeekService,
    // 供应商注册表：新增供应商时实现 ModelProvider 并往 Map 里加一行即可，AgentService 零改动
    {
      provide: MODEL_PROVIDERS,
      useFactory: (deepseek: DeepSeekService): Map<string, ModelProvider> =>
        new Map([[deepseek.provider, deepseek]]),
      inject: [DeepSeekService],
    },
  ],
})
export class AgentModule {}
