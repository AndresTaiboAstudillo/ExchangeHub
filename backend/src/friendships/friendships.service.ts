import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isForeignKeyViolation, isUniqueViolation } from '../common/pagination.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListFriendshipsDto } from './dto/list-friendships.dto.js';

const person = { select: { id: true, name: true } } as const;

@Injectable()
export class FriendshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new BadRequestException('No puedes enviarte una solicitud a ti mismo');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
      select: { status: true, requesterId: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.status === 'accepted'
          ? 'Ya son amigos'
          : existing.requesterId === addresseeId && existing.status === 'pending'
            ? 'Esa persona ya te envió una solicitud: acéptala'
            : 'No se puede enviar la solicitud',
      );
    }

    try {
      const friendship = await this.prisma.friendship.create({
        data: { requesterId, addresseeId },
        select: { id: true, status: true, createdAt: true, addressee: person },
      });
      return {
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        direction: 'sent' as const,
        user: friendship.addressee,
      };
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new NotFoundException('El usuario no existe');
      if (isUniqueViolation(error)) {
        throw new ConflictException('No se puede enviar la solicitud');
      }
      throw error;
    }
  }

  async list(userId: string, query: ListFriendshipsDto) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        // Quien envió una solicitud rechazada no la ve en su lista.
        OR: [
          { requesterId: userId, status: { not: 'rejected' } },
          { addresseeId: userId },
        ],
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        requesterId: true,
        requester: person,
        addressee: person,
      },
    });

    return rows.map((row) => {
      const sent = row.requesterId === userId;
      return {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        direction: sent ? ('sent' as const) : ('received' as const),
        user: sent ? row.addressee : row.requester,
      };
    });
  }

  async respond(userId: string, id: string, status: 'accepted' | 'rejected') {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id },
      select: { addresseeId: true, status: true },
    });
    // Para quien no es el destinatario, la solicitud "no existe".
    if (!friendship || friendship.addresseeId !== userId) {
      throw new NotFoundException('La solicitud no existe');
    }
    if (friendship.status !== 'pending') {
      throw new ConflictException('La solicitud ya fue respondida');
    }

    // El filtro por estado evita pisar una respuesta simultánea.
    const { count } = await this.prisma.friendship.updateMany({
      where: { id, status: 'pending' },
      data: { status },
    });
    if (count === 0) throw new ConflictException('La solicitud ya fue respondida');
    return { id, status };
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.friendship.deleteMany({
      where: { id, OR: [{ requesterId: userId }, { addresseeId: userId }] },
    });
    if (count === 0) throw new NotFoundException('La amistad no existe');
  }
}
