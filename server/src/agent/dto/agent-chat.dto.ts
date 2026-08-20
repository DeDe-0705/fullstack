import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// 对话接口的 HTTP 请求体；message 的"纯空白"兜底校验在 AgentService.prepareChat
export class AgentChatDto {
  @IsString()
  @IsNotEmpty({ message: 'userId 必填' })
  userId!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @IsNotEmpty({ message: 'message 必填' })
  message!: string;

  /** 模型供应商，缺省由 AgentService 走默认值 */
  @IsOptional()
  @IsString()
  provider?: string;
}
