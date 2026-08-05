import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpService } from './mcp.service';

@Controller('api/mcp')
export class McpController {
  // stateful 会话：每个 mcp-session-id 对应一个 transport，后续请求复用
  private readonly transports = new Map<string, StreamableHTTPServerTransport>();

  constructor(private readonly mcpService: McpService) {}

  @Post()
  handlePost(@Req() req: Request, @Res() res: Response) {
    return this.handle(req, res);
  }

  @Get()
  handleGet(@Req() req: Request, @Res() res: Response) {
    return this.handle(req, res);
  }

  @Delete()
  handleDelete(@Req() req: Request, @Res() res: Response) {
    return this.handle(req, res);
  }

  private async handle(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport = sessionId ? this.transports.get(sessionId) : undefined;

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          this.transports.set(sid, transport as StreamableHTTPServerTransport);
        },
      });
      transport.onclose = () => {
        if (transport?.sessionId) this.transports.delete(transport.sessionId);
      };
      await this.mcpService.getServer().connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  }
}
