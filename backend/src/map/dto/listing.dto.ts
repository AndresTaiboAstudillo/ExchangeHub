import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Texto opcional: se recorta y "" pasa a null (así se puede borrar un campo). */
const blankToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  return text === '' ? null : text;
};

export class CreateListingDto {
  @ApiProperty({ example: 'Habitación en Cerro Alegre', maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @ApiProperty({ example: -33.0437 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -71.6288 })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Arriendo mensual en pesos chilenos.',
    maximum: 20_000_000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20_000_000)
  priceClp?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 60,
    example: 'Disponible',
  })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(60)
  availability?: string | null;
}

export class UpdateListingDto extends PartialType(CreateListingDto) {}
