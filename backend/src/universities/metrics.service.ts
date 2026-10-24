import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UniversitiesService } from './universities.service.js';

const RUNS_WINDOW = 20;

interface StoredSource {
  code?: string;
  status?: string;
  elapsed_ms?: number;
}

type Quality = Record<string, unknown>;

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Métricas de calidad de los datos y de la recuperación (requisito 7), calculadas en vivo. */
@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly universities: UniversitiesService,
  ) {}

  async metrics() {
    const runs = await this.prisma.ingestionRun.findMany({
      where: { status: { not: 'running' } },
      orderBy: { startedAt: 'desc' },
      take: RUNS_WINDOW,
      select: {
        status: true,
        sources: true,
        quality: true,
        finishedAt: true,
        startedAt: true,
      },
    });

    const failed = runs.filter((r) => r.status === 'failed').length;
    const lastGood = runs.find((r) => r.status !== 'failed');
    const quality = (lastGood?.quality ?? null) as Quality | null;

    const elapsed = new Map<string, number[]>();
    for (const run of runs) {
      for (const source of (run.sources as StoredSource[] | null) ?? []) {
        if (
          source.status === 'ok' &&
          source.code &&
          typeof source.elapsed_ms === 'number'
        ) {
          elapsed.set(source.code, [
            ...(elapsed.get(source.code) ?? []),
            source.elapsed_ms,
          ]);
        }
      }
    }

    const [database, freshness] = await Promise.all([
      this.databaseStats(),
      this.universities.sourcesStatus(),
    ]);

    const rows = num(quality?.catalog_rows);
    const duplicates = num(quality?.duplicates_discarded);
    return {
      window: { runs: runs.length, size: RUNS_WINDOW },
      ingestion: {
        succeeded: runs.filter((r) => r.status === 'succeeded').length,
        partial: runs.filter((r) => r.status === 'partial').length,
        failed,
        errorRate: runs.length > 0 ? round(failed / runs.length) : null,
      },
      retrievalMs: Object.fromEntries(
        [...elapsed].map(([code, values]) => [
          code,
          {
            samples: values.length,
            avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            max: Math.max(...values),
          },
        ]),
      ),
      lastGoodRun: quality
        ? {
            at: lastGood?.finishedAt ?? null,
            catalogRows: rows,
            pctValid: num(quality.pct_valid),
            rejected: num(quality.catalog_rejected),
            duplicatesDiscarded: duplicates,
            pctDuplicates: rows ? round((duplicates ?? 0) / rows) : null,
            matchRate: num(quality.match_rate),
            coverageWebsite: num(quality.coverage_website),
            coverageCoordinates: num(quality.coverage_coordinates),
          }
        : null,
      database,
      freshness: freshness.sources.map((s) => ({
        source: s.code,
        lastFetchedAt: s.lastFetchedAt,
        ageDays: s.ageDays,
        stale: s.stale,
      })),
    };
  }

  private async databaseStats() {
    const [
      total,
      active,
      byCategory,
      withWebsite,
      withCoordinates,
      dup,
      universidades,
    ] = await Promise.all([
      this.prisma.university.count({
        where: { registryNumber: { not: null } },
      }),
      this.prisma.university.count({
        where: { registryNumber: { not: null }, isVigente: true },
      }),
      this.prisma.university.groupBy({
        by: ['category'],
        where: { registryNumber: { not: null }, isVigente: true },
        _count: { _all: true },
      }),
      this.prisma.university.count({
        where: {
          category: 'universidad',
          isVigente: true,
          website: { not: null },
        },
      }),
      this.prisma.university.count({
        where: {
          category: 'universidad',
          isVigente: true,
          latitude: { not: null },
        },
      }),
      this.prisma.$queryRaw<{ dup: bigint }[]>`
          SELECT COUNT(*) - COUNT(DISTINCT name_key) AS dup
          FROM universities WHERE name_key IS NOT NULL`,
      this.prisma.university.count({
        where: { category: 'universidad', isVigente: true },
      }),
    ]);
    return {
      total,
      active,
      byCategory: Object.fromEntries(
        byCategory.map((c) => [c.category ?? 'sin_categoria', c._count._all]),
      ),
      // Siempre 0: lo garantiza la restricción UNIQUE sobre name_key. Se mide igualmente.
      duplicatesInDatabase: Number(dup[0]?.dup ?? 0),
      universities: {
        total: universidades,
        withWebsite,
        withCoordinates,
        coverageWebsite: universidades
          ? round(withWebsite / universidades)
          : null,
        coverageCoordinates: universidades
          ? round(withCoordinates / universidades)
          : null,
      },
    };
  }
}
