import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PLACE_CATEGORIES } from '../places.types.js';

const NUMBER = '-?\\d{1,3}(?:\\.\\d+)?';

export class PlacesQueryDto {
  @ApiPropertyOptional({
    enum: PLACE_CATEGORIES,
    isArray: true,
    description: 'Una o varias categorías separadas por coma.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(PLACE_CATEGORIES.length)
  @IsIn(PLACE_CATEGORIES, { each: true })
  category?: (typeof PLACE_CATEGORIES)[number][];

  @ApiPropertyOptional({
    description: 'Zona visible como `oeste,sur,este,norte` (lng,lat,lng,lat).',
    example: '-71.66,-33.06,-71.58,-33.02',
  })
  @IsOptional()
  @Matches(new RegExp(`^${NUMBER},${NUMBER},${NUMBER},${NUMBER}$`), {
    message: 'bbox debe ser oeste,sur,este,norte',
  })
  bbox?: string;

  @ApiPropertyOptional({ default: 300, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 300;
}
