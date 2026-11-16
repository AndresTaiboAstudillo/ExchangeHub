/**
 * Administración contra PostgreSQL real: eliminar usuarios por correo, con todo lo que dejaron.
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PythonService } from '../src/python/python.service.js';

process.env.JWT_SECRET = 'secreto-de-pruebas-con-al-menos-32-caracteres';

const PASSWORD = 'clave-segura-123';

describe('Administración (PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const python = { health: vi.fn(), info: vi.fn() };
  const api = () => request(app.getHttpServer());
  const created: string[] = [];

  async function newUser(name: string, role?: string) {
    const email = `${randomUUID()}@itest.local`;
    const reg = await api()
      .post('/auth/register')
      .send({ name, email, password: PASSWORD })
      .expect(201);
    created.push(reg.body.id);
    if (role)
      await prisma.user.update({ where: { id: reg.body.id }, data: { role } });
    const login = await api()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      id: reg.body.id as string,
      email,
      auth: { Authorization: `Bearer ${login.body.accessToken}` },
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PythonService)
      .useValue(python)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.listing.deleteMany({ where: { authorId: { in: created } } });
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  it('solo los administradores pueden consultar y eliminar', async () => {
    const admin = await newUser('Admin', 'admin');
    const member = await newUser('Miembro');
    const target = await newUser('Objetivo');
    await api().get('/admin/users').query({ email: target.email }).expect(401);
    for (const call of ['get', 'delete'] as const) {
      await api()
        [call]('/admin/users')
        .set(member.auth)
        .query({ email: target.email })
        .expect(403);
    }
    await api()
      .get('/admin/users')
      .set(admin.auth)
      .query({ email: target.email })
      .expect(200);
    expect(await prisma.user.count({ where: { id: target.id } })).toBe(1);
  });

  it('valida el correo, ignora mayúsculas y espacios, y responde 404 si no existe', async () => {
    const admin = await newUser('Admin', 'admin');
    const target = await newUser('Objetivo');
    await api()
      .get('/admin/users')
      .set(admin.auth)
      .query({ email: 'no-es-correo' })
      .expect(400);
    await api().get('/admin/users').set(admin.auth).expect(400);
    await api()
      .get('/admin/users')
      .set(admin.auth)
      .query({ email: 'nadie@itest.local' })
      .expect(404);
    const res = await api()
      .get('/admin/users')
      .set(admin.auth)
      .query({ email: `  ${target.email.toUpperCase()} ` })
      .expect(200);
    expect(res.body).toMatchObject({ id: target.id, name: 'Objetivo' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('elimina la cuenta y todo lo que dejó, sin tocar lo de otras personas', async () => {
    const admin = await newUser('Admin', 'admin');
    const target = await newUser('Objetivo');
    const other = await newUser('Otra Persona');

    // Contenido de la persona que se elimina.
    const post = await prisma.post.create({
      data: {
        authorId: target.id,
        category: 'general',
        title: 'Mío',
        body: 'x',
      },
    });
    const otherPost = await prisma.post.create({
      data: {
        authorId: other.id,
        category: 'general',
        title: 'Ajeno',
        body: 'y',
      },
    });
    await prisma.postReply.create({
      data: { postId: otherPost.id, authorId: target.id, body: 'comentario' },
    });
    await prisma.postReply.create({
      data: { postId: post.id, authorId: other.id, body: 'respuesta al mío' },
    });
    await prisma.postLike.create({
      data: { postId: otherPost.id, userId: target.id },
    });
    await prisma.friendship.create({
      data: {
        requesterId: target.id,
        addresseeId: other.id,
        status: 'accepted',
      },
    });
    const [a, b] = [target.id, other.id].sort();
    const conversation = await prisma.conversation.create({
      data: { userAId: a, userBId: b },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: target.id,
        body: 'hola',
      },
    });
    await prisma.notification.create({
      data: { userId: other.id, actorId: target.id, type: 'friend_accepted' },
    });
    const place = await prisma.place.create({
      data: {
        externalId: `node/${randomUUID()}`,
        category: 'feria',
        name: 'Lugar de prueba admin',
        latitude: -33.04,
        longitude: -71.6,
        contentHash: 'h',
        fetchedAt: new Date(),
      },
    });
    await prisma.review.create({
      data: {
        authorId: target.id,
        targetType: 'place',
        targetId: place.id,
        rating: 4,
      },
    });
    // Un arriendo de esa persona, con una reseña de otra.
    const listing = await prisma.listing.create({
      data: {
        authorId: target.id,
        type: 'alojamiento',
        name: 'Arriendo',
        latitude: -33,
        longitude: -71,
      },
    });
    await prisma.review.create({
      data: {
        authorId: other.id,
        targetType: 'listing',
        targetId: listing.id,
        rating: 5,
      },
    });

    const preview = await api()
      .get('/admin/users')
      .set(admin.auth)
      .query({ email: target.email })
      .expect(200);
    expect(preview.body.content).toEqual({
      posts: 1,
      replies: 1,
      reviews: 1,
      listings: 1,
      messages: 1,
    });

    const res = await api()
      .delete('/admin/users')
      .set(admin.auth)
      .query({ email: target.email })
      .expect(200);
    expect(res.body).toMatchObject({
      deleted: { id: target.id, name: 'Objetivo' },
      content: { posts: 1, listings: 1 },
    });

    expect(await prisma.user.count({ where: { id: target.id } })).toBe(0);
    expect(await prisma.post.count({ where: { id: post.id } })).toBe(0);
    expect(await prisma.postReply.count({ where: { postId: post.id } })).toBe(
      0,
    ); // respuestas a su publicación
    expect(
      await prisma.postReply.count({ where: { authorId: target.id } }),
    ).toBe(0);
    expect(await prisma.postLike.count({ where: { userId: target.id } })).toBe(
      0,
    );
    expect(
      await prisma.friendship.count({ where: { requesterId: target.id } }),
    ).toBe(0);
    expect(
      await prisma.conversation.count({ where: { id: conversation.id } }),
    ).toBe(0);
    expect(await prisma.message.count({ where: { senderId: target.id } })).toBe(
      0,
    );
    expect(
      await prisma.notification.count({ where: { actorId: target.id } }),
    ).toBe(0);
    expect(await prisma.review.count({ where: { authorId: target.id } })).toBe(
      0,
    );
    expect(await prisma.listing.count({ where: { id: listing.id } })).toBe(0);
    // Las reseñas que otras personas dejaron en su arriendo no quedan huérfanas.
    expect(await prisma.review.count({ where: { targetId: listing.id } })).toBe(
      0,
    );

    // Lo de otras personas sigue ahí.
    expect(await prisma.user.count({ where: { id: other.id } })).toBe(1);
    expect(await prisma.post.count({ where: { id: otherPost.id } })).toBe(1);
    expect(await prisma.place.count({ where: { id: place.id } })).toBe(1);
    await prisma.place.delete({ where: { id: place.id } });
  });

  it('la cuenta eliminada pierde la sesión al instante y no puede volver a entrar', async () => {
    const admin = await newUser('Admin', 'admin');
    const target = await newUser('Objetivo');
    await api().get('/users/me').set(target.auth).expect(200);
    await api()
      .delete('/admin/users')
      .set(admin.auth)
      .query({ email: target.email })
      .expect(200);
    const after = await api().get('/users/me').set(target.auth).expect(401);
    expect(after.body.message).toBe('La cuenta ya no existe');
    await api().get('/posts').set(target.auth).expect(401);
    await api()
      .post('/auth/login')
      .send({ email: target.email, password: PASSWORD })
      .expect(401);
    // Una segunda vez ya no existe.
    await api()
      .delete('/admin/users')
      .set(admin.auth)
      .query({ email: target.email })
      .expect(404);
  });

  it('no permite eliminarse a sí mismo ni a otro administrador', async () => {
    const admin = await newUser('Admin', 'admin');
    const other = await newUser('Otro Admin', 'admin');
    const self = await api()
      .delete('/admin/users')
      .set(admin.auth)
      .query({ email: admin.email })
      .expect(409);
    expect(self.body.message).toMatch(/tu propia cuenta/);
    const peer = await api()
      .delete('/admin/users')
      .set(admin.auth)
      .query({ email: other.email })
      .expect(409);
    expect(peer.body.message).toMatch(/quítale primero el rol/);
    expect(
      await prisma.user.count({ where: { id: { in: [admin.id, other.id] } } }),
    ).toBe(2);
    // Con el rol quitado, sí se puede.
    await prisma.user.update({
      where: { id: other.id },
      data: { role: 'user' },
    });
    await api()
      .delete('/admin/users')
      .set(admin.auth)
      .query({ email: other.email })
      .expect(200);
  });

  it('un administrador que pierde el rol ya no puede eliminar a nadie', async () => {
    const admin = await newUser('Admin', 'admin');
    const target = await newUser('Objetivo');
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'user' },
    });
    await api()
      .delete('/admin/users')
      .set(admin.auth)
      .query({ email: target.email })
      .expect(403);
    expect(await prisma.user.count({ where: { id: target.id } })).toBe(1);
  });
});
