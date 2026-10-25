import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  /** Id del último elemento de la página anterior (el `nextCursor` recibido). */
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Recibe `limit + 1` filas y arma la página con su cursor. */
export function toPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, 'P2002');
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasCode(error, 'P2003');
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}
