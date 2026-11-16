import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PlacesQueryDto } from './dto/places-query.dto.js';
import type { CreateListingDto, UpdateListingDto } from './dto/listing.dto.js';
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

const LISTING_SELECT = {
  id: true,
  type: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  description: true,
  priceClp: true,
  availability: true,
} as const;

@Injectable()
export class MapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}

  async listListings() {
    const rows = await this.prisma.listing.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: LISTING_SELECT,
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

  /** Un administrador publica un arriendo; queda registrado quién lo creó. */
  async createListing(adminId: string, dto: CreateListingDto) {
    const row = await this.prisma.listing.create({
      data: { ...dto, type: 'alojamiento', authorId: adminId },
      select: LISTING_SELECT,
    });
    return { ...row, ratingAverage: null, ratingCount: 0 };
  }

  async updateListing(id: string, dto: UpdateListingDto) {
    await this.assertListing(id);
    const row = await this.prisma.listing.update({
      where: { id },
      data: dto,
      select: LISTING_SELECT,
    });
    const ratings = await this.reviews.ratingsFor('listing', [id]);
    return {
      ...row,
      ratingAverage: ratings.get(id)?.average ?? null,
      ratingCount: ratings.get(id)?.count ?? 0,
    };
  }

  /** Borra el arriendo y sus reseñas (la referencia es polimórfica: no hay cascada en la base). */
  async deleteListing(id: string) {
    await this.assertListing(id);
    await this.prisma.$transaction([
      this.prisma.review.deleteMany({
        where: { targetType: 'listing', targetId: id },
      }),
      this.prisma.listing.delete({ where: { id } }),
    ]);
  }

  private async assertListing(id: string) {
    const found = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Alojamiento no encontrado');
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
