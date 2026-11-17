import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AvatarsService } from './avatars.service.js';

/**
 * Las fotos se sirven sin sesión porque un `<img>` no puede enviar el token. El enlace
 * lleva el id (un UUID) y solo aparece en las respuestas a usuarios autenticados; la API
 * deja de entregarlo cuando el perfil del autor está oculto (p. ej. en las reseñas).
 */
@ApiTags('Usuarios')
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly avatars: AvatarsService) {}

  @ApiOperation({ summary: 'Foto de perfil de un usuario (imagen)' })
  @Get(':id')
  // El enlace cambia con cada foto nueva (?v=), así que puede cachearse mucho tiempo.
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const { contentType, data } = await this.avatars.get(id);
    return new StreamableFile(data, {
      type: contentType,
      disposition: 'inline',
    });
  }
}
