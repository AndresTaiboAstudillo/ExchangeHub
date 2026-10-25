import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** ¿Se publica la documentación de la API? Por defecto sí; API_DOCS_ENABLED=false la desactiva. */
export function apiDocsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.API_DOCS_ENABLED ?? 'true').toLowerCase() !== 'false';
}

/**
 * Documentación OpenAPI de la API de NestJS.
 *  - Interfaz interactiva: GET /docs
 *  - Especificación JSON:  GET /docs-json
 */
export function setupApiDocs(app: INestApplication): void {
  if (!apiDocsEnabled()) return;
  const config = new DocumentBuilder()
    .setTitle('ExchangeHub API')
    .setDescription(
      'API de ExchangeHub, la plataforma para estudiantes internacionales en Chile. ' +
        'El frontend solo habla con esta API; NestJS es el único que llama al servicio Python y a la base de datos. ' +
        'Las rutas protegidas exigen `Authorization: Bearer <token>` (token de `POST /auth/login`). ' +
        'Cada respuesta incluye `X-Request-Id`, que también se puede enviar para seguir una petición en los registros.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}
