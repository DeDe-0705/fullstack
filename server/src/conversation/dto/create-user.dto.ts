import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'name 必填' })
  @MaxLength(64, { message: 'name 长度不超过 64' })
  name!: string;
}
