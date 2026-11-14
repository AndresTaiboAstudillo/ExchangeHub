import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PlacesQueryDto } from './dto/places-query.dto.js';
import { ReviewsService } from './reviews.service.js';

const placeSelect = {
  id: true,
  category: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  openingHours: true,
  website: true,
} as const;

/** `oeste,sur,este,norte` → límites validados. */
export function parseBbox(bbox: string) {
  const [west, south, east, north] = bbox.split(',').map(Number);
  if (
    !(south >= -90 && north <= 90 && south < north) ||
    !(west >= -180 && east <= 180 && west < east)
  ) {
    throw new BadRequestException('bbox fuera de rango o invertido');
  }
  return { west, south, east, north };
}

@Injectable()
export class MapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  async listListings() {
    const rows = await this.prisma.listing.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        description: true,
        priceClp: true,
        availability: true,
      },
    });
    const ratings = await this.reviews.ratingsFor(
      'listing',
      rows.map((l) => l.id),
    );
    return rows.map((l) => ({
      ...l,
      ratingAverage: ratings.get(l.id)?.average ?? null,
      ratingCount: ratings.get(l.id)?.count ?? 0,
    }));
  }

  /** Instituciones vigentes con ubicación conocida (las del catálogo que Wikidata pudo ubicar). */
  listUniversities() {
    return this.prisma.university.findMany({
      where: {
        isVigente: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        ownership: true,
        address: true,
        website: true,
        latitude: true,
        longitude: true,
      },
    });
  }

  listZones() {
    return this.prisma.zone.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        safetyLevel: true,
        description: true,
        safeHours: true,
        latCenter: true,
        lngCenter: true,
        radiusM: true,
      },
    });
  }

  async listPlaces(query: PlacesQueryDto) {
    const where: Prisma.PlaceWhereInput = {};
    if (query.category?.length) where.category = { in: query.category };
    if (query.bbox) {
      const b = parseBbox(query.bbox);
      where.latitude = { gte: b.south, lte: b.north };
      where.longitude = { gte: b.west, lte: b.east };
    }
    const [items, total] = await Promise.all([
      this.prisma.place.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: query.limit,
        select: placeSelect,
      }),
      this.prisma.place.count({ where }),
    ]);
    const ratings = await this.reviews.ratingsFor(
      'place',
      items.map((p) => p.id),
    );
    return {
      items: items.map((p) => ({
        ...p,
        ratingAverage: ratings.get(p.id)?.average ?? null,
        ratingCount: ratings.get(p.id)?.count ?? 0,
      })),
      total,
      truncated: total > items.length,
    };
  }
}
