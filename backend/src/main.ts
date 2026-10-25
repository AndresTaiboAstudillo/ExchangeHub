import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { setupApiDocs } from './docs/openapi.js';
import { JsonLogger } from './observability/json-logger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });
  configureApp(app);
  setupApiDocs(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8000, '0.0.0.0');
}
await bootstrap();
