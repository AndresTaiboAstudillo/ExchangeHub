import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { requestLogging } from './observability/request-logging.middleware.js';

/** Configuración compartida entre main.ts y las pruebas e2e. */
export function configureApp(app: INestApplication): void {
  app.use(requestLogging);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  });
}
