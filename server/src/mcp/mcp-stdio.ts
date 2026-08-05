import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AppModule } from '../app.module';
import { McpService } from './mcp.service';

// stdio 入口：给 Claude Code 等本地 MCP 客户端直接启动用
async function bootstrap() {
  try {
    process.loadEnvFile();
  } catch {
    // .env 不存在时使用系统环境变量
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const mcpService = app.get(McpService);
  const transport = new StdioServerTransport();
  await mcpService.getServer().connect(transport);

  process.on('SIGINT', () => {
    void app.close().finally(() => process.exit(0));
  });
}

void bootstrap();
