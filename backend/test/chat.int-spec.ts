import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SEND_LIMIT } from '../src/chat/chat.gateway.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PythonService } from '../src/python/python.service.js';

process.env.JWT_SECRET = 'secreto-de-pruebas-con-al-menos-32-caracteres';

const DOMAIN = '@itest.local';
const PASSWORD = 'clave-segura-123';

interface Session {
  id: string;
  token: string;
  auth: { Authorization: string };
}
type Ack = { ok: boolean; [key: string]: any };

describe('Chat 1:1 y notificaciones (PostgreSQL real + Socket.IO)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url: string;
  const sockets: Socket[] = [];
  const api = () => request(app.getHttpServer());

  async function newUser(name: string): Promise<Session> {
    const email = `${randomUUID()}${DOMAIN}`;
    const reg = await api()
      .post('/auth/register')
      .send({ name, email, password: PASSWORD })
      .expect(201);
    const login = await api()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const token = login.body.accessToken as string;
    return {
      id: reg.body.id,
      token,
      auth: { Authorization: `Bearer ${token}` },
    };
  }

  async function befriend(a: Session, b: Session) {
    const sent = await api()
      .post('/friendships')
      .set(a.auth)
      .send({ addresseeId: b.id })
      .expect(201);
    await api()
      .patch(`/friendships/${sent.body.id}`)
      .set(b.auth)
      .send({ status: 'accepted' })
      .expect(200);
  }

  function open(
    session: Session | null,
    token = session?.token,
  ): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = connect(url, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  const once = <T = any>(socket: Socket, event: string) =>
    new Promise<T>((resolve) => socket.once(event, resolve));

  const send = (socket: Socket, to: string, body: unknown) =>
    new Promise<Ack>((resolve) =>
      socket.emit('chat:send', { to, body }, resolve),
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PythonService)
      .useValue({ health: vi.fn(), info: vi.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    configureApp(app);
    await app.listen(0);
    url = `http://127.0.0.1:${((app.getHttpServer() as unknown as import('node:net').Server).address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
  });

  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  describe('conexión', () => {
    it('rechaza sockets sin token o con token inválido', async () => {
      const ana = await newUser('Ana');
      const noToken = await new Promise<Socket>((resolve) => {
        const s = connect(url, {
          transports: ['websocket'],
          reconnection: false,
        });
        sockets.push(s);
        s.on('chat:error', () => resolve(s));
      });
      await vi.waitFor(() => expect(noToken.connected).toBe(false));
      const bad = await new Promise<Socket>((resolve) => {
        const s = connect(url, {
          auth: { token: ana.token + 'x' },
          transports: ['websocket'],
          reconnection: false,
        });
        sockets.push(s);
        s.on('chat:error', () => resolve(s));
      });
      await vi.waitFor(() => expect(bad.connected).toBe(false));
    });
  });

  describe('mensajes', () => {
    it('entrega un mensaje en vivo entre amigos y lo guarda', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      await befriend(ana, beto);
      const sa = await open(ana);
      const sb = await open(beto);

      const incoming = once(sb, 'chat:message');
      const ack = await send(sa, beto.id, '  Hola Beto  ');
      expect(ack.ok).toBe(true);
      expect(ack.message).toMatchObject({
        body: 'Hola Beto',
        senderId: ana.id,
        conversationWith: beto.id,
      });

      const msg = await incoming;
      expect(msg).toMatchObject({
        body: 'Hola Beto',
        senderId: ana.id,
        conversationWith: ana.id,
      });

      const stored = await prisma.message.findMany({
        where: { senderId: ana.id },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0].readAt).toBeNull();
    });

    it('no permite escribirle a quien no es amigo (ni con solicitud pendiente)', async () => {
      const ana = await newUser('Ana');
      const carla = await newUser('Carla');
      const dani = await newUser('Dani');
      await api()
        .post('/friendships')
        .set(ana.auth)
        .send({ addresseeId: dani.id })
        .expect(201);
      const sa = await open(ana);
      expect((await send(sa, carla.id, 'hola')).ok).toBe(false);
      expect((await send(sa, dani.id, 'hola')).ok).toBe(false);
      expect(await prisma.message.count({ where: { senderId: ana.id } })).toBe(
        0,
      );
    });

    it('no permite escribirse a sí mismo', async () => {
      const ana = await newUser('Ana');
      const sa = await open(ana);
      expect((await send(sa, ana.id, 'yo')).ok).toBe(false);
    });

    it('valida el contenido: vacío, solo espacios, demasiado largo y tipos erróneos', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      await befriend(ana, beto);
      const sa = await open(ana);
      for (const body of ['', '   ', 'x'.repeat(2001), 42, null]) {
        expect((await send(sa, beto.id, body)).ok).toBe(false);
      }
      expect((await send(sa, 'no-es-uuid', 'hola')).ok).toBe(false);
      expect((await send(sa, beto.id, 'x'.repeat(2000))).ok).toBe(true);
    });

    it('limita la frecuencia de envío por usuario', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      await befriend(ana, beto);
      const sa = await open(ana);
      const results: boolean[] = [];
      for (let i = 0; i < SEND_LIMIT.max + 3; i++)
        results.push((await send(sa, beto.id, `m${i}`)).ok);
      expect(results.filter(Boolean)).toHaveLength(SEND_LIMIT.max);
      expect(results.slice(SEND_LIMIT.max)).toEqual([false, false, false]);
    });

    it('si dejan de ser amigos, ya no se puede escribir ni leer el historial', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      await befriend(ana, beto);
      const sa = await open(ana);
      expect((await send(sa, beto.id, 'hola')).ok).toBe(true);
      const friendship = await prisma.friendship.findFirstOrThrow({
        where: { requesterId: ana.id },
      });
      await api()
        .delete(`/friendships/${friendship.id}`)
        .set(ana.auth)
        .expect(204);
      expect((await send(sa, beto.id, 'otra vez')).ok).toBe(false);
      await api()
        .get(`/chat/conversations/${beto.id}/messages`)
        .set(ana.auth)
        .expect(403);
    });
  });

  describe('historial, no leídos y presencia', () => {
    it('lista amigos con último mensaje y no leídos, y los marca como leídos', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      const cami = await newUser('Cami');
      await befriend(ana, beto);
      await befriend(ana, cami);
      const sb = await open(beto);
      const sa = await open(ana);
      await send(sb, ana.id, 'uno');
      await send(sb, ana.id, 'dos');

      const list = await api()
        .get('/chat/conversations')
        .set(ana.auth)
        .expect(200);
      expect(list.body.map((c: any) => c.friend.name)).toEqual([
        'Beto',
        'Cami',
      ]); // con conversación primero
      expect(list.body[0]).toMatchObject({
        unreadCount: 2,
        online: true,
        lastMessage: { body: 'dos', mine: false },
      });
      expect(list.body[1]).toMatchObject({
        unreadCount: 0,
        online: false,
        lastMessage: null,
      });

      const readEvent = once(sb, 'chat:read');
      const read = await new Promise<Ack>((r) =>
        sa.emit('chat:read', { with: beto.id }, r),
      );
      expect(read).toMatchObject({ ok: true, updated: 2 });
      expect(await readEvent).toMatchObject({ by: ana.id });

      const after = await api()
        .get('/chat/conversations')
        .set(ana.auth)
        .expect(200);
      expect(after.body[0].unreadCount).toBe(0);
    });

    it('pagina el historial con cursor, sin repetir ni perder mensajes', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      await befriend(ana, beto);
      const sa = await open(ana);
      for (let i = 1; i <= 5; i++) await send(sa, beto.id, `m${i}`);
      const first = await api()
        .get(`/chat/conversations/${beto.id}/messages?limit=3`)
        .set(ana.auth)
        .expect(200);
      expect(first.body.items.map((m: any) => m.body)).toEqual([
        'm5',
        'm4',
        'm3',
      ]);
      const second = await api()
        .get(
          `/chat/conversations/${beto.id}/messages?limit=3&cursor=${first.body.nextCursor}`,
        )
        .set(ana.auth)
        .expect(200);
      expect(second.body.items.map((m: any) => m.body)).toEqual(['m2', 'm1']);
      expect(second.body.nextCursor).toBeNull();
    });

    it('un tercero no puede leer la conversación de otros', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      const eva = await newUser('Eva');
      await befriend(ana, beto);
      await api()
        .get(`/chat/conversations/${beto.id}/messages`)
        .set(eva.auth)
        .expect(403);
      await api().get(`/chat/conversations/${beto.id}/messages`).expect(401);
    });

    it('avisa a los amigos cuando alguien se conecta o se desconecta', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      await befriend(ana, beto);
      const sa = await open(ana);
      const online = once(sa, 'presence');
      const sb = await open(beto);
      expect(await online).toEqual({ userId: beto.id, online: true });
      const offline = once(sa, 'presence');
      sb.disconnect();
      expect(await offline).toEqual({ userId: beto.id, online: false });
    });
  });

  describe('notificaciones', () => {
    it('se generan por solicitud, aceptación, like y respuesta, y no por actos propios', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      const sa = await open(ana);
      const live = once(sa, 'notification:new');

      const sent = await api()
        .post('/friendships')
        .set(beto.auth)
        .send({ addresseeId: ana.id })
        .expect(201);
      expect(await live).toMatchObject({
        type: 'friend_request',
        actor: { name: 'Beto' },
      });
      await api()
        .patch(`/friendships/${sent.body.id}`)
        .set(ana.auth)
        .send({ status: 'accepted' })
        .expect(200);

      const post = await api()
        .post('/posts')
        .set(ana.auth)
        .send({ category: 'ayuda', title: 'Mi título', body: 'Contenido' })
        .expect(201);
      await api().put(`/posts/${post.body.id}/like`).set(beto.auth).expect(200);
      await api().put(`/posts/${post.body.id}/like`).set(beto.auth).expect(200); // repetido: sin aviso nuevo
      await api().put(`/posts/${post.body.id}/like`).set(ana.auth).expect(200); // propio: sin aviso
      await api()
        .post(`/posts/${post.body.id}/replies`)
        .set(beto.auth)
        .send({ body: 'Me apunto' })
        .expect(201);

      const mine = await api().get('/notifications').set(ana.auth).expect(200);
      expect(mine.body.items.map((n: any) => n.type).sort()).toEqual([
        'friend_request',
        'post_like',
        'post_reply',
      ]);
      expect(mine.body.unreadCount).toBe(3);

      const forBeto = await api()
        .get('/notifications')
        .set(beto.auth)
        .expect(200);
      expect(forBeto.body.items.map((n: any) => n.type)).toEqual([
        'friend_accepted',
      ]);
    });

    it('marca una o todas como leídas, solo las propias', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      await api()
        .post('/friendships')
        .set(beto.auth)
        .send({ addresseeId: ana.id })
        .expect(201);
      const list = await api().get('/notifications').set(ana.auth).expect(200);
      const id = list.body.items[0].id as string;

      const stranger = await api()
        .post(`/notifications/${id}/read`)
        .set(beto.auth)
        .expect(200);
      expect(stranger.body.updated).toBe(0);
      expect(
        (await api().get('/notifications').set(ana.auth)).body.unreadCount,
      ).toBe(1);

      await api().post('/notifications/read-all').set(ana.auth).expect(200);
      expect(
        (await api().get('/notifications').set(ana.auth)).body.unreadCount,
      ).toBe(0);
    });
  });

  describe('base de datos', () => {
    it('impide dos conversaciones para el mismo par y pares desordenados', async () => {
      const ana = await newUser('Ana');
      const beto = await newUser('Beto');
      const [a, b] = ana.id < beto.id ? [ana.id, beto.id] : [beto.id, ana.id];
      await prisma.conversation.create({ data: { userAId: a, userBId: b } });
      await expect(
        prisma.conversation.create({ data: { userAId: a, userBId: b } }),
      ).rejects.toThrow();
      await expect(
        prisma.conversation.create({ data: { userAId: b, userBId: a } }),
      ).rejects.toThrow();
      await expect(
        prisma.conversation.create({ data: { userAId: a, userBId: a } }),
      ).rejects.toThrow();
    });
  });
});
