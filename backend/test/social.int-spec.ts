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

const DOMAIN = '@itest.local';
const PASSWORD = 'clave-segura-123';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

interface Session {
  id: string;
  token: string;
  auth: { Authorization: string };
}

describe('Funcionalidades sociales (PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  async function newUser(name: string): Promise<Session> {
    const email = `${randomUUID()}${DOMAIN}`;
    const reg = await api().post('/auth/register').send({ name, email, password: PASSWORD }).expect(201);
    const login = await api().post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    const token = login.body.accessToken as string;
    return { id: reg.body.id as string, token, auth: { Authorization: `Bearer ${token}` } };
  }

  async function newPost(author: Session, extra: Record<string, string> = {}) {
    const res = await api()
      .post('/posts')
      .set(author.auth)
      .send({ category: 'ayuda', title: 'Título', body: 'Contenido', ...extra })
      .expect(201);
    return res.body as { id: string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PythonService)
      .useValue({ health: vi.fn(), info: vi.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Borrar los usuarios borra en cascada todo lo que crearon las pruebas.
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  describe('perfil', () => {
    it('GET /users/me devuelve el perfil propio con listas vacías', async () => {
      const ana = await newUser('Ana');
      const res = await api().get('/users/me').set(ana.auth).expect(200);
      expect(res.body).toMatchObject({
        id: ana.id,
        name: 'Ana',
        role: 'user',
        isVisible: true,
        languages: [],
        hobbies: [],
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('el registro guarda la universidad de origen y el perfil trae contadores', async () => {
      const email = `${randomUUID()}${DOMAIN}`;
      await api()
        .post('/auth/register')
        .send({ name: 'Eva', email, password: PASSWORD, universityOrigin: ' Universidad de Barcelona ' })
        .expect(201);
      const login = await api().post('/auth/login').send({ email, password: PASSWORD }).expect(200);
      const auth = { Authorization: `Bearer ${login.body.accessToken}` };

      const me = await api().get('/users/me').set(auth).expect(200);
      expect(me.body).toMatchObject({
        universityOrigin: 'Universidad de Barcelona',
        postsCount: 0,
        friendsCount: 0,
      });
    });

    it('los contadores del perfil cuentan publicaciones y amistades aceptadas', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const otra = await newUser('Otra');
      await newPost(ana);
      await newPost(ana);

      const sent = await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(201);
      await api().post('/friendships').set(otra.auth).send({ addresseeId: ana.id }).expect(201); // pendiente
      let me = await api().get('/users/me').set(ana.auth).expect(200);
      expect(me.body).toMatchObject({ postsCount: 2, friendsCount: 0 }); // las pendientes no cuentan

      await api().patch(`/friendships/${sent.body.id}`).set(luis.auth).send({ status: 'accepted' }).expect(200);
      me = await api().get('/users/me').set(ana.auth).expect(200);
      expect(me.body.friendsCount).toBe(1);
      const meLuis = await api().get('/users/me').set(luis.auth).expect(200);
      expect(meLuis.body.friendsCount).toBe(1); // cuenta para ambos lados
    });

    it('el directorio excluye al propio usuario e incluye idiomas e intereses', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      await api().patch('/users/me').set(luis.auth).send({ languageCodes: ['ja', 'es'], hobbies: ['Fotografía'] }).expect(200);

      const list = await api().get('/users').set(ana.auth).expect(200);
      const ids = list.body.map((u: { id: string }) => u.id);
      expect(ids).not.toContain(ana.id);
      const entry = list.body.find((u: { id: string }) => u.id === luis.id);
      expect(entry).toMatchObject({ name: 'Luis', languages: ['es', 'ja'], hobbies: ['Fotografía'] });
      expect(entry).not.toHaveProperty('email');
    });

    it('PATCH /users/me actualiza campos y reemplaza idiomas y hobbies', async () => {
      const ana = await newUser('Ana');
      const res = await api()
        .patch('/users/me')
        .set(ana.auth)
        .send({
          name: '  Ana María ',
          countryOfOrigin: 'Chile',
          career: 'Ingeniería',
          bio: 'Hola',
          languageCodes: ['ES', 'en', 'es', 'pt-BR'],
          hobbies: ['fútbol', 'Lectura', 'fútbol'],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Ana María',
        countryOfOrigin: 'Chile',
        career: 'Ingeniería',
        bio: 'Hola',
      });
      expect(res.body.languages).toEqual(['en', 'es', 'pt-br']);
      expect(res.body.hobbies).toEqual(['fútbol', 'Lectura']);

      const again = await api()
        .patch('/users/me')
        .set(ana.auth)
        .send({ languageCodes: ['fr'], hobbies: [], bio: null })
        .expect(200);
      expect(again.body.languages).toEqual(['fr']);
      expect(again.body.hobbies).toEqual([]);
      expect(again.body.bio).toBeNull();
      expect(again.body.career).toBe('Ingeniería'); // lo no enviado no cambia
    });

    it('rechaza datos inválidos y campos no permitidos con 400', async () => {
      const ana = await newUser('Ana');
      const bad = [
        { languageCodes: ['español'] },
        { name: '' },
        { name: null },
        { role: 'admin' },
        { isVisible: 'si' },
        { hobbies: [''] },
      ];
      for (const body of bad) {
        await api().patch('/users/me').set(ana.auth).send(body).expect(400);
      }
    });

    it('un perfil público no muestra email ni rol', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const res = await api().get(`/users/${ana.id}`).set(luis.auth).expect(200);
      expect(res.body.name).toBe('Ana');
      expect(res.body).not.toHaveProperty('email');
      expect(res.body).not.toHaveProperty('role');
    });

    it('un perfil oculto solo lo ve su dueño y sale del directorio', async () => {
      const ana = await newUser('Ana Oculta');
      const luis = await newUser('Luis');
      await api().patch('/users/me').set(ana.auth).send({ isVisible: false }).expect(200);

      await api().get(`/users/${ana.id}`).set(luis.auth).expect(404);
      await api().get(`/users/${ana.id}`).set(ana.auth).expect(200);
      const list = await api().get('/users').set(luis.auth).expect(200);
      expect(list.body.map((u: { id: string }) => u.id)).not.toContain(ana.id);
    });

    it('valida el id y requiere token', async () => {
      const ana = await newUser('Ana');
      await api().get('/users/no-es-uuid').set(ana.auth).expect(400);
      await api().get(`/users/${MISSING_ID}`).set(ana.auth).expect(404);
      await api().get('/users/me').expect(401);
    });
  });

  describe('publicaciones', () => {
    it('crea y lista publicaciones con contadores y likedByMe', async () => {
      const ana = await newUser('Ana');
      const post = await newPost(ana, { category: `cat-${randomUUID()}` });
      const found = await api().get(`/posts/${post.id}`).set(ana.auth).expect(200);
      expect(found.body).toMatchObject({ likesCount: 0, likedByMe: false, replies: [] });
      expect(found.body.author).toEqual({ id: ana.id, name: 'Ana', countryOfOrigin: null });

      const list = await api().get('/posts').set(ana.auth).expect(200);
      const item = list.body.items.find((p: { id: string }) => p.id === post.id);
      expect(item).toMatchObject({ repliesCount: 0, likedByMe: false });
    });

    it('filtra por categoría y pagina con cursor', async () => {
      const ana = await newUser('Ana');
      const category = `cat-${randomUUID()}`;
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) ids.push((await newPost(ana, { category, title: `P${i}` })).id);

      const first = await api().get('/posts').query({ category, limit: 2 }).set(ana.auth).expect(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).toBe(first.body.items[1].id);

      const second = await api()
        .get('/posts')
        .query({ category, limit: 2, cursor: first.body.nextCursor })
        .set(ana.auth)
        .expect(200);
      expect(second.body.items).toHaveLength(1);
      expect(second.body.nextCursor).toBeNull();

      const all = [...first.body.items, ...second.body.items].map((p: { id: string }) => p.id);
      expect(new Set(all)).toEqual(new Set(ids));
    });

    it('valida la entrada con 400', async () => {
      const ana = await newUser('Ana');
      await api().post('/posts').set(ana.auth).send({ category: 'x', title: '', body: 'b' }).expect(400);
      await api().post('/posts').set(ana.auth).send({ title: 't', body: 'b' }).expect(400);
      await api().get('/posts').query({ limit: 500 }).set(ana.auth).expect(400);
      await api().get('/posts').query({ cursor: 'xx' }).set(ana.auth).expect(400);
      await api().post('/posts').send({}).expect(401);
    });

    it('permite responder y muestra las respuestas en orden', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const post = await newPost(ana);

      await api().post(`/posts/${post.id}/replies`).set(luis.auth).send({ body: 'Primera' }).expect(201);
      await api().post(`/posts/${post.id}/replies`).set(ana.auth).send({ body: 'Segunda' }).expect(201);
      await api().post(`/posts/${post.id}/replies`).set(ana.auth).send({ body: '' }).expect(400);
      await api().post(`/posts/${MISSING_ID}/replies`).set(ana.auth).send({ body: 'x' }).expect(404);

      const found = await api().get(`/posts/${post.id}`).set(ana.auth).expect(200);
      expect(found.body.replies.map((r: { body: string }) => r.body)).toEqual(['Primera', 'Segunda']);

      const list = await api().get('/posts').set(ana.auth).expect(200);
      const item = list.body.items.find((p: { id: string }) => p.id === post.id);
      expect(item.repliesCount).toBe(2);
    });

    it('solo el autor borra una respuesta', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const post = await newPost(ana);
      const reply = await api().post(`/posts/${post.id}/replies`).set(luis.auth).send({ body: 'Hola' }).expect(201);
      const url = `/posts/${post.id}/replies/${reply.body.id}`;

      await api().delete(url).set(ana.auth).expect(403);
      await api().delete(url).set(luis.auth).expect(204);
      await api().delete(url).set(luis.auth).expect(404);
    });

    it('los likes son idempotentes y llevan la cuenta', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const post = await newPost(ana);
      const like = (s: Session) => api().put(`/posts/${post.id}/like`).set(s.auth);
      const unlike = (s: Session) => api().delete(`/posts/${post.id}/like`).set(s.auth);

      expect((await like(ana).expect(200)).body).toEqual({ liked: true, likesCount: 1 });
      expect((await like(ana).expect(200)).body.likesCount).toBe(1); // repetido: no suma
      expect((await like(luis).expect(200)).body.likesCount).toBe(2);

      const seen = await api().get(`/posts/${post.id}`).set(luis.auth).expect(200);
      expect(seen.body).toMatchObject({ likesCount: 2, likedByMe: true });

      expect((await unlike(ana).expect(200)).body).toEqual({ liked: false, likesCount: 1 });
      expect((await unlike(ana).expect(200)).body.likesCount).toBe(1); // repetido: no resta
      expect((await unlike(luis).expect(200)).body.likesCount).toBe(0);
    });

    it('cinco likes simultáneos del mismo usuario cuentan uno', async () => {
      const ana = await newUser('Ana');
      const post = await newPost(ana);
      await Promise.all(
        Array.from({ length: 5 }, () => api().put(`/posts/${post.id}/like`).set(ana.auth).expect(200)),
      );
      const found = await api().get(`/posts/${post.id}`).set(ana.auth).expect(200);
      expect(found.body.likesCount).toBe(1);
      expect(await prisma.postLike.count({ where: { postId: post.id } })).toBe(1);
    });

    it('like a una publicación inexistente responde 404', async () => {
      const ana = await newUser('Ana');
      await api().put(`/posts/${MISSING_ID}/like`).set(ana.auth).expect(404);
      await api().delete(`/posts/${MISSING_ID}/like`).set(ana.auth).expect(404);
    });

    it('solo el autor borra la publicación, y se borran sus respuestas y likes', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const post = await newPost(ana);
      await api().post(`/posts/${post.id}/replies`).set(luis.auth).send({ body: 'Hola' }).expect(201);
      await api().put(`/posts/${post.id}/like`).set(luis.auth).expect(200);

      await api().delete(`/posts/${post.id}`).set(luis.auth).expect(403);
      await api().delete(`/posts/${post.id}`).set(ana.auth).expect(204);
      await api().get(`/posts/${post.id}`).set(ana.auth).expect(404);
      expect(await prisma.postReply.count({ where: { postId: post.id } })).toBe(0);
      expect(await prisma.postLike.count({ where: { postId: post.id } })).toBe(0);
    });
  });

  describe('amistades', () => {
    it('envía una solicitud pendiente y ambos la ven con su dirección', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const sent = await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(201);
      expect(sent.body).toMatchObject({ status: 'pending', direction: 'sent', user: { id: luis.id } });

      const anaList = await api().get('/friendships').set(ana.auth).expect(200);
      expect(anaList.body).toHaveLength(1);
      expect(anaList.body[0]).toMatchObject({ direction: 'sent', user: { id: luis.id, name: 'Luis' } });

      const luisList = await api().get('/friendships').set(luis.auth).expect(200);
      expect(luisList.body[0]).toMatchObject({ direction: 'received', user: { id: ana.id, name: 'Ana' } });
    });

    it('rechaza solicitudes inválidas', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      await api().post('/friendships').set(ana.auth).send({ addresseeId: ana.id }).expect(400);
      await api().post('/friendships').set(ana.auth).send({ addresseeId: 'xx' }).expect(400);
      await api().post('/friendships').set(ana.auth).send({ addresseeId: MISSING_ID }).expect(404);

      await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(201);
      await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(409); // repetida
      await api().post('/friendships').set(luis.auth).send({ addresseeId: ana.id }).expect(409); // inversa
    });

    it('solo el destinatario responde, una sola vez', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const otra = await newUser('Otra');
      const sent = await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(201);
      const url = `/friendships/${sent.body.id}`;

      await api().patch(url).set(ana.auth).send({ status: 'accepted' }).expect(404); // el que envía
      await api().patch(url).set(otra.auth).send({ status: 'accepted' }).expect(404); // un tercero
      await api().patch(url).set(luis.auth).send({ status: 'pending' }).expect(400);
      await api().patch(url).set(luis.auth).send({ status: 'accepted' }).expect(200);
      await api().patch(url).set(luis.auth).send({ status: 'rejected' }).expect(409);

      const accepted = await api().get('/friendships').query({ status: 'accepted' }).set(ana.auth).expect(200);
      expect(accepted.body).toHaveLength(1);
      await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(409); // ya son amigos
    });

    it('una solicitud rechazada la ve el destinatario pero no quien la envió', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const sent = await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(201);
      await api().patch(`/friendships/${sent.body.id}`).set(luis.auth).send({ status: 'rejected' }).expect(200);

      expect((await api().get('/friendships').set(ana.auth).expect(200)).body).toHaveLength(0);
      expect((await api().get('/friendships').set(luis.auth).expect(200)).body).toHaveLength(1);
    });

    it('cualquiera de las dos partes puede eliminar; un tercero no', async () => {
      const ana = await newUser('Ana');
      const luis = await newUser('Luis');
      const otra = await newUser('Otra');
      const sent = await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(201);
      const url = `/friendships/${sent.body.id}`;

      await api().delete(url).set(otra.auth).expect(404);
      await api().delete(url).set(ana.auth).expect(204); // cancelar
      await api().delete(url).set(ana.auth).expect(404);
      await api().post('/friendships').set(ana.auth).send({ addresseeId: luis.id }).expect(201); // se puede reenviar
    });

    it('valida el filtro de estado y requiere token', async () => {
      const ana = await newUser('Ana');
      await api().get('/friendships').query({ status: 'otro' }).set(ana.auth).expect(400);
      await api().get('/friendships').expect(401);
    });
  });
});
