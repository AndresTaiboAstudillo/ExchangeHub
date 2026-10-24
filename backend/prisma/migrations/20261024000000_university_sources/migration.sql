-- Catálogo de universidades enriquecido con fuentes externas, con procedencia y frescura.

-- AlterTable
ALTER TABLE "universities"
  ADD COLUMN "registry_number" TEXT,
  ADD COLUMN "name_key" TEXT,
  ADD COLUMN "institution_type" TEXT,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "ownership" TEXT,
  ADD COLUMN "operating_status" TEXT,
  ADD COLUMN "is_vigente" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "wikidata_id" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "founded_year" INTEGER,
  ADD COLUMN "match_method" TEXT,
  ADD COLUMN "match_score" DOUBLE PRECISION,
  ADD COLUMN "catalog_fetched_at" TIMESTAMP(3),
  ADD COLUMN "enriched_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "data_sources" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "license" TEXT,
    "description" TEXT,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "deactivated" INTEGER NOT NULL DEFAULT 0,
    "sources" JSONB,
    "quality" JSONB,
    "rejected" JSONB,
    "error" TEXT,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_code" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "url" TEXT,
    "payload" JSONB NOT NULL,
    "university_id" UUID,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_run_id" UUID,

    CONSTRAINT "source_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "universities_registry_number_key" ON "universities"("registry_number");
CREATE UNIQUE INDEX "universities_name_key_key" ON "universities"("name_key");
CREATE UNIQUE INDEX "universities_wikidata_id_key" ON "universities"("wikidata_id");
CREATE INDEX "universities_category_idx" ON "universities"("category");
CREATE INDEX "ingestion_runs_started_at_idx" ON "ingestion_runs"("started_at");
CREATE INDEX "source_records_university_id_idx" ON "source_records"("university_id");
CREATE UNIQUE INDEX "source_records_source_code_external_id_key" ON "source_records"("source_code", "external_id");

-- AddForeignKey
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_code_fkey" FOREIGN KEY ("source_code") REFERENCES "data_sources"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_last_run_id_fkey" FOREIGN KEY ("last_run_id") REFERENCES "ingestion_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones de calidad (Prisma no las expresa; la base las garantiza igualmente)
ALTER TABLE "universities"
  ADD CONSTRAINT "universities_latitude_chk" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "universities_longitude_chk" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "universities_founded_year_chk" CHECK ("founded_year" IS NULL OR "founded_year" BETWEEN 1500 AND 2100);
ALTER TABLE "ingestion_runs"
  ADD CONSTRAINT "ingestion_runs_status_chk" CHECK ("status" IN ('running', 'succeeded', 'partial', 'failed'));

-- Fuentes conocidas
INSERT INTO "data_sources" ("code", "name", "url", "license", "description") VALUES
  ('mineduc_ies', 'Instituciones Vigentes Reconocidas por el MINEDUC',
   'https://www.ayudamineduc.cl/ficha/instituciones-vigentes-reconocidas-por-el-mineduc',
   'CC BY 2.0 Chile (según el sitio; alcance sobre el archivo por confirmar)',
   'Catálogo oficial de instituciones de educación superior (Excel).'),
  ('wikidata', 'Wikidata',
   'https://www.wikidata.org',
   'CC0 1.0',
   'Datos estructurados: sitio web, coordenadas y año de fundación.');
