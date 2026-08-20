import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import {
  MESSAGE_ROLES,
  MessageRole,
} from '../../database/entities/message.entity';

export class CreateMessageDto {
  @IsIn(MESSAGE_ROLES as unknown as string[], {
    message: `role 必须是 ${MESSAGE_ROLES.join('/')}`,
  })
  role!: MessageRole;

  @IsString()
  @IsNotEmpty({ message: 'content 必填' })
  content!: string;
}
