import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListUniversitiesDto } from './dto/list-universities.dto.js';
import { Bm25Index } from './search/bm25.js';
import { nameKey, tokenize } from './search/normalize.js';
import { FIELD_WEIGHTS, toSearchDoc } from './search/university-document.js';

/** El primer resultado debe superar al segundo por este factor para darse por seguro. */
const CLEAR_WINNER_RATIO = 1.5;

const LIST_SELECT = {
  id: true,
  name: true,
  registryNumber: true,
  category: true,
  ownership: true,
  operatingStatus: true,
  isVigente: true,
  website: true,
  latitude: true,
  longitude: true,
  foundedYear: true,
  wikidataId: true,
  matchMethod: true,
  catalogFetchedAt: true,
  enrichedAt: true,
  updatedAt: true,
  sourceRecords: {
    select: { sourceCode: true, externalId: true, url: true, fetchedAt: true },
  },
} satisfies Prisma.UniversitySelect;

type Row = Prisma.UniversityGetPayload<{ select: typeof LIST_SELECT }>;

interface IndexEntry {
  index: Bm25Index;
  version: string;
  meta: Map<
    string,
    {
      category: string | null;
      ownership: string | null;
      isVigente: boolean;
      /** Términos del nombre y las siglas: sirven para comprobar que un candidato cubre la consulta. */
      terms: Set<string>;
    }
  >;
}

export function toItem(row: Row, score?: number) {
  const { sourceRecords, ...rest } = row;
  return {
    ...rest,
    ...(score === undefined ? {} : { score: Math.round(score * 1000) / 1000 }),
    sources: sourceRecords.map((s) => ({
      source: s.sourceCode,
      externalId: s.externalId,
      url: s.url,
      fetchedAt: s.fetchedAt,
    })),
  };
}

@Injectable()
export class UniversitiesService {
  private cache: IndexEntry | null = null;
  private readonly staleAfterDays = Number(
    process.env.DATA_STALE_AFTER_DAYS ?? 14,
  );

  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListUniversitiesDto) {
    const baseWhere: Prisma.UniversityWhereInput = {
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.ownership ? { ownership: dto.ownership } : {}),
      ...(dto.includeInactive ? {} : { isVigente: true }),
    };

    if (!dto.q) {
      const [total, rows] = await Promise.all([
        this.prisma.university.count({ where: baseWhere }),
        this.prisma.university.findMany({
          where: baseWhere,
          select: LIST_SELECT,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: dto.offset,
          take: dto.limit,
        }),
      ]);
      return this.page(
        rows.map((r) => toItem(r)),
        total,
        dto,
      );
    }

    const { index, meta } = await this.getIndex();
    const hits = index.search(dto.q, index.size).filter((h) => {
      const m = meta.get(h.id);
      return (
        m !== undefined &&
        (dto.includeInactive || m.isVigente) &&
        (!dto.category || m.category === dto.category) &&
        (!dto.ownership || m.ownership === dto.ownership)
      );
    });
    const pageHits = hits.slice(dto.offset, dto.offset + dto.limit);
    const rows = await this.prisma.university.findMany({
      where: { id: { in: pageHits.map((h) => h.id) } },
      select: LIST_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = pageHits.flatMap((h) => {
      const row = byId.get(h.id);
      return row ? [toItem(row, h.score)] : [];
    });
    return this.page(items, hits.length, dto);
  }

  async findOne(id: string) {
    const row = await this.prisma.university.findUnique({
      where: { id },
      select: {
        ...LIST_SELECT,
        institutionType: true,
        matchScore: true,
        createdAt: true,
        sourceRecords: {
          select: {
            sourceCode: true,
            externalId: true,
            url: true,
            fetchedAt: true,
            firstSeenAt: true,
            changedAt: true,
            contentHash: true,
            source: { select: { name: true, license: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Universidad no encontrada');
    const { sourceRecords, ...rest } = row;
    return {
      ...rest,
      sources: sourceRecords.map((s) => ({
        source: s.sourceCode,
        name: s.source.name,
        license: s.source.license,
        externalId: s.externalId,
        url: s.url,
        fetchedAt: s.fetchedAt,
        firstSeenAt: s.firstSeenAt,
        changedAt: s.changedAt,
        contentHash: s.contentHash,
      })),
    };
  }

  /**
   * Vincula un nombre escrito a mano (p. ej. `users.university_origin`) con el catálogo.
   * Solo afirma una coincidencia si es exacta (sin tildes ni mayúsculas) o si hay un único
   * candidato claramente mejor que el resto; ante la duda devuelve candidatos y no adivina.
   */
  async resolve(name: string) {
    const key = nameKey(name);
    const exact = await this.prisma.university.findFirst({
      where: { nameKey: key, isVigente: true },
      select: LIST_SELECT,
    });
    if (exact) {
      return {
        query: name,
        method: 'exact' as const,
        match: toItem(exact),
        candidates: [],
      };
    }

    const { index, meta } = await this.getIndex();
    const hits = index
      .search(name, 20)
      .filter((h) => meta.get(h.id)?.isVigente)
      .slice(0, 3);
    const rows = await this.prisma.university.findMany({
      where: { id: { in: hits.map((h) => h.id) } },
      select: LIST_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const candidates = hits.flatMap((h) => {
      const row = byId.get(h.id);
      return row ? [toItem(row, h.score)] : [];
    });

    const [first, second] = hits;
    const queryTerms = tokenize(name);
    const covers =
      first !== undefined &&
      queryTerms.length > 0 &&
      queryTerms.every((t) => meta.get(first.id)?.terms.has(t));
    // Un término raro no basta: el candidato debe cubrir TODA la consulta y ganarle al segundo.
    const clear =
      covers &&
      (second === undefined ||
        first.score >= second.score * CLEAR_WINNER_RATIO);
    return {
      query: name,
      method: clear ? ('search' as const) : null,
      match: clear ? (candidates[0] ?? null) : null,
      candidates,
    };
  }

  /** Estado de cada fuente: cuándo se recuperó por última vez y si ya está desactualizada. */
  async sourcesStatus() {
    const [sources, lastSuccess, lastRun] = await Promise.all([
      this.prisma.dataSource.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.ingestionRun.findFirst({
        where: { status: { in: ['succeeded', 'partial'] } },
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true, startedAt: true, finishedAt: true },
      }),
      this.prisma.ingestionRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      }),
    ]);
    const stats = await this.prisma.sourceRecord.groupBy({
      by: ['sourceCode'],
      _max: { fetchedAt: true },
      _count: { _all: true },
    });
    const byCode = new Map(stats.map((s) => [s.sourceCode, s]));
    const now = Date.now();
    return {
      staleAfterDays: this.staleAfterDays,
      sources: sources.map((s) => {
        const stat = byCode.get(s.code);
        const last = stat?._max.fetchedAt ?? null;
        const ageDays = last
          ? Math.floor((now - last.getTime()) / 86_400_000)
          : null;
        return {
          code: s.code,
          name: s.name,
          url: s.url,
          license: s.license,
          records: stat?._count._all ?? 0,
          lastFetchedAt: last,
          ageDays,
          stale: ageDays === null || ageDays > this.staleAfterDays,
        };
      }),
      lastSuccessfulRun: lastSuccess,
      lastRun,
    };
  }

  // ───────────────────────── índice de búsqueda ─────────────────────────

  /** El índice vive en memoria y se reconstruye solo cuando cambian los datos. */
  private async getIndex(): Promise<IndexEntry> {
    const stamp = await this.prisma.university.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    const version = `${stamp._count._all}:${stamp._max.updatedAt?.toISOString() ?? ''}`;
    if (this.cache?.version === version) return this.cache;

    const rows = await this.prisma.university.findMany({
      select: {
        id: true,
        registryNumber: true,
        name: true,
        category: true,
        ownership: true,
        operatingStatus: true,
        isVigente: true,
        website: true,
      },
    });
    const index = new Bm25Index(
      rows.map((r) => toSearchDoc(r)),
      { weights: FIELD_WEIGHTS },
    );
    this.cache = {
      index,
      version,
      meta: new Map(
        rows.map((r) => [
          r.id,
          {
            category: r.category,
            ownership: r.ownership,
            isVigente: r.isVigente,
            terms: nameTerms(r),
          },
        ]),
      ),
    };
    return this.cache;
  }

  private page<T>(items: T[], total: number, dto: ListUniversitiesDto) {
    return {
      items,
      total,
      limit: dto.limit,
      offset: dto.offset,
      query: dto.q ?? null,
    };
  }
}

function nameTerms(row: Parameters<typeof toSearchDoc>[0]): Set<string> {
  const { name, alias } = toSearchDoc(row).fields;
  return new Set(tokenize(`${name} ${alias}`));
}
