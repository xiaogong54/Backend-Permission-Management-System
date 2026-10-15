import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 分页请求 DTO（所有列表接口继承它）
 *
 * 为什么要限制 pageSize 上限：
 *   不限制的话，一个 pageSize=1000000 的请求就能把服务打挂。
 *   上限 100 是本项目的约定（见设计文档"接口规范"）。
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: '页码，从 1 开始',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, { message: 'page 最小为 1' })
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    description: '每页条数，上限 100',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须是整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  @IsOptional()
  pageSize: number = 20;
}

/** 分页响应结构 */
export class PaginatedDto<T> {
  @ApiProperty({ description: '当前页数据' })
  list!: T[];

  @ApiProperty({ description: '总条数' })
  total!: number;

  @ApiProperty({ description: '当前页码' })
  page!: number;

  @ApiProperty({ description: '每页条数' })
  pageSize!: number;

  @ApiProperty({ description: '总页数' })
  totalPages!: number;

  static of<T>(
    list: T[],
    total: number,
    page: number,
    pageSize: number,
  ): PaginatedDto<T> {
    const dto = new PaginatedDto<T>();
    dto.list = list;
    dto.total = total;
    dto.page = page;
    dto.pageSize = pageSize;
    dto.totalPages = Math.ceil(total / pageSize);
    return dto;
  }
}

/** Prisma 的 skip/take 与 page/pageSize 的换算 */
export function toSkipTake(
  page: number,
  pageSize: number,
): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
