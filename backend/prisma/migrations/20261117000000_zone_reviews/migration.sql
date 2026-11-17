-- Las zonas pasan a calificarse por reseñas (el color sale del promedio de estrellas):
-- el nivel de seguridad fijo ya no se usa y todas tienen la misma área.
ALTER TABLE "zones" DROP COLUMN "safety_level";
UPDATE "zones" SET "radius_m" = 400;
ALTER TABLE "zones" ADD CONSTRAINT "zones_radius_fixed" CHECK ("radius_m" = 400);
