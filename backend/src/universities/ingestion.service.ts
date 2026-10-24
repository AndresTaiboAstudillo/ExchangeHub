import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PythonService } from '../python/python.service.js';
import {
  isPipelineResult,
  type PipelineProvenance,
  type PipelineResult,
  type PipelineUniversity,
} from './pipeline.types.js';

const STALE_RUN_MS = 10 * 60 * 1000;
const MAX_REJECTED_STORED = 100;

export interface IngestionSummary {
  id: string;
  status: 'succeeded' | 'partial' | 'failed';
  triggeredBy: string;
  startedAt: Date;
  finishedAt: Date | null;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  error: string | null;
}

interface Counts {
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly python: PythonService,
  ) {}

  /**
   * Ejecuta el pipeline y persiste el resultado.
   * Si la fuente o el servicio Python fallan, NO se tocan los datos existentes
   * (se conserva el último dato válido) y la ejecución queda registrada como `failed`.
   */
  async runUniversities(triggeredBy: string): Promise<IngestionSummary> {
    await this.closeStaleRuns();
    const active = await this.prisma.ingestionRun.findFirst({
      where: { status: 'running' },
    });
    if (active) {
      throw new ConflictException('Ya hay una ingesta en curso');
    }
    const run = await this.prisma.ingestionRun.create({
      data: { status: 'running', triggeredBy },
    });

    let result: PipelineResult;
    try {
      const raw: unknown = await this.python.runUniversitiesPipeline([
        'mineduc_ies',
        'wikidata',
      ]);
      if (!isPipelineResult(raw)) {
        throw new Error(
          'La respuesta del pipeline no cumple el contrato esperado',
        );
      }
      result = raw;
    } catch (error) {
      return this.finish(run.id, 'failed', null, null, errorMessage(error));
    }

    if (result.status === 'failed') {
      const reason =
        result.sources.map((s) => s.error).find(Boolean) ?? 'El pipeline falló';
      return this.finish(run.id, 'failed', null, result, reason);
    }

    try {
      const counts = await this.prisma.$transaction(
        (tx) => this.apply(tx, result, run.id),
        {
          timeout: 60_000,
          maxWait: 10_000,
        },
      );
      return this.finish(run.id, result.status, counts, result, null);
    } catch (error) {
      this.logger.error(
        `Fallo al persistir la ingesta ${run.id}: ${String(error)}`,
      );
      return this.finish(run.id, 'failed', null, result, errorMessage(error));
    }
  }

  async listRuns(limit = 10) {
    return this.prisma.ingestionRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        triggeredBy: true,
        startedAt: true,
        finishedAt: true,
        created: true,
        updated: true,
        unchanged: true,
        deactivated: true,
        quality: true,
        error: true,
      },
    });
  }

  // ───────────────────────── persistencia ─────────────────────────

  private async apply(
    tx: Prisma.TransactionClient,
    result: PipelineResult,
    runId: string,
  ): Promise<Counts> {
    const catalogOk = result.sources.some(
      (s) => s.code === 'mineduc_ies' && s.status === 'ok',
    );
    const wikiStatus = result.sources.find((s) => s.code === 'wikidata');
    const wikiOk = wikiStatus?.status === 'ok';
    const now = new Date();
    const counts: Counts = {
      created: 0,
      updated: 0,
      unchanged: 0,
      deactivated: 0,
    };
    if (!catalogOk) {
      return counts;
    }

    const numbers = result.universities.map((u) => u.registry_number);
    const existing = await tx.university.findMany({
      where: { registryNumber: { in: numbers } },
      include: {
        sourceRecords: {
          select: { sourceCode: true, externalId: true, contentHash: true },
        },
      },
    });
    const byNumber = new Map(existing.map((u) => [u.registryNumber, u]));

    const unchangedIds: string[] = [];
    const unchangedCatalogIds: string[] = [];
    const unchangedWikiIds: string[] = [];
    const unchangedMatchedUniIds: string[] = [];
    const matchedQids: string[] = [];

    for (const rec of result.universities) {
      const catalogProv = findProv(rec, 'mineduc_ies');
      const wikiProv = findProv(rec, 'wikidata');
      if (!catalogProv) continue;
      if (wikiProv) matchedQids.push(wikiProv.external_id);

      const current = byNumber.get(rec.registry_number);
      const catalogData = {
        name: rec.name,
        nameKey: rec.name_key,
        institutionType: rec.institution_type,
        category: rec.category,
        ownership: rec.ownership,
        operatingStatus: rec.operating_status,
        isVigente: rec.is_vigente,
        catalogFetchedAt: new Date(catalogProv.fetched_at),
      };
      const wikiData = wikiOk
        ? {
            wikidataId: rec.wikidata_id,
            website: rec.website,
            latitude: rec.latitude,
            longitude: rec.longitude,
            foundedYear: rec.founded_year,
            matchMethod: rec.match?.method ?? null,
            matchScore: rec.match?.score ?? null,
            enrichedAt: wikiProv ? new Date(wikiProv.fetched_at) : null,
          }
        : {};

      const prevCatalogHash = current?.sourceRecords.find(
        (s) =>
          s.sourceCode === 'mineduc_ies' &&
          s.externalId === rec.registry_number,
      )?.contentHash;
      const prevWiki = current?.sourceRecords.find(
        (s) => s.sourceCode === 'wikidata',
      );
      const catalogChanged = prevCatalogHash !== catalogProv.content_hash;
      const wikiChanged =
        wikiOk &&
        (prevWiki?.contentHash ?? null) !== (wikiProv?.content_hash ?? null);

      let universityId: string;
      if (!current) {
        const created = await tx.university.create({
          data: {
            registryNumber: rec.registry_number,
            ...catalogData,
            ...wikiData,
            updatedAt: now,
          },
        });
        universityId = created.id;
        counts.created += 1;
      } else if (catalogChanged || wikiChanged) {
        await tx.university.update({
          where: { id: current.id },
          data: { ...catalogData, ...wikiData, updatedAt: now },
        });
        universityId = current.id;
        counts.updated += 1;
      } else {
        universityId = current.id;
        unchangedIds.push(current.id);
        unchangedCatalogIds.push(rec.registry_number);
        if (prevWiki) {
          unchangedWikiIds.push(prevWiki.externalId);
          unchangedMatchedUniIds.push(current.id);
        }
        counts.unchanged += 1;
        continue;
      }

      await this.saveSourceRecord(
        tx,
        runId,
        universityId,
        catalogProv,
        catalogPayload(rec),
        now,
      );
      if (wikiProv) {
        await this.saveSourceRecord(
          tx,
          runId,
          universityId,
          wikiProv,
          wikiPayload(rec),
          now,
        );
      }
    }

    // Sin cambios: solo se anota que se volvió a verificar (frescura), sin tocar updated_at.
    if (unchangedIds.length > 0) {
      await tx.university.updateMany({
        where: { id: { in: unchangedIds } },
        data: {
          catalogFetchedAt: new Date(
            result.sources.find((s) => s.code === 'mineduc_ies')?.fetched_at ??
              now,
          ),
        },
      });
      if (
        wikiOk &&
        wikiStatus?.fetched_at &&
        unchangedMatchedUniIds.length > 0
      ) {
        await tx.university.updateMany({
          where: { id: { in: unchangedMatchedUniIds } },
          data: { enrichedAt: new Date(wikiStatus.fetched_at) },
        });
      }
      await tx.sourceRecord.updateMany({
        where: {
          sourceCode: 'mineduc_ies',
          externalId: { in: unchangedCatalogIds },
        },
        data: { fetchedAt: now, lastRunId: runId },
      });
      if (unchangedWikiIds.length > 0) {
        await tx.sourceRecord.updateMany({
          where: {
            sourceCode: 'wikidata',
            externalId: { in: unchangedWikiIds },
          },
          data: { fetchedAt: now, lastRunId: runId },
        });
      }
    }

    if (wikiOk) {
      // Registros de Wikidata que ya no se cruzan con ninguna universidad quedan desvinculados.
      await tx.sourceRecord.updateMany({
        where: {
          sourceCode: 'wikidata',
          externalId: { notIn: matchedQids },
          universityId: { not: null },
        },
        data: { universityId: null },
      });
    }

    // Instituciones que ya no aparecen en el catálogo oficial: se desactivan, no se borran.
    const deactivated = await tx.university.updateMany({
      where: { registryNumber: { not: null, notIn: numbers }, isVigente: true },
      data: { isVigente: false, updatedAt: now },
    });
    counts.deactivated = deactivated.count;
    return counts;
  }

  private saveSourceRecord(
    tx: Prisma.TransactionClient,
    runId: string,
    universityId: string,
    prov: PipelineProvenance,
    payload: Prisma.InputJsonObject,
    now: Date,
  ) {
    const fields = {
      contentHash: prov.content_hash,
      url: prov.url,
      payload,
      universityId,
      fetchedAt: new Date(prov.fetched_at),
      changedAt: now,
      lastRunId: runId,
    };
    return tx.sourceRecord.upsert({
      where: {
        sourceCode_externalId: {
          sourceCode: prov.source,
          externalId: prov.external_id,
        },
      },
      create: {
        sourceCode: prov.source,
        externalId: prov.external_id,
        ...fields,
      },
      update: fields,
    });
  }

  private async finish(
    runId: string,
    status: 'succeeded' | 'partial' | 'failed',
    counts: Counts | null,
    result: PipelineResult | null,
    error: string | null,
  ): Promise<IngestionSummary> {
    const row = await this.prisma.ingestionRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: new Date(),
        ...counts,
        sources: (result?.sources ?? undefined) as
          Prisma.InputJsonValue | undefined,
        quality: (result?.quality ?? undefined) as
          Prisma.InputJsonValue | undefined,
        rejected: result
          ? ((result.rejected as unknown[]).slice(
              0,
              MAX_REJECTED_STORED,
            ) as Prisma.InputJsonValue)
          : undefined,
        error,
      },
    });
    if (status === 'failed') {
      this.logger.warn(
        `Ingesta ${runId} falló: ${error ?? 'sin detalle'}. Se conservan los datos anteriores.`,
      );
    }
    return {
      id: row.id,
      status,
      triggeredBy: row.triggeredBy,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      created: row.created,
      updated: row.updated,
      unchanged: row.unchanged,
      deactivated: row.deactivated,
      error: row.error,
    };
  }

  /** Una ejecución "running" muy antigua es de un proceso que murió: se cierra como fallida. */
  private async closeStaleRuns() {
    await this.prisma.ingestionRun.updateMany({
      where: {
        status: 'running',
        startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) },
      },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        error: 'Interrumpida (sin finalizar)',
      },
    });
  }
}

function findProv(
  rec: PipelineUniversity,
  source: PipelineProvenance['source'],
) {
  return rec.provenance.find((p) => p.source === source);
}

function catalogPayload(rec: PipelineUniversity): Prisma.InputJsonObject {
  return {
    registryNumber: rec.registry_number,
    name: rec.name,
    institutionType: rec.institution_type,
    category: rec.category,
    ownership: rec.ownership,
    operatingStatus: rec.operating_status,
    isVigente: rec.is_vigente,
  };
}

function wikiPayload(rec: PipelineUniversity): Prisma.InputJsonObject {
  return {
    qid: rec.wikidata_id,
    website: rec.website,
    latitude: rec.latitude,
    longitude: rec.longitude,
    foundedYear: rec.founded_year,
    match: rec.match
      ? { method: rec.match.method, score: rec.match.score }
      : null,
  };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}
