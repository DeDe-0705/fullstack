import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AgentService, AgentStreamEvent } from './agent.service';

interface AgentChatBody {
  userId?: string;
  conversationId?: string;
  message?: string;
  /** 模型供应商，缺省由 AgentService 走默认值 */
  provider?: string;
}

@Controller('api/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  chat(@Body() body: AgentChatBody) {
    if (!body.userId) throw new BadRequestException('userId 必填');
    const message = body.message?.trim();
    if (!message) throw new BadRequestException('message 必填');
    return this.agentService.chat({
      userId: body.userId,
      conversationId: body.conversationId,
      message,
      provider: body.provider,
    });
  }

  // SSE 流式对话：前端边接收边渲染，工具调用轨迹与思考过程也走同一通道
  // @Sse 只支持 GET，这里手动写 SSE 响应，保持 POST + body 参数
  @Post('chat/stream')
  async chatStream(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: AgentChatBody,
  ): Promise<void> {
    if (!body.userId) throw new BadRequestException('userId 必填');
    const message = body.message?.trim();
    if (!message) throw new BadRequestException('message 必填');

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const abort = new AbortController();
    // 客户端断开时中止上游 DeepSeek 请求，避免服务端继续空耗 token
    req.on('close', () => abort.abort());

    const write = (event: AgentStreamEvent) => {
      if (res.writableEnded || res.destroyed) return;
      const { kind, ...data } = event;
      res.write(`event: ${kind}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const event of this.agentService.chatStream(
        {
          userId: body.userId,
          conversationId: body.conversationId,
          message,
          provider: body.provider,
        },
        abort.signal,
      )) {
        write(event);
      }
    } catch (error) {
      if (!res.writableEnded && !res.destroyed) {
        const errorMessage =
          error instanceof Error ? error.message : 'Agent 流式响应失败';
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message: errorMessage })}\n\n`);
      }
    } finally {
      res.end();
    }
  }
}
