import { Injectable } from '@nestjs/common';
// zod/v3 子路径：zod-to-json-schema 目前按 v3 类型工作，MCP SDK 同时兼容 v3/v4
import { z } from 'zod/v3';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConversationService } from '../conversation/conversation.service';

// 工具注册表：一份定义同时给 DeepSeek function calling 和 MCP 用
export interface AgentTool {
  name: string;
  description: string;
  // 参数用 zod 定义：MCP 侧直接校验，DeepSeek 侧转成 JSON Schema
  parameters: ReturnType<typeof z.object>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

@Injectable()
export class ToolsService {
  constructor(private readonly conversationService: ConversationService) {}

  private readonly getUserInfoSchema = z.object({
    userId: z.number().int().optional().describe('用户 ID，可选'),
  });

  private readonly tools: AgentTool[] = [
    {
      name: 'get_user_info',
      description: '查询用户基本信息，包括用户名、创建时间和会话数量',
      parameters: this.getUserInfoSchema,
      handler: async (args) => {
        if (args.userId == null) {
          return JSON.stringify({ error: '缺少 userId 参数' });
        }
        const user = await this.conversationService.findUserById(String(args.userId));
        if (!user) return JSON.stringify({ error: '用户不存在' });
        const { total } = await this.conversationService.listConversations(
          user.id,
          1,
          0,
        );
        return JSON.stringify({
          id: user.id,
          name: user.name,
          createdAt: user.createdAt,
          conversationCount: total,
        });
      },
    },
  ];

  toJsonSchema(tool: AgentTool): Record<string, unknown> {
    return zodToJsonSchema(tool.parameters);
  }

  list(): AgentTool[] {
    return this.tools;
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.find((item) => item.name === name);
    if (!tool) return JSON.stringify({ error: `未知工具: ${name}` });
    try {
      return await tool.handler(args);
    } catch (error) {
      // 工具异常转成 JSON 结果回给模型，而不是中断整个 Agent 循环
      return JSON.stringify({
        error: error instanceof Error ? error.message : '工具执行失败',
      });
    }
  }
}
