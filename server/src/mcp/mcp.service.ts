import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolsService } from '../tools/tools.service';

@Injectable()
export class McpService implements OnModuleInit {
  private server?: McpServer;

  constructor(private readonly toolsService: ToolsService) {}

  onModuleInit() {
    this.ensureServer();
  }

  getServer(): McpServer {
    return this.ensureServer();
  }

  // MCP 侧只做协议适配：把工具注册表里的定义注册成 MCP tools，handler 复用同一份
  private ensureServer(): McpServer {
    if (this.server) return this.server;

    const server = new McpServer({ name: 'agent-demo', version: '1.0.0' });
    for (const tool of this.toolsService.list()) {
      server.registerTool(
        tool.name,
        {
          title: tool.name,
          description: tool.description,
          inputSchema: tool.parameters,
        },
        async (args) => ({
          content: [
            {
              type: 'text' as const,
              text: await tool.handler((args ?? {}) as unknown as Record<string, unknown>),
            },
          ],
        }),
      );
    }

    this.server = server;
    return server;
  }
}
