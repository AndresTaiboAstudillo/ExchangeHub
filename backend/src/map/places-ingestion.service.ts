import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PythonService } from '../python/python.service.js';
import type { PythonPlace } from './places.types.js';

const CHUNK = 500;
/** Si una consulta trae menos de la mitad de lo que ya hay, se sospecha de datos parciales y no se borra nada. */
const PRUNE_MIN_RATIO = 0.5;

export interface PlacesRefreshSummary {
  received: number;
  valid: number;
  rejected: number;
  inserted: number;
  updated: number;
  removed: number;
  pruneSkipped: boolean;
  elapsedMs: number;
}

@Injectable()
export class PlacesIngestionService {
  private readonly logger = new Logger(PlacesIngestionService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly python: PythonService,
  ) {}

  /** Trae los comercios de OpenStreetMap vía Python y los guarda (alta, actualización y baja). */
  async refresh(): Promise<PlacesRefreshSummary> {
    if (this.running) {
      throw new BadGatewayException(
        'Ya hay una actualización de lugares en curso',
      );
    }
    this.running = true;
    try {
      const result = await this.python.runPlacesPipeline();
      if (result.status !== 'ok') {
        throw new BadGatewayException(
          `OpenStreetMap no está disponible: ${result.error ?? 'error desconocido'}`,
        );
      }
      const fetchedAt = new Date(result.fetched_at ?? Date.now());
      const before = await this.prisma.place.count({
        where: { source: 'osm' },
      });
      let inserted = 0;
      for (let i = 0; i < result.places.length; i += CHUNK) {
        inserted += await this.upsertChunk(
          result.places.slice(i, i + CHUNK),
          fetchedAt,
        );
      }

      // Lo que dejó de existir en OSM se elimina, salvo que la respuesta parezca incompleta.
      // Un comercio con reseñas se conserva: borrarlo dejaría huérfano el aporte de los estudiantes.
      const keep = result.places.map((p) => p.external_id);
      const pruneSkipped = before > 0 && keep.length < before * PRUNE_MIN_RATIO;
      let removed = 0;
      if (!pruneSkipped) {
        removed = await this.prisma.$executeRaw`
          DELETE FROM places
          WHERE source = 'osm' AND external_id <> ALL(${keep}::text[])
            AND NOT EXISTS (
              SELECT 1 FROM reviews r WHERE r.target_type = 'place' AND r.target_id = places.id)`;
      }
      const summary: PlacesRefreshSummary = {
        received: result.records_received,
        valid: result.records_valid,
        rejected: result.records_rejected,
        inserted,
        updated: result.places.length - inserted,
        removed,
        pruneSkipped,
        elapsedMs: result.elapsed_ms,
      };
      this.logger.log({ message: 'places_refreshed', ...summary });
      return summary;
    } finally {
      this.running = false;
    }
  }

  /** Inserta o actualiza en bloque. Devuelve cuántas filas eran nuevas. */
  private async upsertChunk(
    places: PythonPlace[],
    fetchedAt: Date,
  ): Promise<number> {
    if (places.length === 0) return 0;
    const col = <K extends keyof PythonPlace>(key: K) =>
      places.map((p) => p[key]);
    const rows = await this.prisma.$queryRaw<{ inserted: boolean }[]>`
      INSERT INTO places (source, external_id, category, name, address, latitude, longitude,
                          opening_hours, website, content_hash, fetched_at)
      SELECT 'osm', t.external_id, t.category, t.name, t.address, t.latitude, t.longitude,
             t.opening_hours, t.website, t.content_hash, ${fetchedAt}
      FROM unnest(
        ${col('external_id')}::text[], ${col('category')}::text[], ${col('name')}::text[],
        ${col('address')}::text[], ${col('latitude')}::float8[], ${col('longitude')}::float8[],
        ${col('opening_hours')}::text[], ${col('website')}::text[], ${col('content_hash')}::text[]
      ) AS t(external_id, category, name, address, latitude, longitude,
             opening_hours, website, content_hash)
      ON CONFLICT (source, external_id) DO UPDATE SET
        category = EXCLUDED.category, name = EXCLUDED.name, address = EXCLUDED.address,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        opening_hours = EXCLUDED.opening_hours, website = EXCLUDED.website,
        content_hash = EXCLUDED.content_hash, fetched_at = EXCLUDED.fetched_at
      RETURNING (xmax = 0) AS inserted`;
    return rows.filter((r) => r.inserted).length;
  }
}
