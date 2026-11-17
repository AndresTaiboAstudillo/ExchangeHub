import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const blankToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  return text === '' ? null : text;
};

/** El área es fija para todas las zonas, por eso no se puede indicar un radio. */
export class CreateZoneDto {
  @ApiProperty({ example: 'Cerro Alegre', maxLength: 80 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 80,
    example: 'Segura hasta las 23:00',
  })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(80)
  safeHours?: string | null;

  @ApiProperty({ example: -33.0425 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -71.629 })
  @IsLongitude()
  longitude!: number;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}
