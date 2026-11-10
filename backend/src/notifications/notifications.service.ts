import { Injectable, Logger } from '@nestjs/common';
import { toPage } from '../common/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

export const NOTIFICATION_TYPES = [
  'friend_request',
  'friend_accepted',
  'post_like',
  'post_reply',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const select = {
  id: true,
  type: true,
  postId: true,
  preview: true,
  readAt: true,
  createdAt: true,
  actor: { select: { id: true, name: true } },
} as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Crea un aviso y lo empuja en vivo. Es de mejor esfuerzo: si falla, la acción que lo originó
   * (dar like, aceptar una amistad…) no debe fallar.
   */
  async notify(
    userId: string,
    actorId: string,
    type: NotificationType,
    extra: { postId?: string; preview?: string } = {},
  ): Promise<void> {
    if (userId === actorId) return;
    try {
      const created = await this.prisma.notification.create({
        data: {
          userId,
          actorId,
          type,
          postId: extra.postId,
          preview: extra.preview?.slice(0, 140),
        },
        select,
      });
      this.realtime.emitToUser(userId, 'notification:new', created);
    } catch (error) {
      this.logger.warn(
        `No se pudo crear la notificación ${type}: ${(error as Error).message}`,
      );
    }
  }

  async list(userId: string, limit: number, cursor?: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select,
    });
    const unread = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { ...toPage(rows, limit), unreadCount: unread };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  async markRead(userId: string, id: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }
}
