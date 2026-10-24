/**
 * Pruebas de ingesta y búsqueda de universidades contra PostgreSQL real.
 * Usa una base de pruebas con las migraciones aplicadas: borra las filas del catálogo
 * (números de registro del fixture) antes y después, así que NO la apuntes a datos reales.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PythonService } from '../src/python/python.service.js';
import type { PipelineResult } from '../src/universities/pipeline.types.js';

process.env.JWT_SECRET = 'secreto-de-pruebas-con-al-menos-32-caracteres';

const DOMAIN = '@itest.local';
const PASSWORD = 'clave-segura-123';
const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/pipeline-result.json', import.meta.url),
    'utf8',
  ),
) as PipelineResult;
const fresh = (): PipelineResult => structuredClone(fixture);
const NUMBERS = fixture.universities.map((u) => u.registry_number);
const QIDS = fixture.universities.flatMap((u) =>
  u.wikidata_id ? [u.wikidata_id] : [],
);

describe('Universidades: ingesta y búsqueda (PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: { Authorization: string };
  let adminId: string;
  let member: { Authorization: string };
  const python = {
    health: vi.fn(),
    info: vi.fn(),
    runUniversitiesPipeline: vi.fn(),
  };
  const api = () => request(app.getHttpServer());

  async function newUser(name: string, role?: string) {
    const email = `${randomUUID()}${DOMAIN}`;
    const reg = await api()
      .post('/auth/register')
      .send({ name, email, password: PASSWORD })
      .expect(201);
    if (role)
      await prisma.user.update({ where: { id: reg.body.id }, data: { role } });
    const login = await api()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      id: reg.body.id as string,
      auth: { Authorization: `Bearer ${login.body.accessToken}` },
    };
  }

  async function wipe() {
    await prisma.sourceRecord.deleteMany({
      where: {
        OR: [{ externalId: { in: NUMBERS } }, { externalId: { in: QIDS } }],
      },
    });
    await prisma.university.deleteMany({
      where: { registryNumber: { in: NUMBERS } },
    });
    await prisma.ingestionRun.deleteMany({
      where: {
        OR: [
          { triggeredBy: { startsWith: 'user:' } },
          { triggeredBy: 'itest' },
        ],
      },
    });
  }

  const ingest = () => api().post('/universities/ingestion').set(admin);
  const count = () =>
    prisma.university.count({ where: { registryNumber: { in: NUMBERS } } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PythonService)
      .useValue(python)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const a = await newUser('Admin', 'admin');
    admin = a.auth;
    adminId = a.id;
    member = (await newUser('Miembro')).auth;
  });

  beforeEach(async () => {
    await wipe();
    python.runUniversitiesPipeline.mockReset();
    python.runUniversitiesPipeline.mockImplementation(async () => fresh());
  });

  afterAll(async () => {
    await wipe();
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  describe('permisos', () => {
    it('exige token', async () => {
      await api().post('/universities/ingestion').expect(401);
      await api().get('/universities').expect(401);
    });

    it('solo un administrador puede ingerir o ver las ejecuciones', async () => {
      await api().post('/universities/ingestion').set(member).expect(403);
      await api().get('/universities/ingestion-runs').set(member).expect(403);
      expect(python.runUniversitiesPipeline).not.toHaveBeenCalled();
    });

    it('cualquier usuario autenticado puede consultar', async () => {
      await api().get('/universities').set(member).expect(200);
      await api().get('/universities/sources').set(member).expect(200);
    });
  });

  describe('ingesta', () => {
    it('crea las instituciones con su procedencia', async () => {
      const res = await ingest().expect(200);
      expect(res.body).toMatchObject({
        status: 'succeeded',
        created: 128,
        updated: 0,
        unchanged: 0,
        deactivated: 0,
        error: null,
        triggeredBy: `user:${adminId}`,
      });
      expect(await count()).toBe(128);
      const uai = await prisma.university.findUniqueOrThrow({
        where: { registryNumber: 'C26' },
        include: { sourceRecords: true },
      });
      expect(uai).toMatchObject({
        name: 'Universidad Adolfo Ibáñez',
        nameKey: 'universidad adolfo ibanez',
        category: 'universidad',
        wikidataId: 'Q611995',
        website: 'https://www.uai.cl',
        foundedYear: 1988,
        matchMethod: 'exact',
        isVigente: true,
      });
      expect(uai.sourceRecords.map((s) => s.sourceCode).sort()).toEqual([
        'mineduc_ies',
        'wikidata',
      ]);
      expect(uai.catalogFetchedAt?.toISOString()).toBe(
        '2026-10-24T12:00:00.000Z',
      );
      const records = await prisma.sourceRecord.count({
        where: { sourceCode: 'mineduc_ies' },
      });
      expect(records).toBe(128);
    });

    it('es idempotente: repetir la ingesta no cambia nada ni toca updated_at', async () => {
      await ingest().expect(200);
      const before = await prisma.university.findUniqueOrThrow({
        where: { registryNumber: 'A1' },
      });
      const res = await ingest().expect(200);
      expect(res.body).toMatchObject({
        created: 0,
        updated: 0,
        unchanged: 128,
        deactivated: 0,
      });
      const after = await prisma.university.findUniqueOrThrow({
        where: { registryNumber: 'A1' },
      });
      expect(after.updatedAt).toEqual(before.updatedAt);
      expect(await count()).toBe(128);
      expect(
        await prisma.sourceRecord.count({ where: { sourceCode: 'wikidata' } }),
      ).toBe(6);
    });

    it('detecta cambios por hash y desactiva lo que sale del catálogo', async () => {
      await ingest().expect(200);
      const next = fresh();
      const uai = next.universities.find((u) => u.registry_number === 'C26')!;
      uai.website = 'https://nuevo.uai.cl';
      uai.provenance.find((p) => p.source === 'wikidata')!.content_hash =
        'f'.repeat(64);
      next.universities = next.universities.filter(
        (u) => u.registry_number !== 'A8',
      );
      python.runUniversitiesPipeline.mockResolvedValueOnce(next);

      const res = await ingest().expect(200);
      expect(res.body).toMatchObject({
        created: 0,
        updated: 1,
        unchanged: 126,
        deactivated: 1,
      });
      const changed = await prisma.university.findUniqueOrThrow({
        where: { registryNumber: 'C26' },
      });
      expect(changed.website).toBe('https://nuevo.uai.cl');
      const gone = await prisma.university.findUniqueOrThrow({
        where: { registryNumber: 'A8' },
      });
      expect(gone.isVigente).toBe(false);
      expect(await count()).toBe(128); // no se borra nada
    });

    it('si Python falla se conservan los datos y la ejecución queda registrada', async () => {
      await ingest().expect(200);
      python.runUniversitiesPipeline.mockRejectedValueOnce(
        new ServiceUnavailableException(
          'No se pudo contactar al servicio Python',
        ),
      );
      const res = await ingest().expect(200);
      expect(res.body.status).toBe('failed');
      expect(res.body.error).toContain('No se pudo contactar');
      expect(await count()).toBe(128);
      const runs = await api()
        .get('/universities/ingestion-runs')
        .set(admin)
        .expect(200);
      expect(runs.body[0].status).toBe('failed');
      expect(runs.body[1].status).toBe('succeeded');
    });

    it('si el catálogo oficial no está disponible, no toca nada', async () => {
      await ingest().expect(200);
      const failed = fresh();
      failed.status = 'failed';
      failed.universities = [];
      failed.sources = [
        {
          ...failed.sources[0],
          status: 'unavailable',
          error: 'HTTP 503 tras 3 intentos',
        },
      ];
      python.runUniversitiesPipeline.mockResolvedValueOnce(failed);
      const res = await ingest().expect(200);
      expect(res.body).toMatchObject({
        status: 'failed',
        error: 'HTTP 503 tras 3 intentos',
      });
      expect(
        await prisma.university.count({
          where: { registryNumber: { in: NUMBERS }, isVigente: true },
        }),
      ).toBe(128);
    });

    it('si solo falla Wikidata (parcial), conserva el enriquecimiento anterior', async () => {
      await ingest().expect(200);
      const partial = fresh();
      partial.status = 'partial';
      partial.sources[1] = {
        ...partial.sources[1],
        status: 'unavailable',
        error: 'HTTP 503',
      };
      for (const u of partial.universities) {
        u.wikidata_id =
          u.website =
          u.latitude =
          u.longitude =
          u.founded_year =
          u.match =
            null;
        u.provenance = u.provenance.filter((p) => p.source === 'mineduc_ies');
      }
      python.runUniversitiesPipeline.mockResolvedValueOnce(partial);
      const res = await ingest().expect(200);
      expect(res.body).toMatchObject({
        status: 'partial',
        created: 0,
        updated: 0,
        unchanged: 128,
      });
      const uai = await prisma.university.findUniqueOrThrow({
        where: { registryNumber: 'C26' },
      });
      expect(uai.wikidataId).toBe('Q611995');
      expect(uai.website).toBe('https://www.uai.cl');
    });

    it('si Wikidata responde y una entidad ya no cruza, se limpia el enriquecimiento', async () => {
      await ingest().expect(200);
      const next = fresh();
      const uai = next.universities.find((u) => u.registry_number === 'C26')!;
      uai.wikidata_id =
        uai.website =
        uai.latitude =
        uai.longitude =
        uai.founded_year =
        uai.match =
          null;
      uai.provenance = uai.provenance.filter((p) => p.source === 'mineduc_ies');
      python.runUniversitiesPipeline.mockResolvedValueOnce(next);
      const res = await ingest().expect(200);
      expect(res.body.updated).toBe(1);
      const row = await prisma.university.findUniqueOrThrow({
        where: { registryNumber: 'C26' },
      });
      expect(row.wikidataId).toBeNull();
      expect(row.website).toBeNull();
      const orphan = await prisma.sourceRecord.findUniqueOrThrow({
        where: {
          sourceCode_externalId: {
            sourceCode: 'wikidata',
            externalId: 'Q611995',
          },
        },
      });
      expect(orphan.universityId).toBeNull();
    });

    it('rechaza una respuesta que no cumple el contrato', async () => {
      python.runUniversitiesPipeline.mockResolvedValueOnce({ hola: 'mundo' });
      const res = await ingest().expect(200);
      expect(res.body.status).toBe('failed');
      expect(res.body.error).toContain('contrato');
      expect(await count()).toBe(0);
    });

    it('no permite dos ingestas simultáneas', async () => {
      await prisma.ingestionRun.create({
        data: { status: 'running', triggeredBy: 'itest' },
      });
      await ingest().expect(409);
      expect(python.runUniversitiesPipeline).not.toHaveBeenCalled();
    });

    it('cierra como fallida una ejecución "running" abandonada', async () => {
      await prisma.ingestionRun.create({
        data: {
          status: 'running',
          triggeredBy: 'itest',
          startedAt: new Date(Date.now() - 3_600_000),
        },
      });
      await ingest().expect(200);
      const stale = await prisma.ingestionRun.findFirstOrThrow({
        where: { triggeredBy: 'itest' },
      });
      expect(stale.status).toBe('failed');
    });
  });

  describe('consulta y búsqueda', () => {
    beforeEach(async () => {
      await ingest().expect(200);
    });

    const names = (body: { items: { name: string }[] }) =>
      body.items.map((i) => i.name);

    it('lista ordenada por nombre con paginación y total', async () => {
      const res = await api()
        .get('/universities?limit=5')
        .set(member)
        .expect(200);
      expect(res.body).toMatchObject({
        total: 128,
        limit: 5,
        offset: 0,
        query: null,
      });
      expect(res.body.items).toHaveLength(5);
      const sorted = [...names(res.body)].sort((a, b) => a.localeCompare(b));
      expect(names(res.body).map((n) => n.toLowerCase())).toEqual(
        sorted.map((n) => n.toLowerCase()),
      );
      const page2 = await api()
        .get('/universities?limit=5&offset=5')
        .set(member)
        .expect(200);
      expect(names(page2.body)).not.toEqual(names(res.body));
    });

    it('filtra por categoría y tipo de institución', async () => {
      const uni = await api()
        .get('/universities?category=universidad&limit=100')
        .set(member)
        .expect(200);
      expect(uni.body.total).toBe(55);
      const est = await api()
        .get('/universities?category=universidad&ownership=estatal&limit=100')
        .set(member)
        .expect(200);
      expect(est.body.total).toBe(18);
    });

    it('busca por texto y ordena por relevancia, sin importar tildes', async () => {
      const res = await api()
        .get('/universities?q=adolfo%20ibanez')
        .set(member)
        .expect(200);
      expect(res.body.items[0]).toMatchObject({
        name: 'Universidad Adolfo Ibáñez',
        registryNumber: 'C26',
      });
      expect(res.body.items[0].score).toBeGreaterThan(0);
      expect(res.body.query).toBe('adolfo ibanez');
    });

    it('la búsqueda respeta los filtros y los prefijos', async () => {
      const res = await api()
        .get('/universities?q=antofa&category=universidad')
        .set(member)
        .expect(200);
      expect(names(res.body)).toContain('Universidad de Antofagasta');
      const none = await api()
        .get('/universities?q=antofa&category=instituto_profesional')
        .set(member)
        .expect(200);
      expect(none.body.total).toBe(0);
    });

    it('entiende la propiedad de la institución en la consulta', async () => {
      const res = await api()
        .get('/universities?q=universidad%20estatal&limit=10')
        .set(member)
        .expect(200);
      const top = res.body.items as { ownership: string; category: string }[];
      expect(top.slice(0, 10).every((i) => i.category === 'universidad')).toBe(
        true,
      );
      expect(
        top.filter((i) => i.ownership === 'estatal').length,
      ).toBeGreaterThanOrEqual(8);
    });

    it('oculta las inactivas salvo que se pidan', async () => {
      const next = fresh();
      next.universities = next.universities.filter(
        (u) => u.registry_number !== 'A8',
      );
      python.runUniversitiesPipeline.mockResolvedValueOnce(next);
      await ingest().expect(200);
      const hidden = await api()
        .get('/universities?q=magallanes')
        .set(member)
        .expect(200);
      expect(names(hidden.body)).not.toContain('Universidad de Magallanes');
      const shown = await api()
        .get('/universities?q=magallanes&includeInactive=true')
        .set(member)
        .expect(200);
      expect(names(shown.body)).toContain('Universidad de Magallanes');
    });

    it('cada resultado trae su procedencia', async () => {
      const res = await api()
        .get('/universities?q=adolfo')
        .set(member)
        .expect(200);
      const item = res.body.items[0];
      expect(
        item.sources.map((s: { source: string }) => s.source).sort(),
      ).toEqual(['mineduc_ies', 'wikidata']);
      expect(item.sources[0]).toHaveProperty('fetchedAt');
    });

    it('detalle con licencia y fechas de cada fuente', async () => {
      const list = await api()
        .get('/universities?q=adolfo')
        .set(member)
        .expect(200);
      const res = await api()
        .get(`/universities/${list.body.items[0].id}`)
        .set(member)
        .expect(200);
      expect(res.body.institutionType).toBe('UNIVERSIDAD PRIVADA');
      const wiki = res.body.sources.find(
        (s: { source: string }) => s.source === 'wikidata',
      );
      expect(wiki).toMatchObject({ license: 'CC0 1.0', externalId: 'Q611995' });
      expect(wiki.url).toBe('https://www.wikidata.org/wiki/Q611995');
      expect(wiki.contentHash).toHaveLength(64);
    });

    it('resuelve un nombre escrito a mano contra el catálogo', async () => {
      const resolve = (name: string) =>
        api()
          .get('/universities/resolve')
          .query({ name })
          .set(member)
          .expect(200);

      const exact = await resolve('  UNIVERSIDAD   de chile ');
      expect(exact.body).toMatchObject({
        method: 'exact',
        match: { registryNumber: 'A1' },
      });

      const sigla = await resolve('uai');
      expect(sigla.body).toMatchObject({
        method: 'search',
        match: { registryNumber: 'C26' },
      });

      const typo = await resolve('Adolfo Ibañez');
      expect(typo.body.match?.registryNumber).toBe('C26');

      // Ambiguo: no adivina, ofrece candidatos.
      const vague = await resolve('universidad católica');
      expect(vague.body.match).toBeNull();
      expect(vague.body.method).toBeNull();
      expect(vague.body.candidates.length).toBeGreaterThan(1);

      const unknown = await resolve('zzzz qqqq');
      expect(unknown.body).toMatchObject({
        method: null,
        match: null,
        candidates: [],
      });
    });

    it('no resuelve a instituciones que ya no están vigentes', async () => {
      const next = fresh();
      next.universities = next.universities.filter(
        (u) => u.registry_number !== 'A8',
      );
      python.runUniversitiesPipeline.mockResolvedValueOnce(next);
      await ingest().expect(200);
      const res = await api()
        .get('/universities/resolve')
        .query({ name: 'Universidad de Magallanes' })
        .set(member)
        .expect(200);
      expect(res.body.match).toBeNull();
    });

    it('validación y errores', async () => {
      await api().get('/universities?limit=0').set(member).expect(400);
      await api().get('/universities?category=otra').set(member).expect(400);
      await api()
        .get('/universities?q=' + 'x'.repeat(101))
        .set(member)
        .expect(400);
      await api().get('/universities?desconocido=1').set(member).expect(400);
      await api().get('/universities/no-es-uuid').set(member).expect(400);
      await api().get('/universities/resolve').set(member).expect(400);
      await api().get('/universities/resolve?name=a').set(member).expect(400);
      await api().get(`/universities/${randomUUID()}`).set(member).expect(404);
    });

    it('métricas de calidad y recuperación', async () => {
      python.runUniversitiesPipeline.mockRejectedValueOnce(
        new ServiceUnavailableException('caído'),
      );
      await ingest().expect(200); // una ejecución fallida más, para la tasa de error
      const res = await api()
        .get('/universities/metrics')
        .set(member)
        .expect(200);
      const m = res.body;
      expect(m.ingestion).toMatchObject({
        succeeded: 1,
        partial: 0,
        failed: 1,
        errorRate: 0.5,
      });
      expect(m.lastGoodRun).toMatchObject({
        catalogRows: 128,
        pctValid: 1,
        rejected: 0,
        duplicatesDiscarded: 0,
        pctDuplicates: 0,
        matchRate: 0.1091,
      });
      expect(m.database).toMatchObject({
        total: 128,
        active: 128,
        duplicatesInDatabase: 0,
      });
      expect(m.database.byCategory).toEqual({
        universidad: 55,
        instituto_profesional: 30,
        centro_formacion_tecnica: 43,
      });
      expect(m.database.universities).toMatchObject({
        total: 55,
        withWebsite: 6,
        withCoordinates: 4,
        coverageWebsite: 0.1091,
        coverageCoordinates: 0.0727,
      });
      expect(m.retrievalMs.mineduc_ies.samples).toBe(1);
      expect(m.freshness.map((f: { source: string }) => f.source)).toEqual([
        'mineduc_ies',
        'wikidata',
      ]);
      expect(m.freshness.every((f: { stale: boolean }) => !f.stale)).toBe(true);
    });

    it('estado de las fuentes y frescura', async () => {
      const res = await api()
        .get('/universities/sources')
        .set(member)
        .expect(200);
      const byCode = Object.fromEntries(
        res.body.sources.map((s: { code: string }) => [s.code, s]),
      );
      expect(byCode.mineduc_ies.records).toBe(128);
      expect(byCode.wikidata.records).toBe(6);
      expect(byCode.mineduc_ies.license).toContain('CC BY');
      expect(res.body.lastSuccessfulRun.status).toBe('succeeded');
      expect(res.body.staleAfterDays).toBe(14);
    });
  });
});
