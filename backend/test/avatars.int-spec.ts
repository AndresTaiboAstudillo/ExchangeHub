/**
 * Foto de perfil y lista de amigos contra PostgreSQL real.
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
// Cabeceras mínimas reales de cada formato (el servidor solo mira los primeros bytes).
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(200, 7),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(100, 3),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([1, 2, 3, 4]),
  Buffer.from('WEBP'),
  Buffer.alloc(50, 1),
]);
const dataUrl = (buf: Buffer, mime = 'image/jpeg') =>
  `data:${mime};base64,${buf.toString('base64')}`;

describe('Foto de perfil (PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const python = { health: vi.fn(), info: vi.fn() };
  const api = () => request(app.getHttpServer());
  const created: string[] = [];

  async function newUser(name: string) {
    const email = `${randomUUID()}@itest.local`;
    const reg = await api()
      .post('/auth/register')
      .send({ name, email, password: PASSWORD })
      .expect(201);
    created.push(reg.body.id);
    const login = await api()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      id: reg.body.id as string,
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
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  it('sin foto: el perfil no trae versión y el enlace responde 404', async () => {
    const ana = await newUser('Ana');
    const me = await api().get('/users/me').set(ana.auth).expect(200);
    expect(me.body.avatarUpdatedAt).toBeNull();
    await api().get(`/avatars/${ana.id}`).expect(404);
  });

  it('sube la foto, la sirve sin sesión con su tipo y caché largo', async () => {
    const ana = await newUser('Ana');
    const res = await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(JPEG) })
      .expect(200);
    expect(res.body.avatarUpdatedAt).toBeTruthy();
    const img = await api()
      .get(`/avatars/${ana.id}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(img.headers['content-type']).toContain('image/jpeg');
    expect(img.headers['cache-control']).toContain('immutable');
    expect(img.headers['x-content-type-options']).toBe('nosniff');
    expect(img.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect((img.body as Buffer).equals(JPEG)).toBe(true);
  });

  it('acepta PNG y WebP, y reemplazar la foto cambia la versión', async () => {
    const ana = await newUser('Ana');
    await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(PNG, 'image/png') })
      .expect(200);
    const first = (await api().get('/users/me').set(ana.auth)).body
      .avatarUpdatedAt;
    await new Promise((r) => setTimeout(r, 15));
    await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(WEBP, 'image/webp') })
      .expect(200);
    const second = (await api().get('/users/me').set(ana.auth)).body
      .avatarUpdatedAt;
    expect(second).not.toBe(first);
    const img = await api().get(`/avatars/${ana.id}`).expect(200);
    expect(img.headers['content-type']).toContain('image/webp');
    expect(await prisma.userAvatar.count({ where: { userId: ana.id } })).toBe(
      1,
    );
  });

  it('rechaza lo que no es una imagen, aunque diga serlo', async () => {
    const ana = await newUser('Ana');
    const fake = dataUrl(Buffer.from('<script>alert(1)</script>'), 'image/png');
    const res = await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: fake })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('imagen válida');
    for (const bad of [
      'no es una data url',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:text/html;base64,PGgxPg==',
      '',
    ]) {
      await api()
        .put('/users/me/avatar')
        .set(ana.auth)
        .send({ image: bad })
        .expect(400);
    }
    await api().put('/users/me/avatar').set(ana.auth).send({}).expect(400);
    expect(
      (await api().get('/users/me').set(ana.auth)).body.avatarUpdatedAt,
    ).toBeNull();
  });

  it('rechaza imágenes de más de 64 KB', async () => {
    const ana = await newUser('Ana');
    const big = Buffer.concat([JPEG, Buffer.alloc(65 * 1024, 1)]);
    await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(big) })
      .expect(400);
    const ok = Buffer.concat([JPEG, Buffer.alloc(60 * 1024, 1)]);
    await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(ok) })
      .expect(200);
  });

  it('exige sesión para subir o quitar, y el id debe ser un UUID', async () => {
    await api()
      .put('/users/me/avatar')
      .send({ image: dataUrl(JPEG) })
      .expect(401);
    await api().delete('/users/me/avatar').expect(401);
    await api().get('/avatars/no-es-uuid').expect(400);
    await api().get(`/avatars/${randomUUID()}`).expect(404);
  });

  it('quitar la foto la borra y vuelve a las iniciales', async () => {
    const ana = await newUser('Ana');
    await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(JPEG) })
      .expect(200);
    const res = await api()
      .delete('/users/me/avatar')
      .set(ana.auth)
      .expect(200);
    expect(res.body.avatarUpdatedAt).toBeNull();
    await api().get(`/avatars/${ana.id}`).expect(404);
    await api().delete('/users/me/avatar').set(ana.auth).expect(200); // idempotente
  });

  it('cada persona solo cambia su propia foto', async () => {
    const ana = await newUser('Ana');
    const beto = await newUser('Beto');
    await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(JPEG) })
      .expect(200);
    await api().delete('/users/me/avatar').set(beto.auth).expect(200);
    await api().get(`/avatars/${ana.id}`).expect(200);
    await api().get(`/avatars/${beto.id}`).expect(404);
  });

  it('la foto llega en el listado, el perfil público, el foro, las reseñas y los amigos', async () => {
    const ana = await newUser('Ana Foto');
    const beto = await newUser('Beto Visor');
    await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(JPEG) })
      .expect(200);

    const list = await api().get('/users').set(beto.auth).expect(200);
    expect(
      list.body.find((u: { id: string }) => u.id === ana.id).avatarUpdatedAt,
    ).toBeTruthy();
    const profile = await api()
      .get(`/users/${ana.id}`)
      .set(beto.auth)
      .expect(200);
    expect(profile.body.avatarUpdatedAt).toBeTruthy();

    const post = await api()
      .post('/posts')
      .set(ana.auth)
      .send({
        category: 'general',
        title: 'Hola',
        body: 'Mi primera publicación',
      })
      .expect(201);
    expect(post.body.author.avatarUpdatedAt).toBeTruthy();

    const place = await prisma.place.create({
      data: {
        name: 'Lugar foto',
        category: 'panaderia',
        latitude: -33,
        longitude: -71,
        externalId: randomUUID(),
        contentHash: 'x',
        fetchedAt: new Date(),
      },
    });
    try {
      await api()
        .put(`/map/places/${place.id}/reviews`)
        .set(ana.auth)
        .send({ rating: 4 })
        .expect(200);
      const reviews = await api()
        .get(`/map/places/${place.id}/reviews`)
        .set(beto.auth)
        .expect(200);
      expect(reviews.body.items[0].author.avatarUpdatedAt).toBeTruthy();
      // Con el perfil oculto, ni el nombre ni la foto llegan a otras personas.
      await prisma.user.update({
        where: { id: ana.id },
        data: { isVisible: false },
      });
      const hidden = await api()
        .get(`/map/places/${place.id}/reviews`)
        .set(beto.auth)
        .expect(200);
      expect(hidden.body.items[0].author).toEqual({
        id: null,
        name: 'Estudiante',
        countryOfOrigin: null,
        avatarUpdatedAt: null,
      });
    } finally {
      await prisma.review.deleteMany({ where: { targetId: place.id } });
      await prisma.place.delete({ where: { id: place.id } });
    }
  });

  it('la lista de amigos trae solo amigos aceptados, con carrera, país y foto', async () => {
    const ana = await newUser('Ana Lista');
    const beto = await newUser('Beto Amigo');
    const carla = await newUser('Carla Pendiente');
    const dani = await newUser('Dani Ajeno');
    await api()
      .patch('/users/me')
      .set(beto.auth)
      .send({ career: 'Ingeniería', countryOfOrigin: 'España' })
      .expect(200);
    await api()
      .put('/users/me/avatar')
      .set(beto.auth)
      .send({ image: dataUrl(JPEG) })
      .expect(200);

    const toBeto = await api()
      .post('/friendships')
      .set(ana.auth)
      .send({ addresseeId: beto.id })
      .expect(201);
    await api()
      .patch(`/friendships/${toBeto.body.id}`)
      .set(beto.auth)
      .send({ status: 'accepted' })
      .expect(200);
    await api()
      .post('/friendships')
      .set(ana.auth)
      .send({ addresseeId: carla.id })
      .expect(201);

    const friends = await api()
      .get('/friendships?status=accepted')
      .set(ana.auth)
      .expect(200);
    expect(friends.body).toHaveLength(1);
    expect(friends.body[0].user).toMatchObject({
      id: beto.id,
      name: 'Beto Amigo',
      career: 'Ingeniería',
      countryOfOrigin: 'España',
    });
    expect(friends.body[0].user.avatarUpdatedAt).toBeTruthy();
    // Beto la ve a ella como amiga; Dani no ve a nadie.
    const back = await api()
      .get('/friendships?status=accepted')
      .set(beto.auth)
      .expect(200);
    expect(back.body.map((f: { user: { id: string } }) => f.user.id)).toEqual([
      ana.id,
    ]);
    expect(
      (
        await api()
          .get('/friendships?status=accepted')
          .set(dani.auth)
          .expect(200)
      ).body,
    ).toEqual([]);
  });

  it('al eliminar la cuenta se elimina su foto', async () => {
    const ana = await newUser('Ana Borrada');
    await api()
      .put('/users/me/avatar')
      .set(ana.auth)
      .send({ image: dataUrl(JPEG) })
      .expect(200);
    await prisma.user.delete({ where: { id: ana.id } });
    expect(await prisma.userAvatar.count({ where: { userId: ana.id } })).toBe(
      0,
    );
    await api().get(`/avatars/${ana.id}`).expect(404);
  });
});
