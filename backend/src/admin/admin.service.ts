import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Qué se perdería al eliminar a esta persona (se muestra antes de confirmar). */
  async lookup(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user)
      throw new NotFoundException('No hay ningún usuario con ese correo');
    const [posts, replies, reviews, listings, messages] = await Promise.all([
      this.prisma.post.count({ where: { authorId: user.id } }),
      this.prisma.postReply.count({ where: { authorId: user.id } }),
      this.prisma.review.count({ where: { authorId: user.id } }),
      this.prisma.listing.count({ where: { authorId: user.id } }),
      this.prisma.message.count({ where: { senderId: user.id } }),
    ]);
    return {
      ...user,
      content: { posts, replies, reviews, listings, messages },
    };
  }

  /**
   * Elimina la cuenta y todo lo que dejó: publicaciones, comentarios, reseñas, mensajes, amistades y
   * notificaciones (la base lo hace en cascada). Las reseñas de sus arriendos se borran a mano, porque la
   * referencia de las reseñas es polimórfica y no tiene clave foránea.
   */
  async deleteByEmail(adminId: string, email: string) {
    const target = await this.lookup(email);
    if (target.id === adminId) {
      throw new ConflictException('No puedes eliminar tu propia cuenta');
    }
    if (target.role === 'admin') {
      throw new ConflictException(
        'No se puede eliminar a un administrador: quítale primero el rol',
      );
    }

    await this.prisma.$transaction([
      this.prisma.review.deleteMany({
        where: {
          targetType: 'listing',
          targetId: {
            in: (
              await this.prisma.listing.findMany({
                where: { authorId: target.id },
                select: { id: true },
              })
            ).map((l) => l.id),
          },
        },
      }),
      this.prisma.user.delete({ where: { id: target.id } }),
    ]);

    // Si tenía la app abierta, se le corta la conexión en tiempo real.
    this.realtime.disconnectUser(target.id);
    // En el registro solo va el id: el correo es un dato personal.
    this.logger.warn(
      JSON.stringify({ event: 'user_deleted', adminId, userId: target.id }),
    );
    return {
      deleted: { id: target.id, name: target.name },
      content: target.content,
    };
  }
}
