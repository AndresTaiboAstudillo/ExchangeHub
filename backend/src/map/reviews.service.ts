import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListReviewsDto, UpsertReviewDto } from './dto/review.dto.js';

export type ReviewTarget = 'place' | 'listing';

const reviewSelect = {
  id: true,
  rating: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: { id: true, name: true, countryOfOrigin: true, isVisible: true },
  },
} as const;

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    countryOfOrigin: string | null;
    isVisible: boolean;
  };
};

export interface ReviewSummary {
  count: number;
  average: number | null;
  /** Reseñas por cantidad de estrellas: índice 0 = 1 estrella … índice 4 = 5 estrellas. */
  distribution: number[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Promedio y cantidad de varios comercios a la vez (para las tarjetas del mapa). */
  async ratingsFor(target: ReviewTarget, placeIds: string[]) {
    const out = new Map<string, { average: number; count: number }>();
    if (placeIds.length === 0) return out;
    const rows = await this.prisma.review.groupBy({
      by: ['targetId'],
      where: { targetType: target, targetId: { in: placeIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    for (const r of rows) {
      out.set(r.targetId, {
        average: round1(r._avg.rating ?? 0),
        count: r._count._all,
      });
    }
    return out;
  }

  async summary(target: ReviewTarget, placeId: string): Promise<ReviewSummary> {
    const groups = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { targetType: target, targetId: placeId },
      _count: { _all: true },
    });
    const distribution = [0, 0, 0, 0, 0];
    let count = 0;
    let total = 0;
    for (const g of groups) {
      distribution[g.rating - 1] = g._count._all;
      count += g._count._all;
      total += g.rating * g._count._all;
    }
    return {
      count,
      average: count ? round1(total / count) : null,
      distribution,
    };
  }

  async list(
    target: ReviewTarget,
    placeId: string,
    viewerId: string,
    query: ListReviewsDto,
  ) {
    await this.assertTarget(target, placeId);
    const limit = query.limit;
    const [summary, mine, rows] = await Promise.all([
      this.summary(target, placeId),
      this.prisma.review.findUnique({
        where: {
          authorId_targetType_targetId: {
            authorId: viewerId,
            targetType: target,
            targetId: placeId,
          },
        },
        select: reviewSelect,
      }),
      this.prisma.review.findMany({
        where: { targetType: target, targetId: placeId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        select: reviewSelect,
      }),
    ]);
    const page = rows.slice(0, limit);
    return {
      summary,
      mine: mine ? this.present(mine, viewerId) : null,
      items: page.map((r) => this.present(r, viewerId)),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  /** Crea la reseña o, si la persona ya había opinado de este lugar, la reemplaza. */
  async upsert(
    target: ReviewTarget,
    placeId: string,
    userId: string,
    dto: UpsertReviewDto,
  ) {
    await this.assertTarget(target, placeId);
    const data = { rating: dto.rating, body: dto.body ?? null };
    const row = await this.prisma.review.upsert({
      where: {
        authorId_targetType_targetId: {
          authorId: userId,
          targetType: target,
          targetId: placeId,
        },
      },
      create: {
        authorId: userId,
        targetType: target,
        targetId: placeId,
        ...data,
      },
      update: data,
      select: reviewSelect,
    });
    return {
      review: this.present(row, userId),
      summary: await this.summary(target, placeId),
    };
  }

  /** La autora puede borrar la suya; un administrador, cualquiera (moderación). */
  async remove(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, authorId: true, targetType: true, targetId: true },
    });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    if (review.authorId !== userId) {
      const me = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      // Se responde 404 (no 403) para no revelar reseñas ajenas a quien no puede moderarlas.
      if (me?.role !== 'admin')
        throw new NotFoundException('Reseña no encontrada');
    }
    await this.prisma.review.delete({ where: { id: reviewId } });
  }

  /** Quien tiene el perfil oculto aparece sin nombre ni enlace, salvo para sí mismo. */
  private present(row: ReviewRow, viewerId: string) {
    const shown = row.author.isVisible || row.author.id === viewerId;
    return {
      id: row.id,
      rating: row.rating,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      edited: row.updatedAt.getTime() - row.createdAt.getTime() > 1000,
      own: row.author.id === viewerId,
      author: shown
        ? {
            id: row.author.id,
            name: row.author.name,
            countryOfOrigin: row.author.countryOfOrigin,
          }
        : { id: null, name: 'Estudiante', countryOfOrigin: null },
    };
  }

  private async assertTarget(target: ReviewTarget, id: string) {
    const found =
      target === 'place'
        ? await this.prisma.place.findUnique({
            where: { id },
            select: { id: true },
          })
        : await this.prisma.listing.findUnique({
            where: { id },
            select: { id: true },
          });
    if (!found) {
      throw new NotFoundException(
        target === 'place'
          ? 'Comercio no encontrado'
          : 'Alojamiento no encontrado',
      );
    }
  }
}
