import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { allowedOrigins } from '../app.setup.js';
import type { JwtPayload } from '../auth/auth.types.js';
import { RealtimeService, userRoom } from '../realtime/realtime.service.js';
import { ChatService, MAX_MESSAGE_LENGTH } from './chat.service.js';
import { RateLimiter } from './rate-limiter.js';

type Reply = { ok: boolean; [key: string]: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Máximo 20 mensajes cada 10 segundos por usuario. */
export const SEND_LIMIT = { max: 20, windowMs: 10_000 };

/**
 * Chat 1:1 en tiempo real. El cliente se conecta con `io(url, { auth: { token } })`.
 * Eventos del cliente: `chat:send` { to, body }, `chat:read` { with }.
 * Eventos del servidor: `chat:message`, `chat:read`, `chat:read-own`, `presence`, `notification:new`.
 */
@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, !origin || allowedOrigins().includes(origin)),
  },
  // Un mensaje de 2000 caracteres cabe de sobra; evita que un cliente envíe paquetes enormes.
  maxHttpBufferSize: 16 * 1024,
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly limiter = new RateLimiter(
    SEND_LIMIT.max,
    SEND_LIMIT.windowMs,
  );

  constructor(
    private readonly jwt: JwtService,
    private readonly chat: ChatService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token: unknown = client.handshake.auth?.token;
    try {
      if (typeof token !== 'string' || !token) throw new Error('sin token');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      client.data.userId = payload.sub;
    } catch {
      client.emit('chat:error', { message: 'Token inválido o expirado' });
      client.disconnect(true);
      return;
    }

    const userId = client.data.userId as string;
    await client.join(userRoom(userId));
    if (this.realtime.connected(userId)) {
      await this.broadcastPresence(userId, true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    if (this.realtime.disconnected(userId)) {
      this.limiter.forget(userId);
      await this.broadcastPresence(userId, false);
    }
  }

  @SubscribeMessage('chat:send')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<Reply> {
    return this.handle(client, async (userId) => {
      const { to, body } = (payload ?? {}) as { to?: unknown; body?: unknown };
      if (
        typeof to !== 'string' ||
        !UUID.test(to) ||
        typeof body !== 'string'
      ) {
        return fail('Datos inválidos');
      }
      if (body.length > MAX_MESSAGE_LENGTH * 2)
        return fail('Mensaje demasiado largo');
      if (!this.limiter.allow(userId)) {
        return fail('Estás enviando mensajes demasiado rápido');
      }
      const message = await this.chat.send(userId, to.toLowerCase(), body);
      return { ok: true, message };
    });
  }

  @SubscribeMessage('chat:read')
  async onRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<Reply> {
    return this.handle(client, async (userId) => {
      const { with: other } = (payload ?? {}) as { with?: unknown };
      if (typeof other !== 'string' || !UUID.test(other)) {
        return fail('Datos inválidos');
      }
      const result = await this.chat.markRead(userId, other.toLowerCase());
      return { ok: true, ...result };
    });
  }

  private async handle(
    client: Socket,
    action: (userId: string) => Promise<Reply>,
  ): Promise<Reply> {
    const userId = client.data.userId as string | undefined;
    let response: Reply;
    if (!userId) {
      response = fail('No autenticado');
    } else {
      try {
        response = await action(userId);
      } catch (error) {
        const message =
          error instanceof Error && 'getStatus' in error
            ? error.message
            : 'No se pudo completar la acción';
        if (!('getStatus' in (error as object))) {
          this.logger.error(`Error en evento de chat: ${String(error)}`);
        }
        response = fail(message);
      }
    }
    return response; // Nest lo entrega como acuse (ack) al cliente
  }

  private async broadcastPresence(userId: string, online: boolean) {
    try {
      for (const friendId of await this.chat.presenceTargets(userId)) {
        this.realtime.emitToUser(friendId, 'presence', { userId, online });
      }
    } catch (error) {
      this.logger.warn(`No se pudo emitir la presencia: ${String(error)}`);
    }
  }
}

function fail(message: string) {
  return { ok: false, error: message };
}
