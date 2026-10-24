import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveUniversityDto {
  /** Nombre escrito por una persona (p. ej. el campo "universidad de origen" de su perfil). */
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
