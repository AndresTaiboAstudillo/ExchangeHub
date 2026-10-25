import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { apiDocsEnabled, setupApiDocs } from '../src/docs/openapi.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PythonService } from '../src/python/python.service.js';

process.env.JWT_SECRET = 'secreto-de-pruebas-con-al-menos-32-caracteres';

async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(PythonService)
    .useValue({})
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  setupApiDocs(app);
  await app.init();
  return app;
}

describe('Documentación de la API', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app.close();
  });

  it('GET /docs-json publica la especificación OpenAPI con todas las rutas', async () => {
    app = await createApp();
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('ExchangeHub API');
    for (const path of [
      '/auth/login',
      '/users/me',
      '/posts',
      '/friendships',
      '/universities',
      '/universities/ingestion',
      '/health/ready',
      '/metrics/http',
    ]) {
      expect(res.body.paths).toHaveProperty([path]);
    }
  });

  it('las rutas protegidas declaran el esquema Bearer y las públicas no', async () => {
    app = await createApp();
    const { body } = await request(app.getHttpServer()).get('/docs-json');
    expect(body.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(body.paths['/universities'].get.security).toEqual([{ bearer: [] }]);
    expect(body.paths['/auth/me'].get.security).toEqual([{ bearer: [] }]);
    expect(body.paths['/auth/login'].post.security).toBeUndefined();
    expect(body.paths['/health'].get.security).toBeUndefined();
  });

  it('cada operación tiene un resumen y una etiqueta', async () => {
    app = await createApp();
    const { body } = await request(app.getHttpServer()).get('/docs-json');
    for (const [path, methods] of Object.entries<Record<string, any>>(
      body.paths,
    )) {
      for (const [method, op] of Object.entries(methods)) {
        expect(op.summary, `${method.toUpperCase()} ${path}`).toBeTruthy();
        expect(
          op.tags?.length,
          `${method.toUpperCase()} ${path}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('GET /docs sirve la interfaz interactiva', async () => {
    app = await createApp();
    const res = await request(app.getHttpServer())
      .get('/docs')
      .redirects(1)
      .expect(200);
    expect(res.text).toContain('swagger');
  });

  it('API_DOCS_ENABLED=false la desactiva', async () => {
    vi.stubEnv('API_DOCS_ENABLED', 'false');
    app = await createApp();
    await request(app.getHttpServer()).get('/docs-json').expect(404);
    await request(app.getHttpServer()).get('/docs').expect(404);
  });
});

describe('apiDocsEnabled', () => {
  it('está activa por defecto y solo se apaga con "false"', () => {
    expect(apiDocsEnabled({})).toBe(true);
    expect(apiDocsEnabled({ API_DOCS_ENABLED: 'true' })).toBe(true);
    expect(apiDocsEnabled({ API_DOCS_ENABLED: 'FALSE' })).toBe(false);
  });
});
