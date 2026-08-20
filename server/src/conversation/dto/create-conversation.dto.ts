import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty({ message: 'userId 必填' })
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128, { message: 'title 长度不超过 128' })
  title?: string;
}
