import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** Token del enlace del correo (43 caracteres en base64url). */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{20,100}$/, {
    message: 'El enlace no es válido o ya venció. Pide uno nuevo.',
  })
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
