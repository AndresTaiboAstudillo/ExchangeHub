-- Foto de perfil: los bytes viven en una tabla aparte (para no cargarlos en cada consulta de usuarios)
-- y users.avatar_updated_at sirve de versión del enlace. Se elimina junto con la cuenta.
ALTER TABLE "users" ADD COLUMN "avatar_updated_at" TIMESTAMP(3);

CREATE TABLE "user_avatars" (
    "user_id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_avatars_type" CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT "user_avatars_size" CHECK (octet_length("data") <= 65536)
);

ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
