-- Datos de prueba para las pruebas de carga (k6). Crea usuarios, arriendos, zonas, comercios, universidades,
-- publicaciones, reseñas, amistades, mensajes y notificaciones con volúmenes parecidos a un uso real.
--
-- SOLO para una base de pruebas: se niega a ejecutarse si el nombre de la base no contiene "carga".
-- Todos los usuarios son carga-1@carga.test … carga-300@carga.test con la contraseña `carga-prueba-123`.
-- Se puede repetir: borra primero lo que creó antes (solo filas marcadas como "carga").
--
-- Volumen (ajustable con las variables de más abajo): 300 usuarios, 200 arriendos, 40 zonas, 3.000 comercios,
-- 60 universidades, 2.000 publicaciones, 8.000 respuestas, ~3.000 reseñas, 1.500 amistades, 9.000 mensajes.

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() NOT LIKE '%carga%' THEN
    RAISE EXCEPTION 'Esta base (%) no parece de pruebas de carga. Usa una cuyo nombre contenga "carga".', current_database();
  END IF;
END $$;

BEGIN;

-- ── Limpieza de una ejecución anterior ───────────────────────────────────────────────────────────────────
-- (Al borrar usuarios se borran en cascada sus arriendos, publicaciones, reseñas, amistades, etc.)
DELETE FROM users WHERE email LIKE '%@carga.test';
DELETE FROM places WHERE external_id LIKE 'carga-%';
DELETE FROM zones WHERE name LIKE 'Zona carga %';
DELETE FROM universities WHERE name_key LIKE 'carga-%';

-- ── Usuarios ─────────────────────────────────────────────────────────────────────────────────────────────
-- Hash bcrypt (10 rondas) de «carga-prueba-123», el mismo que usa la aplicación.
INSERT INTO users (id, name, email, password_hash, role, country_of_origin, university_origin, career, bio, is_visible)
SELECT gen_random_uuid(),
       'Usuario Carga ' || n,
       'carga-' || n || '@carga.test',
       '$2b$10$f1UFrENJoYa/jo55mKLDKumJpgUCGO08L3zg0qCMkLNEU57Er9EBq',
       'user',
       (ARRAY['Alemania','Francia','México','Colombia','Brasil','España','Italia','Canadá','Japón','Perú'])[1 + n % 10],
       (ARRAY['Universidad de Heidelberg','Sciences Po','UNAM','Universidad de los Andes','USP'])[1 + n % 5],
       (ARRAY['Ingeniería','Derecho','Medicina','Arquitectura','Psicología','Economía'])[1 + n % 6],
       'Perfil generado para pruebas de carga ' || n,
       true
FROM generate_series(1, 300) AS n;

-- ── Arriendos (alrededor de Valparaíso) ─────────────────────────────────────────────────────────────────
INSERT INTO listings (id, author_id, type, name, address, latitude, longitude, description, price_clp, availability)
SELECT gen_random_uuid(),
       (SELECT id FROM users WHERE email = 'carga-' || (1 + n % 300) || '@carga.test'),
       'alojamiento',
       'Habitación carga ' || n,
       'Calle de prueba ' || n || ', Valparaíso',
       -33.04 + (random() - 0.5) * 0.06,
       -71.62 + (random() - 0.5) * 0.08,
       'Habitación de prueba con baño compartido, cerca del metro y de supermercados. Número ' || n,
       150000 + (random() * 350000)::int,
       (ARRAY['Disponible','Disponible','Desde marzo','Ocupado'])[1 + n % 4]
FROM generate_series(1, 200) AS n;

-- ── Zonas ───────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO zones (id, name, description, safe_hours, lat_center, lng_center, radius_m)
SELECT gen_random_uuid(),
       'Zona carga ' || n,
       'Zona de prueba ' || n,
       (ARRAY['24 h','07:00–22:00','08:00–20:00'])[1 + n % 3],
       -33.04 + (random() - 0.5) * 0.06,
       -71.62 + (random() - 0.5) * 0.08,
       400
FROM generate_series(1, 40) AS n;

-- ── Comercios y alojamientos (OpenStreetMap) ────────────────────────────────────────────────────────────
INSERT INTO places (id, source, external_id, category, name, address, latitude, longitude, opening_hours, content_hash, fetched_at)
SELECT gen_random_uuid(),
       'osm',
       'carga-' || n,
       (ARRAY['feria','supermercado','minimarket','panaderia','verduleria','farmacia','lavanderia','hotel','hostal','hospedaje'])[1 + n % 10],
       'Comercio carga ' || n,
       'Avenida de prueba ' || n,
       -33.04 + (random() - 0.5) * 0.08,
       -71.62 + (random() - 0.5) * 0.10,
       'Mo-Sa 09:00-20:00',
       md5(n::text),
       now()
FROM generate_series(1, 3000) AS n;

-- ── Universidades ───────────────────────────────────────────────────────────────────────────────────────
INSERT INTO universities (id, name, short_name, address, website, region, name_key, institution_type, category, ownership,
                          operating_status, is_vigente, latitude, longitude, founded_year)
SELECT gen_random_uuid(),
       'Universidad de Carga ' || n,
       'UC' || n,
       'Campus ' || n,
       'https://universidad-carga-' || n || '.example',
       (ARRAY['Valparaíso','Metropolitana','Biobío','Coquimbo','Los Lagos'])[1 + n % 5],
       'carga-universidad-' || n,
       'Universidad',
       'universidad',
       (ARRAY['estatal','particular_con_aportes','privada'])[1 + n % 3],
       'Vigente',
       true,
       -33.04 + (random() - 0.5) * 2,
       -71.62 + (random() - 0.5) * 2,
       1900 + n
FROM generate_series(1, 60) AS n;

-- ── Publicaciones, respuestas y "me gusta" ──────────────────────────────────────────────────────────────
INSERT INTO posts (id, author_id, category, title, body, likes_count, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM users WHERE email = 'carga-' || (1 + n % 300) || '@carga.test'),
       (ARRAY['arriendo','hangout','evento','info'])[1 + n % 4],
       'Publicación de prueba ' || n,
       'Contenido de la publicación de prueba número ' || n || '. ' || repeat('Texto de relleno para dar peso realista. ', 6),
       0,
       now() - (n || ' minutes')::interval
FROM generate_series(1, 2000) AS n;

CREATE TEMP TABLE carga_posts AS
  SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn FROM posts
  WHERE title LIKE 'Publicación de prueba %';

INSERT INTO post_replies (id, post_id, author_id, body, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM carga_posts WHERE rn = 1 + (n % 2000)),
       (SELECT id FROM users WHERE email = 'carga-' || (1 + (n * 7) % 300) || '@carga.test'),
       'Respuesta de prueba ' || n,
       now() - (n || ' seconds')::interval
FROM generate_series(1, 8000) AS n;

-- Cada publicación recibe "me gusta" de 0 a 4 personas distintas (la pareja post/usuario es única).
INSERT INTO post_likes (id, post_id, user_id)
SELECT gen_random_uuid(), p.id, u.id
FROM carga_posts p
JOIN LATERAL (
  SELECT id FROM users WHERE email LIKE '%@carga.test' ORDER BY md5(p.id::text || id::text) LIMIT (p.rn % 5)
) u ON true;

UPDATE posts SET likes_count = (SELECT count(*) FROM post_likes l WHERE l.post_id = posts.id)
WHERE title LIKE 'Publicación de prueba %';

-- ── Reseñas (arriendos, zonas y comercios) ──────────────────────────────────────────────────────────────
INSERT INTO reviews (id, author_id, target_type, target_id, rating, body)
SELECT gen_random_uuid(), u.id, 'listing', l.id, 1 + (abs(hashtext(l.id::text || u.id::text)) % 5),
       'Reseña de prueba de un arriendo.'
FROM listings l
JOIN LATERAL (
  SELECT id FROM users WHERE email LIKE '%@carga.test' ORDER BY md5('l' || l.id::text || id::text) LIMIT 6
) u ON true
WHERE l.name LIKE 'Habitación carga %';

INSERT INTO reviews (id, author_id, target_type, target_id, rating, body)
SELECT gen_random_uuid(), u.id, 'zone', z.id, 1 + (abs(hashtext(z.id::text || u.id::text)) % 5),
       'Reseña de prueba de una zona.'
FROM zones z
JOIN LATERAL (
  SELECT id FROM users WHERE email LIKE '%@carga.test' ORDER BY md5('z' || z.id::text || id::text) LIMIT 8
) u ON true
WHERE z.name LIKE 'Zona carga %';

INSERT INTO reviews (id, author_id, target_type, target_id, rating, body)
SELECT gen_random_uuid(), u.id, 'place', p.id, 1 + (abs(hashtext(p.id::text || u.id::text)) % 5),
       'Reseña de prueba de un comercio.'
FROM (SELECT id FROM places WHERE external_id LIKE 'carga-%' ORDER BY md5(id::text) LIMIT 300) p
JOIN LATERAL (
  SELECT id FROM users WHERE email LIKE '%@carga.test' ORDER BY md5('p' || p.id::text || id::text) LIMIT 4
) u ON true;

-- ── Amistades: cada persona queda con 10 amigos (su "vecino" 1…5 puestos adelante, y los 5 que la tienen a ella) ──
CREATE TEMP TABLE carga_users AS
  SELECT id, row_number() OVER (ORDER BY (regexp_replace(email, '\D', '', 'g'))::int) AS rn
  FROM users WHERE email LIKE '%@carga.test';

INSERT INTO friendships (id, requester_id, addressee_id, status)
SELECT gen_random_uuid(), a.id, b.id, 'accepted'
FROM carga_users a
CROSS JOIN generate_series(1, 5) AS k
JOIN carga_users b ON b.rn = 1 + ((a.rn - 1 + k) % 300);

-- ── Conversaciones y mensajes entre amigos cercanos (k = 1): 300 conversaciones × 30 mensajes ─────────
INSERT INTO conversations (id, user_a_id, user_b_id, last_message_at)
SELECT gen_random_uuid(), LEAST(a.id, b.id), GREATEST(a.id, b.id), now()
FROM carga_users a
JOIN carga_users b ON b.rn = 1 + (a.rn % 300);

INSERT INTO messages (id, conversation_id, sender_id, body, created_at)
SELECT gen_random_uuid(), c.id, CASE WHEN m % 2 = 0 THEN c.user_a_id ELSE c.user_b_id END,
       'Mensaje de prueba ' || m, now() - (m || ' minutes')::interval
FROM conversations c
JOIN carga_users ua ON ua.id = c.user_a_id
CROSS JOIN generate_series(1, 30) AS m;

-- ── Notificaciones: 20 por persona ──────────────────────────────────────────────────────────────────────
INSERT INTO notifications (id, user_id, actor_id, type, post_id, preview, created_at)
SELECT gen_random_uuid(), u.id, a.id,
       (ARRAY['friend_request','friend_accepted','post_like','post_reply'])[1 + n % 4],
       NULL, 'Aviso de prueba ' || n, now() - (n || ' minutes')::interval
FROM carga_users u
CROSS JOIN generate_series(1, 20) AS n
JOIN carga_users a ON a.rn = 1 + ((u.rn + n) % 300);

COMMIT;

ANALYZE;

SELECT 'usuarios' AS tabla, count(*) FROM users WHERE email LIKE '%@carga.test'
UNION ALL SELECT 'arriendos', count(*) FROM listings WHERE name LIKE 'Habitación carga %'
UNION ALL SELECT 'zonas', count(*) FROM zones WHERE name LIKE 'Zona carga %'
UNION ALL SELECT 'comercios', count(*) FROM places WHERE external_id LIKE 'carga-%'
UNION ALL SELECT 'universidades', count(*) FROM universities WHERE name_key LIKE 'carga-%'
UNION ALL SELECT 'publicaciones', count(*) FROM posts WHERE title LIKE 'Publicación de prueba %'
UNION ALL SELECT 'respuestas', count(*) FROM post_replies WHERE body LIKE 'Respuesta de prueba %'
UNION ALL SELECT 'reseñas', count(*) FROM reviews WHERE body LIKE 'Reseña de prueba %'
UNION ALL SELECT 'amistades', count(*) FROM friendships f JOIN users u ON u.id = f.requester_id WHERE u.email LIKE '%@carga.test'
UNION ALL SELECT 'mensajes', count(*) FROM messages WHERE body LIKE 'Mensaje de prueba %'
UNION ALL SELECT 'notificaciones', count(*) FROM notifications WHERE preview LIKE 'Aviso de prueba %';
