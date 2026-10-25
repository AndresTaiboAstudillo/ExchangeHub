import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CATEGORIES = [
  'universidad',
  'instituto_profesional',
  'centro_formacion_tecnica',
] as const;
export const OWNERSHIPS = [
  'estatal',
  'particular_con_aportes',
  'privada',
  'otra',
] as const;

export class ListUniversitiesDto {
  /** Texto de búsqueda. Con texto, los resultados se ordenan por relevancia (BM25). */
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiPropertyOptional({ enum: OWNERSHIPS })
  @IsOptional()
  @IsIn(OWNERSHIPS)
  ownership?: (typeof OWNERSHIPS)[number];

  /** Por defecto solo se listan instituciones vigentes. */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  includeInactive: boolean = false;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
