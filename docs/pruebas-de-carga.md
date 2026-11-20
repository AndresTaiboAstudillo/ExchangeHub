# Pruebas de carga de la API REST

**Requisito:** la API REST debe responder en menos de **500 ms en el percentil 95** bajo carga normal
(hasta **100 usuarios concurrentes**).

Se verifica con [k6](https://k6.io) (`loadtest/api.js`) sobre una base separada con datos de prueba
(`loadtest/seed.sql`). Las pruebas funcionales (vitest) comprueban que la API *funciona*; esta mide *qué tan rápido*
responde con muchas personas a la vez.

## Qué simula cada usuario virtual
- Inicia sesión **una vez** (el login usa bcrypt, lento a propósito, y se mide aparte) y reutiliza su token.
- Navega como una persona: una acción, pausa de **1 a 3 s**, otra acción…
- Mezcla de uso (lectura sobre todo): mapa y comercios 25 %, comunidad 20 %, universidades 15 %, reseñas 10 %,
  personas/amigos/chat 10 %, perfil y avisos 8 %, y escrituras (publicar 4 %, responder 3 %, «me gusta» 3 %,
  reseñar 2 %).
- Cada endpoint se mide por separado y todos deben cumplir `p(95) < 500 ms`, además del conjunto.

El chat en tiempo real (Socket.IO) **no** forma parte de esta prueba; sí se miden sus rutas REST
(`GET /chat/conversations`).

## Datos de prueba (`loadtest/seed.sql`)
300 usuarios (`carga-1@carga.test` … `carga-300@carga.test`, clave `carga-prueba-123`), 200 arriendos, 40 zonas,
3.000 comercios, 60 universidades, 2.000 publicaciones con 8.000 respuestas y «me gusta», ~2.700 reseñas,
1.500 amistades, 300 conversaciones con 9.000 mensajes y 6.000 notificaciones. Con una base vacía todo responde
rápido y la prueba no demuestra nada, por eso el volumen importa.

El script se niega a ejecutarse en una base cuyo nombre no contenga `carga`, y se puede repetir (borra antes lo que
creó). La API de la prueba se levanta con `loadtest/docker-compose.carga.yml`, que apunta el backend a la base
`exchange_carga` y desactiva el límite de intentos (`RATE_LIMIT_DISABLED=true`).

## Pasos
1. **Instalar k6** (una vez). Windows: `winget install k6 --source winget` (o el instalador `.msi` de k6.io).
   macOS: `brew install k6`. Comprueba con `k6 version`.
2. **Crear la base de prueba.** Con el proyecto levantado (`docker compose up -d`), reemplaza `USUARIO` por tu
   `POSTGRES_USER`:
   ```
   docker compose exec postgres psql -U USUARIO -d postgres -c "CREATE DATABASE exchange_carga"
   ```
3. **Reiniciar el backend apuntando a esa base** (aplica las migraciones solo):
   ```
   docker compose -f docker-compose.yml -f loadtest/docker-compose.carga.yml up -d --build backend
   ```
4. **Cargar los datos:**
   ```
   docker compose cp loadtest/seed.sql postgres:/tmp/seed.sql
   docker compose exec postgres psql -U USUARIO -d exchange_carga -f /tmp/seed.sql
   ```
   Al final muestra el conteo de cada tabla.
5. **Prueba de humo** (30 s, 5 usuarios) para confirmar que todo está bien:
   ```
   k6 run -e PERFIL=humo loadtest/api.js
   ```
6. **Carga normal** (1 min de subida, 5 min sostenidos con 100 usuarios, 30 s de bajada):
   ```
   k6 run --summary-export=loadtest/resultados/normal.json loadtest/api.js
   ```
7. **Estrés** (opcional; escalones de 50 a 400 usuarios, para ver dónde deja de cumplirse):
   ```
   k6 run -e PERFIL=estres --summary-export=loadtest/resultados/estres.json loadtest/api.js
   ```
8. **Volver al uso normal:** `docker compose up -d --build backend` (sin el archivo `carga`).

Parámetros: `-e VUS=50`, `-e SOSTENER=2m`, `-e SUBIDA=30s`, `-e BASE_URL=http://localhost:8000`.

## Cómo leer el resultado
- Al final, k6 marca cada umbral con ✓ o ✗. **La prueba cumple el requisito si**
  `http_req_duration{kind:api}` muestra ✓ en `p(95)<500` y `http_req_failed{kind:api}` en `rate<0.01`.
- `kind:api` es toda la API **sin** el inicio de sesión; `kind:login` es el login (bcrypt), con un umbral aparte de 2 s.
- Las líneas `{ name:GET /… }` dan el p95 por endpoint: el más alto es el cuello de botella.
- `http_req_failed` es la tasa de errores (cualquier respuesta que no sea 2xx).
- `vus_max` confirma cuántos usuarios simultáneos hubo.
