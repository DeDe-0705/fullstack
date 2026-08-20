import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// 列表接口的分页查询参数：ValidationPipe 的 transform 把 query string 转成 number，
// 非法值直接 400（替代原 parsePagination 的静默回退）
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'limit 最大 100，防止拖库' })
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
