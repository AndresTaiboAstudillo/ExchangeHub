/**
 * Mapa de Inicio contra PostgreSQL real: lugares de ejemplo, filtros por categoría y zona,
 * y actualización de comercios desde OpenStreetMap (con el servicio Python simulado).
 */
import { randomUUID } from 'node:crypto';
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
import type {
  PlacesPipelineResult,
  PythonPlace,
} from '../src/map/places.types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PythonService } from '../src/python/python.service.js';

process.env.JWT_SECRET = 'secreto-de-pruebas-con-al-menos-32-caracteres';

const DOMAIN = '@itest.local';
const PASSWORD = 'clave-segura-123';

const place = (n: number, extra: Partial<PythonPlace> = {}): PythonPlace => ({
  external_id: `node/${n}`,
  category: 'feria',
  name: `Lugar ${String(n).padStart(3, '0')}`,
  latitude: -33.045 + n / 10000,
  longitude: -71.61,
  address: null,
  opening_hours: null,
  website: null,
  content_hash: `h${n}`,
  ...extra,
});

const result = (
  places: PythonPlace[],
  status: 'ok' | 'failed' = 'ok',
): PlacesPipelineResult => ({
  status,
  source: 'osm_places',
  url: 'https://overpass.test',
  fetched_at: '2026-11-12T12:00:00Z',
  elapsed_ms: 5,
  records_received: places.length + 2,
  records_valid: places.length,
  records_rejected: 2,
  duplicates_discarded: 0,
  error: status === 'failed' ? 'HTTP 503' : null,
  places,
});

describe('Mapa (PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: { Authorization: string };
  let member: { Authorization: string };
  const python = { health: vi.fn(), info: vi.fn(), runPlacesPipeline: vi.fn() };
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
    return { Authorization: `Bearer ${login.body.accessToken}` };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PythonService)
      .useValue(python)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    admin = await newUser('Admin', 'admin');
    member = await newUser('Miembro');
  });

  beforeEach(async () => {
    python.runPlacesPipeline.mockReset();
    await prisma.place.deleteMany({});
  });

  afterAll(async () => {
    await prisma.place.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    await app.close();
  });

  describe('alojamientos y zonas', () => {
    it('requieren sesión', async () => {
      await api().get('/map/listings').expect(401);
      await api().get('/map/zones').expect(401);
      await api().get('/map/places').expect(401);
    });

    it('incluyen los lugares de ejemplo de la migración', async () => {
      const listings = await api().get('/map/listings').set(member).expect(200);
      expect(listings.body.length).toBeGreaterThanOrEqual(4);
      expect(listings.body[0]).toMatchObject({
        type: 'alojamiento',
        priceClp: 280000,
        availability: 'Disponible',
      });
      expect(typeof listings.body[0].latitude).toBe('number');

      const zones = await api().get('/map/zones').set(member).expect(200);
      expect(zones.body.length).toBeGreaterThanOrEqual(3);
      expect(zones.body[0]).toHaveProperty('radiusM');
      expect(zones.body[0]).not.toHaveProperty('safetyLevel');
    });
  });

  describe('zonas: reseñas y administración', () => {
    const validZone = {
      name: 'Zona de prueba',
      description: 'Barrio de ejemplo',
      latitude: -33.04,
      longitude: -71.62,
    };
    const createZone = async (body: object = validZone) =>
      (await api().post('/map/zones').set(admin).send(body).expect(201)).body;

    it('solo un administrador agrega, edita y elimina zonas', async () => {
      await api().post('/map/zones').set(member).send(validZone).expect(403);
      await api().post('/map/zones').send(validZone).expect(401);
      const zone = await createZone();
      await api()
        .patch(`/map/zones/${zone.id}`)
        .set(member)
        .send({ name: 'Otra' })
        .expect(403);
      await api().delete(`/map/zones/${zone.id}`).set(member).expect(403);
      await api().delete(`/map/zones/${zone.id}`).set(admin).expect(204);
    });

    it('todas las zonas tienen la misma área, aunque se pida otra', async () => {
      const zone = await createZone({ ...validZone, radiusM: 5000 }).catch(
        () => null,
      );
      // el radio no es un campo permitido: se rechaza con 400
      expect(zone).toBeNull();
      const ok = await createZone();
      const zones = await api().get('/map/zones').set(member).expect(200);
      const radii = new Set(
        zones.body.map((z: { radiusM: number }) => z.radiusM),
      );
      expect(radii.size).toBe(1);
      expect(ok.radiusM).toBe([...radii][0]);
      await api().delete(`/map/zones/${ok.id}`).set(admin).expect(204);
    });

    it('valida los datos de la zona', async () => {
      for (const bad of [
        { ...validZone, name: 'ab' },
        { ...validZone, latitude: 95 },
        { ...validZone, longitude: 'x' },
        { name: 'Sin coordenadas' },
      ]) {
        await api().post('/map/zones').set(admin).send(bad).expect(400);
      }
    });

    it('edita una zona y responde 404 si no existe', async () => {
      const zone = await createZone();
      const res = await api()
        .patch(`/map/zones/${zone.id}`)
        .set(admin)
        .send({ name: 'Nombre nuevo', safeHours: '  ' })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Nombre nuevo', safeHours: null });
      await api()
        .patch(`/map/zones/${randomUUID()}`)
        .set(admin)
        .send({ name: 'Nada' })
        .expect(404);
      await api().delete(`/map/zones/${zone.id}`).set(admin).expect(204);
      await api().delete(`/map/zones/${zone.id}`).set(admin).expect(404);
    });

    it('promedia las reseñas, permite una por persona y la lista de zonas trae el promedio', async () => {
      const zone = await createZone();
      const url = `/map/zones/${zone.id}/reviews`;
      const other = await newUser('Otra', 'user');
      await api().put(url).set(member).send({ rating: 5 }).expect(200);
      await api()
        .put(url)
        .set(other)
        .send({ rating: 2, body: 'Ruidosa' })
        .expect(200);
      await api().put(url).set(other).send({ rating: 3 }).expect(200); // actualiza, no duplica
      const list = await api().get(url).set(member).expect(200);
      expect(list.body.summary).toMatchObject({ count: 2, average: 4 });
      const zones = await api().get('/map/zones').set(member).expect(200);
      const found = zones.body.find((z: { id: string }) => z.id === zone.id);
      expect(found).toMatchObject({ ratingAverage: 4, ratingCount: 2 });
      await api().put(url).set(member).send({ rating: 6 }).expect(400);
      await api().delete(`/map/zones/${zone.id}`).set(admin).expect(204);
    });

    it('una zona sin reseñas no tiene promedio y una inexistente responde 404', async () => {
      const zone = await createZone();
      const zones = await api().get('/map/zones').set(member).expect(200);
      expect(
        zones.body.find((z: { id: string }) => z.id === zone.id),
      ).toMatchObject({
        ratingAverage: null,
        ratingCount: 0,
      });
      await api()
        .get(`/map/zones/${randomUUID()}/reviews`)
        .set(member)
        .expect(404);
      await api()
        .put(`/map/zones/${randomUUID()}/reviews`)
        .set(member)
        .send({ rating: 4 })
        .expect(404);
      await api().delete(`/map/zones/${zone.id}`).set(admin).expect(204);
    });

    it('al eliminar la zona se eliminan sus reseñas', async () => {
      const zone = await createZone();
      await api()
        .put(`/map/zones/${zone.id}/reviews`)
        .set(member)
        .send({ rating: 4 })
        .expect(200);
      await api().delete(`/map/zones/${zone.id}`).set(admin).expect(204);
      const left = await prisma.review.count({
        where: { targetType: 'zone', targetId: zone.id },
      });
      expect(left).toBe(0);
    });
  });

  describe('actualización desde OpenStreetMap', () => {
    const refresh = (who = admin) => api().post('/map/places/refresh').set(who);

    it('solo la puede ejecutar un administrador', async () => {
      await api().post('/map/places/refresh').expect(401);
      await refresh(member).expect(403);
      expect(python.runPlacesPipeline).not.toHaveBeenCalled();
    });

    it('inserta, actualiza y elimina según lo que devuelve OSM', async () => {
      python.runPlacesPipeline.mockResolvedValue(
        result([place(1), place(2), place(3)]),
      );
      const first = await refresh().expect(200);
      expect(first.body).toMatchObject({
        valid: 3,
        inserted: 3,
        updated: 0,
        removed: 0,
      });
      expect(await prisma.place.count()).toBe(3);

      // 2 cambia de nombre, 3 desaparece, 4 es nuevo (3 de 3 previos → no es una respuesta parcial).
      python.runPlacesPipeline.mockResolvedValue(
        result([
          place(1),
          place(2, { name: 'Nombre nuevo', category: 'farmacia' }),
          place(4),
        ]),
      );
      const second = await refresh().expect(200);
      expect(second.body).toMatchObject({
        inserted: 1,
        updated: 2,
        removed: 1,
        pruneSkipped: false,
      });
      const rows = await prisma.place.findMany({
        orderBy: { externalId: 'asc' },
      });
      expect(rows.map((r) => r.externalId)).toEqual([
        'node/1',
        'node/2',
        'node/4',
      ]);
      expect(rows[1]).toMatchObject({
        name: 'Nombre nuevo',
        category: 'farmacia',
      });
    });

    it('no borra nada si la respuesta trae menos de la mitad de lo que ya había', async () => {
      python.runPlacesPipeline.mockResolvedValue(
        result([1, 2, 3, 4].map((n) => place(n))),
      );
      await refresh().expect(200);
      python.runPlacesPipeline.mockResolvedValue(result([place(1)]));
      const res = await refresh().expect(200);
      expect(res.body).toMatchObject({ removed: 0, pruneSkipped: true });
      expect(await prisma.place.count()).toBe(4);
    });

    it('si OpenStreetMap falla responde 502 y deja los datos intactos', async () => {
      python.runPlacesPipeline.mockResolvedValue(result([place(1)]));
      await refresh().expect(200);
      python.runPlacesPipeline.mockResolvedValue(result([], 'failed'));
      const res = await refresh().expect(502);
      expect(JSON.stringify(res.body)).toContain('HTTP 503');
      expect(await prisma.place.count()).toBe(1);
    });

    it('si el servicio Python no responde, devuelve 503', async () => {
      python.runPlacesPipeline.mockRejectedValue(
        new ServiceUnavailableException('caído'),
      );
      await refresh().expect(503);
    });

    it('guarda más de un bloque de filas', async () => {
      const many = Array.from({ length: 1200 }, (_, i) => place(i + 1));
      python.runPlacesPipeline.mockResolvedValue(result(many));
      const res = await refresh().expect(200);
      expect(res.body.inserted).toBe(1200);
      expect(await prisma.place.count()).toBe(1200);
    });
  });

  describe('consulta de comercios', () => {
    beforeEach(async () => {
      python.runPlacesPipeline.mockResolvedValue(
        result([
          place(1, {
            category: 'feria',
            latitude: -33.045,
            longitude: -71.609,
          }),
          place(2, {
            category: 'farmacia',
            latitude: -33.046,
            longitude: -71.62,
          }),
          place(3, {
            category: 'panaderia',
            latitude: -33.02,
            longitude: -71.55,
          }), // Viña
        ]),
      );
      await api().post('/map/places/refresh').set(admin).expect(200);
    });

    it('filtra por una o varias categorías', async () => {
      const one = await api()
        .get('/map/places?category=feria')
        .set(member)
        .expect(200);
      expect(one.body.items.map((p: { name: string }) => p.name)).toEqual([
        'Lugar 001',
      ]);
      const two = await api()
        .get('/map/places?category=feria,farmacia')
        .set(member)
        .expect(200);
      expect(two.body.total).toBe(2);
    });

    it('filtra por la zona visible (oeste,sur,este,norte)', async () => {
      const valpo = await api()
        .get('/map/places?bbox=-71.65,-33.06,-71.59,-33.03')
        .set(member)
        .expect(200);
      expect(valpo.body.items).toHaveLength(2);
      const vina = await api()
        .get('/map/places?bbox=-71.57,-33.04,-71.53,-33.00')
        .set(member)
        .expect(200);
      expect(vina.body.items.map((p: { name: string }) => p.name)).toEqual([
        'Lugar 003',
      ]);
    });

    it('acepta las categorías de alojamiento', async () => {
      await prisma.place.create({
        data: {
          externalId: 'node/9001',
          category: 'hostal',
          name: 'Hostal Prueba',
          latitude: -33.045,
          longitude: -71.609,
          contentHash: 'h',
          fetchedAt: new Date(),
        },
      });
      const res = await api()
        .get('/map/places?category=hotel,hostal,hospedaje')
        .set(member)
        .expect(200);
      expect(res.body.items.map((p: { name: string }) => p.name)).toEqual([
        'Hostal Prueba',
      ]);
      const commerce = await api()
        .get('/map/places?category=feria,farmacia,panaderia')
        .set(member)
        .expect(200);
      expect(commerce.body.total).toBe(3);
    });

    it('limita los resultados e indica si se truncó', async () => {
      const res = await api()
        .get('/map/places?limit=2')
        .set(member)
        .expect(200);
      expect(res.body).toMatchObject({ total: 3, truncated: true });
      expect(res.body.items).toHaveLength(2);
    });

    it('no expone datos internos', async () => {
      const res = await api().get('/map/places').set(member).expect(200);
      expect(res.body.items[0]).not.toHaveProperty('contentHash');
      expect(res.body.items[0]).not.toHaveProperty('source');
    });

    it('rechaza parámetros inválidos', async () => {
      await api().get('/map/places?category=casino').set(member).expect(400);
      await api().get('/map/places?bbox=hola').set(member).expect(400);
      await api()
        .get('/map/places?bbox=-71.5,-33.0,-71.6,-33.1')
        .set(member)
        .expect(400); // invertido
      await api().get('/map/places?limit=9999').set(member).expect(400);
    });
  });

  describe('reseñas de comercios', () => {
    let placeId: string;
    let other: { Authorization: string };
    let otherId: string;
    const reviews = (id = placeId) => `/map/places/${id}/reviews`;
    const meId = async (who: { Authorization: string }) =>
      (await api().get('/users/me').set(who).expect(200)).body.id as string;

    beforeEach(async () => {
      await prisma.review.deleteMany({});
      python.runPlacesPipeline.mockResolvedValue(result([place(1), place(2)]));
      await api().post('/map/places/refresh').set(admin).expect(200);
      placeId = (
        await prisma.place.findFirstOrThrow({
          where: { externalId: 'node/1' },
        })
      ).id;
      other ??= await newUser('Otra Persona');
      otherId = await meId(other);
    });

    afterAll(async () => {
      await prisma.review.deleteMany({});
    });

    it('requieren sesión y un comercio existente', async () => {
      await api().get(reviews()).expect(401);
      await api().put(reviews()).send({ rating: 5 }).expect(401);
      await api().get(reviews(randomUUID())).set(member).expect(404);
      await api()
        .put(reviews(randomUUID()))
        .set(member)
        .send({ rating: 5 })
        .expect(404);
      await api().get('/map/places/no-es-uuid/reviews').set(member).expect(400);
    });

    it('sin reseñas devuelve el resumen vacío', async () => {
      const res = await api().get(reviews()).set(member).expect(200);
      expect(res.body).toEqual({
        summary: { count: 0, average: null, distribution: [0, 0, 0, 0, 0] },
        mine: null,
        items: [],
        nextCursor: null,
      });
    });

    it('crea una reseña y la muestra como propia', async () => {
      const res = await api()
        .put(reviews())
        .set(member)
        .send({ rating: 4, body: '  Buenos precios  ' })
        .expect(200);
      expect(res.body.review).toMatchObject({
        rating: 4,
        body: 'Buenos precios',
        own: true,
        edited: false,
        author: { name: 'Miembro' },
      });
      expect(res.body.summary).toMatchObject({ count: 1, average: 4 });

      const list = await api().get(reviews()).set(member).expect(200);
      expect(list.body.mine.id).toBe(res.body.review.id);
      const asOther = await api().get(reviews()).set(other).expect(200);
      expect(asOther.body.mine).toBeNull();
      expect(asOther.body.items[0].own).toBe(false);
    });

    it('permite una sola reseña por persona: volver a enviarla la reemplaza', async () => {
      const first = await api()
        .put(reviews())
        .set(member)
        .send({ rating: 2, body: 'Regular' })
        .expect(200);
      const second = await api()
        .put(reviews())
        .set(member)
        .send({ rating: 5 })
        .expect(200);
      expect(second.body.review.id).toBe(first.body.review.id);
      expect(second.body.review).toMatchObject({ rating: 5, body: null });
      expect(second.body.summary.count).toBe(1);
      expect(await prisma.review.count()).toBe(1);
    });

    it('calcula promedio y distribución', async () => {
      await api().put(reviews()).set(member).send({ rating: 5 }).expect(200);
      await api().put(reviews()).set(other).send({ rating: 2 }).expect(200);
      const res = await api().get(reviews()).set(admin).expect(200);
      expect(res.body.summary).toEqual({
        count: 2,
        average: 3.5,
        distribution: [0, 1, 0, 0, 1],
      });
    });

    it('pagina de la más reciente a la más antigua', async () => {
      await api()
        .put(reviews())
        .set(member)
        .send({ rating: 3, body: 'Primera' })
        .expect(200);
      await api()
        .put(reviews())
        .set(other)
        .send({ rating: 4, body: 'Segunda' })
        .expect(200);
      const page1 = await api()
        .get(`${reviews()}?limit=1`)
        .set(admin)
        .expect(200);
      expect(page1.body.items.map((r: { body: string }) => r.body)).toEqual([
        'Segunda',
      ]);
      expect(page1.body.nextCursor).toBeTruthy();
      const page2 = await api()
        .get(`${reviews()}?limit=1&cursor=${page1.body.nextCursor}`)
        .set(admin)
        .expect(200);
      expect(page2.body.items.map((r: { body: string }) => r.body)).toEqual([
        'Primera',
      ]);
      expect(page2.body.nextCursor).toBeNull();
    });

    it('valida las estrellas y el largo del texto', async () => {
      for (const rating of [0, 6, 3.5, '4', null]) {
        await api().put(reviews()).set(member).send({ rating }).expect(400);
      }
      await api().put(reviews()).set(member).send({}).expect(400);
      await api()
        .put(reviews())
        .set(member)
        .send({ rating: 3, body: 'x'.repeat(1001) })
        .expect(400);
      await api()
        .put(reviews())
        .set(member)
        .send({ rating: 3, body: '   ' })
        .expect(200)
        .expect((r) => expect(r.body.review.body).toBeNull());
      expect(await prisma.review.count()).toBe(1);
    });

    it('oculta el nombre de quien tiene el perfil oculto', async () => {
      await api()
        .put(reviews())
        .set(other)
        .send({ rating: 5, body: 'Excelente' })
        .expect(200);
      await prisma.user.update({
        where: { id: otherId },
        data: { isVisible: false },
      });
      try {
        const res = await api().get(reviews()).set(member).expect(200);
        expect(res.body.items[0]).toMatchObject({
          body: 'Excelente',
          author: { id: null, name: 'Estudiante', countryOfOrigin: null },
        });
        // Quien escribió la reseña sí se ve a sí misma.
        const self = await api().get(reviews()).set(other).expect(200);
        expect(self.body.items[0].author.name).toBe('Otra Persona');
      } finally {
        await prisma.user.update({
          where: { id: otherId },
          data: { isVisible: true },
        });
      }
    });

    it('agrega promedio y cantidad al listado de comercios', async () => {
      await api().put(reviews()).set(member).send({ rating: 5 }).expect(200);
      await api().put(reviews()).set(other).send({ rating: 4 }).expect(200);
      const res = await api().get('/map/places').set(member).expect(200);
      const byName = Object.fromEntries(
        res.body.items.map((p: { name: string }) => [p.name, p]),
      );
      expect(byName['Lugar 001']).toMatchObject({
        ratingAverage: 4.5,
        ratingCount: 2,
      });
      expect(byName['Lugar 002']).toMatchObject({
        ratingAverage: null,
        ratingCount: 0,
      });
    });

    it('permite borrar la propia, no la ajena, y a un administrador moderar', async () => {
      const mine = await api()
        .put(reviews())
        .set(member)
        .send({ rating: 1, body: 'Spam' })
        .expect(200);
      const theirs = await api()
        .put(reviews())
        .set(other)
        .send({ rating: 5 })
        .expect(200);

      await api()
        .delete(`/map/reviews/${theirs.body.review.id}`)
        .set(member)
        .expect(404);
      await api()
        .delete(`/map/reviews/${randomUUID()}`)
        .set(member)
        .expect(404);
      await api()
        .delete(`/map/reviews/${mine.body.review.id}`)
        .set(member)
        .expect(204);
      await api()
        .delete(`/map/reviews/${theirs.body.review.id}`)
        .set(admin)
        .expect(204);
      expect(await prisma.review.count()).toBe(0);
    });

    it('al actualizar desde OSM conserva los comercios que tienen reseñas', async () => {
      await api().put(reviews()).set(member).send({ rating: 5 }).expect(200);
      // OSM ya no trae node/1 (pero sí otros dos: no es una respuesta parcial).
      python.runPlacesPipeline.mockResolvedValue(result([place(2), place(3)]));
      const res = await api()
        .post('/map/places/refresh')
        .set(admin)
        .expect(200);
      expect(res.body.removed).toBe(0);
      const names = (await prisma.place.findMany()).map((p) => p.name).sort();
      expect(names).toEqual(['Lugar 001', 'Lugar 002', 'Lugar 003']);

      // Sin reseñas, ese mismo comercio sí se elimina en la siguiente actualización.
      await prisma.review.deleteMany({});
      const again = await api()
        .post('/map/places/refresh')
        .set(admin)
        .expect(200);
      expect(again.body.removed).toBe(1);
    });

    it('al eliminar un comercio no deja reseñas huérfanas visibles', async () => {
      await api().put(reviews()).set(member).send({ rating: 5 }).expect(200);
      await prisma.review.deleteMany({});
      await prisma.place.delete({ where: { id: placeId } });
      await api().get(reviews()).set(member).expect(404);
    });
  });

  describe('reseñas de alojamientos', () => {
    const LISTING = '00000000-0000-4000-8000-0000000a0001';
    const url = (id = LISTING) => `/map/listings/${id}/reviews`;

    beforeEach(async () => {
      await prisma.review.deleteMany({});
    });
    afterAll(async () => {
      await prisma.review.deleteMany({});
    });

    it('requieren sesión y un alojamiento existente', async () => {
      await api().get(url()).expect(401);
      await api().get(url(randomUUID())).set(member).expect(404);
      await api()
        .put(url(randomUUID()))
        .set(member)
        .send({ rating: 5 })
        .expect(404);
    });

    it('crean, editan, promedian y se reflejan en el listado', async () => {
      const first = await api()
        .put(url())
        .set(member)
        .send({ rating: 2, body: 'Frío' })
        .expect(200);
      const again = await api()
        .put(url())
        .set(member)
        .send({ rating: 4 })
        .expect(200);
      expect(again.body.review.id).toBe(first.body.review.id);
      await api().put(url()).set(admin).send({ rating: 5 }).expect(200);

      const res = await api().get(url()).set(member).expect(200);
      expect(res.body.summary).toMatchObject({ count: 2, average: 4.5 });
      expect(res.body.mine).toMatchObject({ rating: 4, own: true });

      const listings = await api().get('/map/listings').set(member).expect(200);
      const l = listings.body.find((x: { id: string }) => x.id === LISTING);
      expect(l).toMatchObject({ ratingAverage: 4.5, ratingCount: 2 });
      const other = listings.body.find((x: { id: string }) => x.id !== LISTING);
      expect(other).toMatchObject({ ratingAverage: null, ratingCount: 0 });
    });

    it('un id de alojamiento no sirve como comercio (y viceversa)', async () => {
      await api().get(`/map/places/${LISTING}/reviews`).set(member).expect(404);
      python.runPlacesPipeline.mockResolvedValue(result([place(1)]));
      await api().post('/map/places/refresh').set(admin).expect(200);
      const p = await prisma.place.findFirstOrThrow();
      await api().get(url(p.id)).set(member).expect(404);
    });

    it('se pueden borrar con el mismo endpoint de moderación', async () => {
      const r = await api()
        .put(url())
        .set(member)
        .send({ rating: 1 })
        .expect(200);
      await api()
        .delete(`/map/reviews/${r.body.review.id}`)
        .set(member)
        .expect(204);
      expect(await prisma.review.count()).toBe(0);
    });
  });

  describe('universidades en el mapa', () => {
    const PREFIX = 'Universidad de Prueba Mapa';
    const uni = (suffix: string, extra: Record<string, unknown> = {}) =>
      prisma.university.create({
        data: { name: `${PREFIX} ${suffix}`, ...extra },
      });

    beforeEach(async () => {
      await prisma.university.deleteMany({
        where: { name: { startsWith: PREFIX } },
      });
    });
    afterAll(async () => {
      await prisma.university.deleteMany({
        where: { name: { startsWith: PREFIX } },
      });
    });

    it('requiere sesión', async () => {
      await api().get('/map/universities').expect(401);
    });

    it('lista solo las vigentes y con coordenadas', async () => {
      await uni('A', {
        latitude: -33.04,
        longitude: -71.61,
        category: 'universidad',
      });
      await uni('B sin coordenadas', { category: 'universidad' });
      await uni('C cerrada', {
        latitude: -33,
        longitude: -71,
        isVigente: false,
      });
      const res = await api().get('/map/universities').set(member).expect(200);
      const mine = res.body.filter((u: { name: string }) =>
        u.name.startsWith(PREFIX),
      );
      expect(mine.map((u: { name: string }) => u.name)).toEqual([
        `${PREFIX} A`,
      ]);
      expect(mine[0]).toMatchObject({
        latitude: -33.04,
        longitude: -71.61,
        category: 'universidad',
      });
      expect(mine[0]).not.toHaveProperty('registryNumber');
    });
  });

  describe('arriendos (solo administradores)', () => {
    const valid = {
      name: 'Pieza en Playa Ancha',
      address: 'Av. Playa Ancha 100, Valparaíso',
      latitude: -33.0371,
      longitude: -71.6402,
      description: 'Pieza luminosa',
      priceClp: 210000,
      availability: 'Disponible',
    };
    const created: string[] = [];
    const make = async (extra = {}) => {
      const res = await api()
        .post('/map/listings')
        .set(admin)
        .send({ ...valid, ...extra })
        .expect(201);
      created.push(res.body.id);
      return res.body as { id: string };
    };
    afterEach(async () => {
      await prisma.review.deleteMany({
        where: { targetType: 'listing', targetId: { in: created } },
      });
      await prisma.listing.deleteMany({ where: { id: { in: created } } });
      created.length = 0;
    });

    it('un usuario común no puede crear, editar ni eliminar', async () => {
      const item = await make();
      await api().post('/map/listings').send(valid).expect(401);
      await api().post('/map/listings').set(member).send(valid).expect(403);
      await api()
        .patch(`/map/listings/${item.id}`)
        .set(member)
        .send({ priceClp: 1 })
        .expect(403);
      await api().delete(`/map/listings/${item.id}`).set(member).expect(403);
      expect(await prisma.listing.count({ where: { id: item.id } })).toBe(1);
    });

    it('un administrador crea un arriendo que aparece en el listado, con su autor', async () => {
      const item = await make({ name: '  Con espacios  ' });
      const row = await prisma.listing.findUniqueOrThrow({
        where: { id: item.id },
      });
      expect(row).toMatchObject({
        name: 'Con espacios',
        type: 'alojamiento',
        priceClp: 210000,
      });
      expect(row.authorId).toBeTruthy();
      const list = await api().get('/map/listings').set(member).expect(200);
      expect(
        list.body.find((l: { id: string }) => l.id === item.id),
      ).toMatchObject({
        name: 'Con espacios',
        ratingCount: 0,
        ratingAverage: null,
      });
    });

    it('los campos opcionales pueden omitirse o venir vacíos', async () => {
      const item = await make({
        address: '  ',
        description: '',
        priceClp: undefined,
        availability: '',
      });
      const row = await prisma.listing.findUniqueOrThrow({
        where: { id: item.id },
      });
      expect(row).toMatchObject({
        address: null,
        description: null,
        priceClp: null,
        availability: null,
      });
    });

    it('valida nombre, coordenadas y precio', async () => {
      const bad = [
        { name: 'ab' },
        { name: 'x'.repeat(121) },
        { latitude: 91 },
        { latitude: 'a' },
        { longitude: -181 },
        { priceClp: -1 },
        { priceClp: 1.5 },
        { priceClp: 30_000_000 },
        { description: 'x'.repeat(1001) },
        { availability: 'x'.repeat(61) },
      ];
      for (const extra of bad) {
        await api()
          .post('/map/listings')
          .set(admin)
          .send({ ...valid, ...extra })
          .expect(400);
      }
      await api()
        .post('/map/listings')
        .set(admin)
        .send({ name: 'Sin coordenadas' })
        .expect(400);
      expect(
        await prisma.listing.count({ where: { name: 'Sin coordenadas' } }),
      ).toBe(0);
    });

    it('edita solo los campos enviados y permite vaciar un campo', async () => {
      const item = await make();
      const res = await api()
        .patch(`/map/listings/${item.id}`)
        .set(admin)
        .send({ priceClp: 250000, description: '', availability: '2 cupos' })
        .expect(200);
      expect(res.body).toMatchObject({
        name: valid.name,
        priceClp: 250000,
        description: null,
        availability: '2 cupos',
        latitude: valid.latitude,
      });
      await api()
        .patch(`/map/listings/${item.id}`)
        .set(admin)
        .send({ latitude: 200 })
        .expect(400);
      await api()
        .patch(`/map/listings/${randomUUID()}`)
        .set(admin)
        .send({ priceClp: 1 })
        .expect(404);
    });

    it('un administrador puede editar también los arriendos de ejemplo', async () => {
      const SAMPLE = '00000000-0000-4000-8000-0000000a0004';
      const before = await prisma.listing.findUniqueOrThrow({
        where: { id: SAMPLE },
      });
      try {
        await api()
          .patch(`/map/listings/${SAMPLE}`)
          .set(admin)
          .send({ priceClp: 999 })
          .expect(200);
      } finally {
        await prisma.listing.update({
          where: { id: SAMPLE },
          data: { priceClp: before.priceClp },
        });
      }
    });

    it('al eliminar un arriendo se eliminan sus reseñas', async () => {
      const item = await make();
      await api()
        .put(`/map/listings/${item.id}/reviews`)
        .set(member)
        .send({ rating: 5 })
        .expect(200);
      await api().delete(`/map/listings/${item.id}`).set(admin).expect(204);
      expect(await prisma.listing.count({ where: { id: item.id } })).toBe(0);
      expect(await prisma.review.count({ where: { targetId: item.id } })).toBe(
        0,
      );
      await api().delete(`/map/listings/${item.id}`).set(admin).expect(404);
      await api()
        .get(`/map/listings/${item.id}/reviews`)
        .set(member)
        .expect(404);
    });

    it('el rol se lee de la base: quien pierde el rol deja de poder', async () => {
      const id = (await api().get('/users/me').set(admin).expect(200)).body.id;
      await prisma.user.update({ where: { id }, data: { role: 'user' } });
      try {
        await api().post('/map/listings').set(admin).send(valid).expect(403);
      } finally {
        await prisma.user.update({ where: { id }, data: { role: 'admin' } });
      }
    });
  });
});
