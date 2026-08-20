import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateConversationDto {
  /** 新标题 */
  @IsString()
  @IsNotEmpty({ message: 'title 必填' })
  @MaxLength(128, { message: 'title 长度不超过 128' })
  title!: string;

  /** 会话归属用户，用于越权校验 */
  @IsString()
  @IsNotEmpty({ message: 'userId 必填' })
  userId!: string;
}
