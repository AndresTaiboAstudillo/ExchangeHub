import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { requestLogging } from './observability/request-logging.middleware.js';

/**
 * Orígenes que pueden llamar a la API desde un navegador o WebView. FRONTEND_ORIGIN admite
 * varios separados por comas, p. ej. "http://localhost:3000,https://localhost" (la web y la app
 * Android de Capacitor, que se sirve desde https://localhost).
 */
export function allowedOrigins(value = process.env.FRONTEND_ORIGIN): string[] {
  const origins = (value ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : ['http://localhost:3000'];
}

/** Configuración compartida entre main.ts y las pruebas e2e. */
export function configureApp(app: INestApplication): void {
  // Detrás de un proxy inverso (nginx, Caddy) hay que indicar cuántos saltos confiar para que
  // req.ip sea la persona y no el proxy; el límite de intentos depende de eso. Ej.: TRUST_PROXY=1
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const hops = Number(trustProxy);
    (app as unknown as { set(k: string, v: unknown): void }).set(
      'trust proxy',
      Number.isInteger(hops) ? hops : trustProxy === 'true' ? 1 : trustProxy,
    );
  }
  app.use(requestLogging);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: allowedOrigins() });
}
