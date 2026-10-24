import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { httpMetrics } from '../src/observability/http-metrics.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PythonService } from '../src/python/python.service.js';

process.env.JWT_SECRET = 'secreto-de-pruebas-con-al-menos-32-caracteres';

interface FakeUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  isVisible: boolean;
  createdAt: Date;
}

function createFakePrisma() {
  const users: FakeUser[] = [];
  return {
    user: {
      create: vi.fn(
        async ({
          data,
        }: {
          data: { name: string; email: string; passwordHash: string };
        }) => {
          if (users.some((u) => u.email === data.email)) {
            throw Object.assign(new Error('Unique constraint'), {
              code: 'P2002',
            });
          }
          const user: FakeUser = {
            id: `00000000-0000-4000-8000-${String(users.length + 1).padStart(12, '0')}`,
            role: 'user',
            isVisible: true,
            createdAt: new Date(),
            ...data,
          };
          users.push(user);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
          };
        },
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { email?: string; id?: string } }) =>
          users.find((u) =>
            where.email ? u.email === where.email : u.id === where.id,
          ) ?? null,
      ),
      findMany: vi.fn(
        async ({ where }: { where?: { id?: { not?: string } } } = {}) =>
          users
            .filter((u) => u.isVisible && u.id !== where?.id?.not)
            .map(({ id, name }) => ({ id, name, languages: [], hobbies: [] })),
      ),
    },
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    users,
  };
}

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof createFakePrisma>;
  const python = {
    health: vi.fn(async () => ({ status: 'ok' })),
    info: vi.fn(async () => ({ message: 'Python service funcionando' })),
  };

  const credentials = {
    name: 'Ana Pérez',
    email: 'ana@example.com',
    password: 'clave-segura-123',
  };
  const loginBody = {
    email: credentials.email,
    password: credentials.password,
  };

  beforeEach(async () => {
    prisma = createFakePrisma();
    python.health.mockResolvedValue({ status: 'ok' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PythonService)
      .useValue(python)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginToken(): Promise<string> {
    await request(app.getHttpServer()).post('/auth/register').send(credentials);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(loginBody);
    return res.body.accessToken as string;
  }

  describe('salud', () => {
    it('GET /health responde ok', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /health/ready responde ok si BD y Python están arriba', async () => {
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);
      expect(res.body.checks).toEqual({ database: 'up', python: 'up' });
    });

    it('GET /health/ready responde 503 si Python está caído', async () => {
      python.health.mockRejectedValue(new Error('caído'));
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);
      expect(res.body.checks.python).toBe('down');
    });
  });

  describe('observabilidad', () => {
    it('devuelve X-Request-Id en cada respuesta', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('conserva el identificador que envía el cliente', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'trazado-cliente-001')
        .expect(200);
      expect(res.headers['x-request-id']).toBe('trazado-cliente-001');
    });

    it('descarta un identificador malicioso o demasiado corto', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'corto')
        .expect(200);
      expect(res.headers['x-request-id']).not.toBe('corto');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('registra las peticiones (sin la query string) y las cuenta en las métricas', async () => {
      httpMetrics.reset();
      await request(app.getHttpServer())
        .get('/health/ready?secreto=1')
        .expect(200);
      await request(app.getHttpServer()).get('/no-existe').expect(404);
      const { routes, total } = httpMetrics.snapshot();
      expect(total).toBe(2);
      expect(routes.map((r) => r.route).sort()).toEqual([
        '/health/ready',
        'no-encontrada',
      ]);
      expect(routes.find((r) => r.route === 'no-encontrada')?.errors4xx).toBe(
        1,
      );
    });

    it('GET /metrics/http exige token y rol de administrador', async () => {
      await request(app.getHttpServer()).get('/metrics/http').expect(401);
      const token = await loginToken();
      await request(app.getHttpServer())
        .get('/metrics/http')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      prisma.users[0].role = 'admin';
      const res = await request(app.getHttpServer())
        .get('/metrics/http')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(Array.isArray(res.body.routes)).toBe(true);
    });
  });

  describe('registro', () => {
    it('crea el usuario y no devuelve la contraseña', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Ana Pérez',
        email: credentials.email,
        role: 'user',
      });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('normaliza el email a minúsculas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...credentials, email: '  ANA@Example.COM ' })
        .expect(201);
      expect(res.body.email).toBe('ana@example.com');
    });

    it('rechaza un email inválido con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...credentials, email: 'no-es-email' })
        .expect(400);
    });

    it('rechaza una contraseña corta con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...credentials, password: 'corta' })
        .expect(400);
    });

    it('rechaza campos no permitidos (p. ej. role) con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...credentials, role: 'admin' })
        .expect(400);
    });

    it('rechaza un registro sin nombre con 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: credentials.email, password: credentials.password })
        .expect(400);
    });

    it('responde 409 si el email ya existe', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(201);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(409);
    });
  });

  describe('login', () => {
    it('devuelve un token con credenciales correctas', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials);
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginBody)
        .expect(200);
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('responde 401 con contraseña incorrecta', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...loginBody, password: 'otra-clave-123' })
        .expect(401);
    });

    it('responde 401 si el usuario no existe', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginBody)
        .expect(401);
    });
  });

  describe('rutas protegidas', () => {
    it('GET /users sin token responde 401', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('GET /users con token lista a los demás usuarios sin contraseña', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Otro',
          email: 'otro@example.com',
          password: 'clave-segura-123',
        });
      const token = await loginToken();
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Otro'); // el propio usuario no aparece
      expect(res.body[0]).not.toHaveProperty('passwordHash');
      expect(res.body[0]).not.toHaveProperty('email');
    });

    it('GET /auth/me devuelve el usuario del token', async () => {
      const token = await loginToken();
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.email).toBe(credentials.email);
    });

    it('un token manipulado responde 401', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer token.falso.aqui')
        .expect(401);
    });

    it('GET /python/status exige token y consulta a Python', async () => {
      await request(app.getHttpServer()).get('/python/status').expect(401);
      const token = await loginToken();
      const res = await request(app.getHttpServer())
        .get('/python/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toMatchObject({ service: 'python', status: 'ok' });
    });
  });
});
