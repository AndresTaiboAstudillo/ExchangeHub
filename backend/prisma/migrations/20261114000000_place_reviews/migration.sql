-- Reseñas de comercios: se reutiliza la tabla polimórfica `reviews` (target_type = 'place').
-- La restricción de estrellas (1 a 5) ya existe desde la migración social_model.

ALTER TABLE "reviews" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Antes solo admitía 'listing' y 'zone'.
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_target_type_check";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_type_check"
  CHECK ("target_type" IN ('place', 'listing', 'zone'));

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_body_length"
  CHECK ("body" IS NULL OR char_length("body") BETWEEN 1 AND 1000);

-- Una reseña por persona y lugar (se puede editar, no duplicar).
CREATE UNIQUE INDEX "reviews_author_id_target_type_target_id_key"
  ON "reviews"("author_id", "target_type", "target_id");

-- Listado de un lugar, de la más reciente a la más antigua.
DROP INDEX "reviews_target_type_target_id_idx";
CREATE INDEX "reviews_target_type_target_id_created_at_idx"
  ON "reviews"("target_type", "target_id", "created_at" DESC);
