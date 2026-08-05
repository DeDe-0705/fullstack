import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConversationModule } from './conversation/conversation.module';
import { ToolsModule } from './tools/tools.module';
import { AgentModule } from './agent/agent.module';
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [DatabaseModule, ConversationModule, ToolsModule, AgentModule, McpModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
