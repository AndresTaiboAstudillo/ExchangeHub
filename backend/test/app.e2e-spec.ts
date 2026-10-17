import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
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
            throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
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
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) =>
        users.find((u) => u.email === where.email) ?? null,
      ),
      findMany: vi.fn(async () =>
        users.filter((u) => u.isVisible).map(({ id, name }) => ({ id, name })),
      ),
    },
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
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
  const loginBody = { email: credentials.email, password: credentials.password };

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
    const res = await request(app.getHttpServer()).post('/auth/login').send(loginBody);
    return res.body.accessToken as string;
  }

  describe('salud', () => {
    it('GET /health responde ok', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /health/ready responde ok si BD y Python están arriba', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(res.body.checks).toEqual({ database: 'up', python: 'up' });
    });

    it('GET /health/ready responde 503 si Python está caído', async () => {
      python.health.mockRejectedValue(new Error('caído'));
      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
      expect(res.body.checks.python).toBe('down');
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
      await request(app.getHttpServer()).post('/auth/register').send(credentials).expect(201);
      await request(app.getHttpServer()).post('/auth/register').send(credentials).expect(409);
    });
  });

  describe('login', () => {
    it('devuelve un token con credenciales correctas', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(credentials);
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginBody)
        .expect(200);
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('responde 401 con contraseña incorrecta', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(credentials);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ ...loginBody, password: 'otra-clave-123' })
        .expect(401);
    });

    it('responde 401 si el usuario no existe', async () => {
      await request(app.getHttpServer()).post('/auth/login').send(loginBody).expect(401);
    });
  });

  describe('rutas protegidas', () => {
    it('GET /users sin token responde 401', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('GET /users con token lista usuarios sin contraseña', async () => {
      const token = await loginToken();
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
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
