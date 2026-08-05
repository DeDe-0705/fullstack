import { Module } from '@nestjs/common';
import { ToolsModule } from '../tools/tools.module';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';

@Module({
  imports: [ToolsModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
