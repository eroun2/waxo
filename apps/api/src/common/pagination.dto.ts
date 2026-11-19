import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit: number = 20;
}

export const offsetOf = (q: PageQuery) => (q.page - 1) * q.limit;
export const pageOf = <T>(items: T[], total: number, q: PageQuery) =>
  ({ items, page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) });
/** Escape LIKE wildcards in user search text. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
