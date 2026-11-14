-- Mapa de Inicio: comercios de OpenStreetMap + alojamientos y zonas de ejemplo.

-- Los lugares de ejemplo no pertenecen a ningún usuario.
ALTER TABLE "listings" ALTER COLUMN "author_id" DROP NOT NULL;
ALTER TABLE "listings" ADD COLUMN "price_clp" INTEGER;
ALTER TABLE "listings" ADD COLUMN "availability" TEXT;
ALTER TABLE "zones" ADD COLUMN "radius_m" INTEGER NOT NULL DEFAULT 400;

CREATE TABLE "places" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL DEFAULT 'osm',
    "external_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "opening_hours" TEXT,
    "website" TEXT,
    "content_hash" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "places_lat_range" CHECK ("latitude" BETWEEN -90 AND 90),
    CONSTRAINT "places_lng_range" CHECK ("longitude" BETWEEN -180 AND 180)
);
CREATE UNIQUE INDEX "places_source_external_id_key" ON "places"("source", "external_id");
CREATE INDEX "places_category_idx" ON "places"("category");
CREATE INDEX "places_latitude_longitude_idx" ON "places"("latitude", "longitude");

-- Datos de ejemplo (coordenadas aproximadas). Idempotentes: se pueden borrar o editar sin que
-- vuelvan a aparecer, porque los ids son fijos y solo se insertan una vez.
INSERT INTO "listings" ("id", "author_id", "type", "name", "address", "latitude", "longitude", "description", "price_clp", "availability") VALUES
 ('00000000-0000-4000-8000-0000000a0001', NULL, 'alojamiento', 'Habitación en Cerro Alegre', 'Almirante Montt 256, Valparaíso', -33.0437, -71.6288, 'Habitación individual en departamento compartido con 2 compañeros. Baño compartido, cocina equipada y vista al mar.', 280000, 'Disponible'),
 ('00000000-0000-4000-8000-0000000a0002', NULL, 'alojamiento', 'Departamento compartido — Viña', 'Av. Libertad 1050, Viña del Mar', -33.0235, -71.5518, 'Piso compartido con 4 habitaciones, cerca del metro y la playa. Gastos comunes incluidos.', 195000, '2 cupos'),
 ('00000000-0000-4000-8000-0000000a0003', NULL, 'alojamiento', 'Pieza en casa familiar', 'Ecuador 789, Valparaíso', -33.0346, -71.6393, 'Pieza en casa familiar de Playa Ancha, con desayuno opcional.', 220000, 'Disponible'),
 ('00000000-0000-4000-8000-0000000a0004', NULL, 'alojamiento', 'Pensión — Cerro Barón', 'Carlos Condell 314, Valparaíso', -33.0447, -71.6150, 'Pensión estudiantil con cocina compartida.', 160000, 'Disponible')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "zones" ("id", "name", "safety_level", "description", "safe_hours", "lat_center", "lng_center", "radius_m") VALUES
 ('00000000-0000-4000-8000-0000000b0001', 'Cerro Alegre / Concepción', 'safe', 'Barrio turístico, muy transitado.', 'Segura hasta las 23:00', -33.0425, -71.6290, 350),
 ('00000000-0000-4000-8000-0000000b0002', 'Puerto / Aduana', 'caution', 'Zona portuaria, activa de día.', 'Evitar después de las 21:00', -33.0395, -71.6275, 350),
 ('00000000-0000-4000-8000-0000000b0003', 'Av. Argentina / Plaza Victoria', 'busy', 'Centro cívico y comercial.', 'Segura durante el día y la noche', -33.0458, -71.6196, 400)
ON CONFLICT ("id") DO NOTHING;
