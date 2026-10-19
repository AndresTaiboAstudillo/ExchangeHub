import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeList =
  (lowercase: boolean) =>
  ({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v: unknown) =>
          typeof v === 'string' ? (lowercase ? v.trim().toLowerCase() : v.trim()) : v,
        )
      : value;

/**
 * Todos los campos son opcionales: solo se actualiza lo que se envía.
 * Enviar `null` en un campo opcional lo borra.
 */
export class UpdateProfileDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  countryOfOrigin?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  universityOrigin?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  career?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  bio?: string | null;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  /** Reemplaza la lista completa. Códigos como "es", "en" o "pt-br". */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Transform(normalizeList(true))
  @Matches(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/, { each: true })
  languageCodes?: string[];

  /** Reemplaza la lista completa. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Transform(normalizeList(false))
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  hobbies?: string[];
}
