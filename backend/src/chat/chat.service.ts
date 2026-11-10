import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { toPage } from '../common/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

export const MAX_MESSAGE_LENGTH = 2000;

const messageSelect = {
  id: true,
  senderId: true,
  body: true,
  createdAt: true,
  readAt: true,
  conversation: { select: { userAId: true, userBId: true } },
} as const;

export interface ChatMessage {
  id: string;
  conversationWith: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

/** El par se guarda ordenado para que exista una sola conversación por pareja. */
export function orderedPair(a: string, b: string): [string, string] {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  return x < y ? [x, y] : [y, x];
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Ids de mis amigos (amistades aceptadas, en cualquier dirección). */
  async friendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) =>
      r.requesterId === userId ? r.addresseeId : r.requesterId,
    );
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const count = await this.prisma.friendship.count({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
    return count > 0;
  }

  private async assertFriends(userId: string, friendId: string) {
    if (!(await this.areFriends(userId, friendId))) {
      throw new ForbiddenException('Solo puedes chatear con tus amigos');
    }
  }

  /**
   * Mis amigos con su último mensaje, los no leídos y si están en línea. Los que tienen
   * conversación reciente aparecen primero.
   */
  async listConversations(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        requesterId: true,
        requester: { select: { id: true, name: true } },
        addressee: { select: { id: true, name: true } },
      },
    });
    const friends = friendships.map((f) =>
      f.requesterId === userId ? f.addressee : f.requester,
    );
    if (friends.length === 0) return [];

    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        lastMessageAt: true,
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { body: true, senderId: true, createdAt: true },
        },
      },
    });
    const unread = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        senderId: { not: userId },
        readAt: null,
        conversation: { OR: [{ userAId: userId }, { userBId: userId }] },
      },
      _count: { _all: true },
    });
    const unreadByConversation = new Map(
      unread.map((u) => [u.conversationId, u._count._all]),
    );
    const byFriend = new Map(
      conversations.map((c) => [
        c.userAId === userId.toLowerCase() ? c.userBId : c.userAId,
        c,
      ]),
    );

    return friends
      .map((friend) => {
        const conversation = byFriend.get(friend.id);
        const last = conversation?.messages[0] ?? null;
        return {
          friend,
          online: this.realtime.isOnline(friend.id),
          unreadCount: conversation
            ? (unreadByConversation.get(conversation.id) ?? 0)
            : 0,
          lastMessage: last
            ? {
                body: last.body,
                createdAt: last.createdAt,
                mine: last.senderId === userId,
              }
            : null,
          sortKey: conversation?.lastMessageAt?.getTime() ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.sortKey - a.sortKey || a.friend.name.localeCompare(b.friend.name),
      )
      .map(({ sortKey: _sortKey, ...rest }) => rest);
  }

  /** Historial paginado (más recientes primero; `cursor` = id del último mensaje recibido). */
  async history(
    userId: string,
    friendId: string,
    limit: number,
    cursor?: string,
  ) {
    await this.assertFriends(userId, friendId);
    const [a, b] = orderedPair(userId, friendId);
    const rows = await this.prisma.message.findMany({
      where: { conversation: { userAId: a, userBId: b } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: messageSelect,
    });
    const page = toPage(rows, limit);
    return {
      items: page.items.map((m) => this.toMessage(m, userId)),
      nextCursor: page.nextCursor,
    };
  }

  /** Valida, guarda y entrega un mensaje al destinatario si está conectado. */
  async send(userId: string, friendId: string, rawBody: string) {
    const body = rawBody.trim();
    if (body.length === 0 || body.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `El mensaje debe tener entre 1 y ${MAX_MESSAGE_LENGTH} caracteres`,
      );
    }
    await this.assertFriends(userId, friendId);

    const [a, b] = orderedPair(userId, friendId);
    // createMany + skipDuplicates evita la carrera cuando ambos escriben primero a la vez.
    await this.prisma.conversation.createMany({
      data: [{ userAId: a, userBId: b }],
      skipDuplicates: true,
    });
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      select: { id: true },
    });

    const message = await this.prisma.message.create({
      data: { conversationId: conversation.id, senderId: userId, body },
      select: messageSelect,
    });
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    this.realtime.emitToUser(
      friendId,
      'chat:message',
      this.toMessage(message, friendId),
    );
    // Las demás pestañas del emisor también ven su propio mensaje.
    const mine = this.toMessage(message, userId);
    this.realtime.emitToUser(userId, 'chat:message', mine);
    return mine;
  }

  /** Marca como leídos los mensajes que me envió `friendId` y le avisa. */
  async markRead(
    userId: string,
    friendId: string,
  ): Promise<{ updated: number }> {
    await this.assertFriends(userId, friendId);
    const [a, b] = orderedPair(userId, friendId);
    const readAt = new Date();
    const { count } = await this.prisma.message.updateMany({
      where: {
        senderId: friendId,
        readAt: null,
        conversation: { userAId: a, userBId: b },
      },
      data: { readAt },
    });
    if (count > 0) {
      this.realtime.emitToUser(friendId, 'chat:read', {
        by: userId,
        readAt,
      });
      this.realtime.emitToUser(userId, 'chat:read-own', { with: friendId });
    }
    return { updated: count };
  }

  async presenceTargets(userId: string): Promise<string[]> {
    return this.friendIds(userId);
  }

  private toMessage(
    m: {
      id: string;
      senderId: string;
      body: string;
      createdAt: Date;
      readAt: Date | null;
      conversation: { userAId: string; userBId: string };
    },
    viewerId: string,
  ): ChatMessage {
    const v = viewerId.toLowerCase();
    return {
      id: m.id,
      conversationWith:
        m.conversation.userAId === v
          ? m.conversation.userBId
          : m.conversation.userAId,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt,
      readAt: m.readAt,
    };
  }
}
