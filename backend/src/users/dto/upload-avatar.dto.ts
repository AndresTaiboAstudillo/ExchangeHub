import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class UploadAvatarDto {
  @ApiProperty({
    description:
      'Imagen JPEG, PNG o WebP como data URL en base64 (máx. 64 KB ya decodificada; el cliente la reduce a 256 px).',
    example: 'data:image/jpeg;base64,/9j/4AAQ…',
  })
  @IsString()
  @MaxLength(90_000)
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, {
    message: 'La imagen debe ser un JPEG, PNG o WebP en base64',
  })
  image!: string;
}
