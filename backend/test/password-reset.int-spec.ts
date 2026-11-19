/**
 * Recuperación de contraseña, límite de intentos e invalidación de sesiones contra PostgreSQL real.
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashResetToken } from '../src/auth/auth.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PythonService } from '../src/python/python.service.js';

process.env.JWT_SECRET = 'secreto-de-pruebas-con-al-menos-32-caracteres';
process.env.FRONTEND_URL = 'https://exchangehub.test';

const PASSWORD = 'clave-segura-123';
const NEW_PASSWORD = 'otra-clave-nueva-456';

describe('Recuperación de contraseña (PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const python = { health: vi.fn(), info: vi.fn() };
  const mail = {
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    sendPasswordChanged: vi.fn().mockResolvedValue(undefined),
  };
  const api = () => request(app.getHttpServer());
  const created: string[] = [];

  async function newUser() {
    const email = `${randomUUID()}@itest.local`;
    const reg = await api()
      .post('/auth/register')
      .send({ name: 'Ana', email, password: PASSWORD })
      .expect(201);
    created.push(reg.body.id);
    return { id: reg.body.id as string, email };
  }
  const login = (email: string, password: string) =>
    api().post('/auth/login').send({ email, password });
  /** Pide el enlace y devuelve el token tal como llegaría en el correo. */
  async function requestToken(email: string): Promise<string> {
    mail.sendPasswordReset.mockClear();
    await api().post('/auth/forgot-password').send({ email }).expect(200);
    const link = mail.sendPasswordReset.mock.calls[0]![1] as string;
    expect(link.startsWith('https://exchangehub.test/restablecer?token=')).toBe(
      true,
    );
    return new URL(link).searchParams.get('token')!;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PythonService)
      .useValue(python)
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  beforeEach(() => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    mail.sendPasswordReset.mockClear();
    mail.sendPasswordChanged.mockClear();
  });

  it('responde igual exista o no el correo, y solo envía a cuentas reales', async () => {
    const ana = await newUser();
    const real = await api()
      .post('/auth/forgot-password')
      .send({ email: ana.email })
      .expect(200);
    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
    mail.sendPasswordReset.mockClear();
    const fake = await api()
      .post('/auth/forgot-password')
      .send({ email: `${randomUUID()}@itest.local` })
      .expect(200);
    expect(fake.body).toEqual(real.body);
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('guarda solo el hash del token, no el token', async () => {
    const ana = await newUser();
    const token = await requestToken(ana.email);
    const rows = await prisma.passwordResetToken.findMany({
      where: { userId: ana.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashResetToken(token));
    expect(rows[0]!.tokenHash).not.toContain(token);
  });

  it('restablece la contraseña: la vieja deja de servir, la nueva sirve y se avisa por correo', async () => {
    const ana = await newUser();
    const token = await requestToken(ana.email);
    await api()
      .post('/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(200);
    await login(ana.email, PASSWORD).expect(401);
    await login(ana.email, NEW_PASSWORD).expect(200);
    expect(mail.sendPasswordChanged).toHaveBeenCalledTimes(1);
  });

  it('el enlace sirve una sola vez', async () => {
    const ana = await newUser();
    const token = await requestToken(ana.email);
    await api()
      .post('/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(200);
    const again = await api()
      .post('/auth/reset-password')
      .send({ token, password: 'una-tercera-clave-789' })
      .expect(400);
    expect(again.body.message).toMatch(/no es válido o ya venció/);
    await login(ana.email, NEW_PASSWORD).expect(200);
  });

  it('un enlace vencido o inventado se rechaza con el mismo mensaje', async () => {
    const ana = await newUser();
    const token = await requestToken(ana.email);
    await prisma.passwordResetToken.updateMany({
      where: { userId: ana.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await api()
      .post('/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(400);
    const invented = await api()
      .post('/auth/reset-password')
      .send({ token: 'x'.repeat(43), password: NEW_PASSWORD })
      .expect(400);
    expect(invented.body.message).toBe(expired.body.message);
    await login(ana.email, PASSWORD).expect(200);
  });

  it('pedir otro enlace anula el anterior', async () => {
    const ana = await newUser();
    const first = await requestToken(ana.email);
    const second = await requestToken(ana.email);
    await api()
      .post('/auth/reset-password')
      .send({ token: first, password: NEW_PASSWORD })
      .expect(400);
    await api()
      .post('/auth/reset-password')
      .send({ token: second, password: NEW_PASSWORD })
      .expect(200);
  });

  it('valida la contraseña nueva y no consume el enlace si es inválida', async () => {
    const ana = await newUser();
    const token = await requestToken(ana.email);
    await api()
      .post('/auth/reset-password')
      .send({ token, password: 'corta' })
      .expect(400);
    await api()
      .post('/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(200);
  });

  it('dos usos simultáneos del mismo enlace: solo uno gana', async () => {
    const ana = await newUser();
    const token = await requestToken(ana.email);
    const results = await Promise.all(
      ['uno-clave-1234', 'dos-clave-5678'].map((password) =>
        api().post('/auth/reset-password').send({ token, password }),
      ),
    );
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 400]);
  });

  it('cerrar sesiones: el token anterior al cambio deja de valer, uno nuevo sí', async () => {
    const ana = await newUser();
    const old = await login(ana.email, PASSWORD).expect(200);
    const oldAuth = { Authorization: `Bearer ${old.body.accessToken}` };
    await api().get('/auth/me').set(oldAuth).expect(200);

    const token = await requestToken(ana.email);
    // El cambio ocurre en un segundo posterior al de la sesión vieja.
    await new Promise((r) => setTimeout(r, 1100));
    await api()
      .post('/auth/reset-password')
      .send({ token, password: NEW_PASSWORD })
      .expect(200);

    const res = await api().get('/auth/me').set(oldAuth).expect(401);
    expect(res.body.message).toMatch(/contraseña cambió/);
    const fresh = await login(ana.email, NEW_PASSWORD).expect(200);
    await api()
      .get('/auth/me')
      .set({ Authorization: `Bearer ${fresh.body.accessToken}` })
      .expect(200);
  });

  it('limita los intentos de inicio de sesión por cuenta y avisa cuánto esperar', async () => {
    process.env.RATE_LIMIT_DISABLED = 'false';
    const email = `${randomUUID()}@itest.local`;
    for (let i = 0; i < 10; i++) {
      await login(email, 'incorrecta-123').expect(401);
    }
    const blocked = await login(email, 'incorrecta-123').expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.message).toMatch(/Demasiados intentos/);
    // Otra cuenta desde la misma dirección no queda bloqueada por esa.
    await login(`${randomUUID()}@itest.local`, 'incorrecta-123').expect(401);
  });

  it('limita los pedidos de enlace por correo', async () => {
    process.env.RATE_LIMIT_DISABLED = 'false';
    const email = `${randomUUID()}@itest.local`;
    for (let i = 0; i < 3; i++) {
      await api().post('/auth/forgot-password').send({ email }).expect(200);
    }
    await api().post('/auth/forgot-password').send({ email }).expect(429);
  });
});
