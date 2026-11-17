# Mapa de Inicio

Mapa interactivo (Leaflet + OpenStreetMap) con tres capas: **alojamientos**, **comercios y servicios** y
**zonas** valoradas por los estudiantes. La lista lateral y el mapa están sincronizados.

## De dónde sale cada dato
| Capa | Fuente | Tabla |
| --- | --- | --- |
| Mapa base | Mosaicos de OpenStreetMap (`NEXT_PUBLIC_TILE_URL`) | — |
| Comercios y servicios | OpenStreetMap vía Overpass, importados por el servicio Python | `places` |
| Hoteles, hostales y hospedajes | OpenStreetMap vía Overpass (misma importación que los comercios) | `places` |
| Universidades e institutos | Catálogo de la sección Universidades (Mineduc + coordenadas de Wikidata) | `universities` |
| Piezas y departamentos | Publicados por administradores (más 4 de ejemplo de la migración, sin autor) | `listings` |
| Zonas | Datos de ejemplo de la migración | `zones` |

Los datos de ejemplo tienen coordenadas aproximadas y ids fijos; se pueden editar o borrar desde la base
de datos sin que reaparezcan.

## Flujo de la importación de comercios
`POST /map/places/refresh` (solo administradores) → NestJS llama a `POST /v1/pipeline/places/run` del servicio
Python → una consulta a Overpass → Python valida y normaliza (descarta lo que no tenga nombre, categoría o
punto) → NestJS guarda con *upsert* por `(source, external_id)` y elimina lo que ya no existe en OSM.
Si la respuesta trae menos de la mitad de lo que ya había, no se borra nada (`pruneSkipped`). Si un servidor de Overpass
falla (es común que el principal devuelva 429/502/504 cuando está saturado), se prueba el siguiente de
`OVERPASS_ENDPOINT` (lista separada por comas). Cada servidor tiene un intento con hasta 50 s de espera (`OVERPASS_READ_TIMEOUT`) y la consulta usa filtros
exactos por categoría, que Overpass resuelve mucho más rápido que una expresión regular. NestJS espera hasta
150 s por esta llamada (`PYTHON_PLACES_TIMEOUT_MS`). Si fallan todos, responde 502 y los datos quedan intactos.

```bash
# Con un usuario administrador (el rol se asigna en la base de datos)
curl -X POST http://localhost:8000/map/places/refresh -H "Authorization: Bearer <token>"
```
Categorías de comercio: `feria`, `supermercado`, `minimarket`, `panaderia`, `verduleria`, `farmacia`, `lavanderia`.
Categorías de alojamiento: `hotel` (`tourism=hotel`), `hostal` (`tourism=hostel`) y `hospedaje`
(`tourism=guest_house` y `tourism=apartment`). Son alojamiento turístico, útil para los primeros días: OpenStreetMap
no tiene arriendos mensuales ni precios. En la pestaña **Alojamiento** aparecen junto a las piezas y departamentos
publicados, con filtros (Todos, Piezas y deptos, Hotel, Hostal, Hospedaje); **Comercios** nunca los muestra.
Se pueden reseñar igual que un comercio (`/map/places/:id/reviews`).

Tras actualizar, un administrador debe volver a ejecutar `POST /map/places/refresh` para traer los alojamientos.
La zona por defecto es Valparaíso–Viña del Mar (`pythonservice/pipeline/osm.py`, `DEFAULT_BBOX`).

## API (documentada en `/docs`)
- `GET /map/listings`, `GET /map/zones`, `GET /map/universities` (vigentes y con coordenadas)
- `GET /map/places?category=feria,farmacia&bbox=oeste,sur,este,norte&limit=300` → `{ items, total, truncated }`

- `GET /map/places/:id/reviews?cursor=&limit=20` → `{ summary: { count, average, distribution }, mine, items, nextCursor }`
- `PUT /map/places/:id/reviews` con `{ rating: 1-5, body?: texto de hasta 1000 }` → `{ review, summary }`
- `GET` y `PUT /map/listings/:id/reviews`: lo mismo para alojamientos
- `DELETE /map/reviews/:id` (la autora o un administrador; sirve para ambos tipos)

Cada comercio de `GET /map/places` y cada alojamiento de `GET /map/listings` incluye `ratingAverage` y `ratingCount`.

El frontend pide los comercios solo de la zona visible (con un pequeño retardo al mover el mapa) y no los pide
si el zoom es menor a 13.

## Cómo llegar
El botón del globo del mapa abre la **app de mapas del dispositivo** con el destino ya puesto y la ruta desde la
ubicación actual de la persona (`directionsUrl` en `lib/map.js`): Apple Maps en iPhone y iPad, y un enlace de Google
Maps en el resto. En Android, y dentro de la app Capacitor, ese enlace abre Google Maps si está instalada; en un
computador abre la web. No hay navegación propia: la ruta, el tráfico y el transporte público los resuelve la app
de mapas. Para dibujar rutas dentro de ExchangeHub haría falta un servicio de rutas con clave y cuotas.

## Arriendos publicados por administradores
Los arriendos (piezas, departamentos, pensiones) solo los puede publicar, editar y eliminar un **administrador**
(`users.role = 'admin'`); el resto de las personas los ve y los reseña.
- **Desde la app:** en Inicio → Alojamiento, un administrador ve **＋ Agregar arriendo** y, en cada arriendo,
  **Editar** y **Eliminar**. El formulario pide nombre, dirección, precio mensual, disponibilidad y descripción;
  la ubicación se elige tocando el mapa ("📍 Elegir en el mapa") o escribiendo latitud y longitud.
- **API:** `POST /map/listings`, `PATCH /map/listings/:id` y `DELETE /map/listings/:id`, todas con `AdminGuard`
  (403 para quien no sea administrador). El rol se lee de la base en cada llamada, no del token: quitarlo surte
  efecto de inmediato. Cada arriendo guarda quién lo publicó (`listings.author_id`).
- Eliminar un arriendo elimina también sus reseñas. Los hoteles y hospedajes de OpenStreetMap no se editan aquí.
- Los botones solo se muestran a administradores, pero la protección real está en el servidor.

### Cómo hacer administrador a un usuario
No hay pantalla para esto a propósito (evita que alguien se otorgue el rol). Con acceso a la base:
```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "UPDATE users SET role = '"'"'admin'"'"' WHERE email = '"'"'correo@ejemplo.cl'"'"';"'
```
Para quitarlo, la misma instrucción con `role = 'user'`. La persona debe volver a abrir la app para ver los botones.

## Universidades en el mapa
La pestaña **🎓 Universidades** de Inicio muestra las instituciones vigentes que tienen coordenadas (filtros:
Universidades, Institutos y CFT). Desde la sección Universidades, el enlace **"Ver en el mapa"** abre
`/inicio?universidad=<id>`: se activa esa pestaña, el mapa vuela a la institución y abre su globo. Va por
*query string* para que también funcione en la app Android (exportación estática). Solo aparecen las
instituciones que Wikidata pudo ubicar; las demás siguen en la lista de Universidades, sin enlace al mapa.

## Reseñas de comercios y alojamientos
Se abren desde la tarjeta del comercio o alojamiento o desde su globo en el mapa ("Ver reseñas" / "Reseñar"). Muestran el
promedio, la distribución por estrellas y las opiniones de otros estudiantes (con enlace a su perfil).
- Se reutiliza la tabla `reviews` (`target_type = 'place'` o `'listing'`; la migración amplía su `CHECK`, que antes solo
  admitía `listing` y `zone`, y agrega `updated_at`).
- **Una reseña por persona y comercio**: volver a enviarla la edita (aparece "editada"). El texto es opcional.
- Quien tiene el perfil oculto (`isVisible = false`) aparece como "Estudiante", sin enlace ni país.
- La referencia es polimórfica (sin clave foránea), así que la actualización desde OpenStreetMap **no elimina
  comercios que tienen reseñas**, aunque ya no existan en OSM.
- Moderación: un administrador puede borrar cualquier reseña con `DELETE /map/reviews/:id`.

## Zonas valoradas por estudiantes

- Cada zona es un círculo de **400 m** de radio (`ZONE_RADIUS_M`, restricción `zones_radius_fixed` en la base): todas miden
  lo mismo y el color depende solo de las reseñas.
- **Color por estrellas:** sin reseñas, gris; con reseñas va de **rojo (1★) a amarillo (3★) a verde (5★)** con grados
  intermedios (`zoneColorFor` en `frontend/lib/map.js`). La etiqueta de la tarjeta es «Bien valorada» (≥ 3,5),
  «Valoración regular» (≥ 2,5) o «Mal valorada».
- Reseñas: `GET`/`PUT /map/zones/:id/reviews`, con las mismas reglas que comercios y alojamientos (una por persona,
  1–5 estrellas, texto opcional). Al publicar o borrar una reseña el círculo cambia de color al instante.
- Administración (solo administradores): `POST /map/zones`, `PATCH /map/zones/:id`, `DELETE /map/zones/:id` (borra también
  sus reseñas). El formulario pide nombre, descripción, horario recomendado y el centro (en el mapa o con coordenadas);
  el área no se elige. En el mapa se previsualiza el círculo al elegir el centro.
- La migración `20261117000000_zone_reviews` elimina `zones.safety_level` (ya no se usa) y fija el radio de las zonas de ejemplo en 400 m.

## Seguridad
Los nombres de OpenStreetMap no son de confianza: los globos del mapa se arman con el DOM (`textContent`), nunca
con HTML en texto, y solo se enlazan sitios `http(s)`. Las URL de Overpass vienen de la configuración del
servicio, no de la petición.

## Android
Se agregaron los permisos de ubicación aproximada y precisa para el botón "Mi ubicación". Tras actualizar,
ejecuta `npm run mobile:sync:dev` y vuelve a lanzar la app.

## Pruebas
- Python: `tests/test_places.py` (parseo, categorías, validación de zona, fallos de la fuente, endpoint).
- Backend: `test/map.int-spec.ts` (PostgreSQL real: datos de ejemplo, filtros, alta/actualización/baja,
  respuesta parcial, fallos y permisos; reseñas: crear, editar, una por persona, promedio, paginación,
  validación, perfil oculto, borrado propio/ajeno/administrador y protección frente a la importación).
- Universidades: `test/map.int-spec.ts` (solo vigentes y con coordenadas) y `components/InicioPage.test.jsx` (pestaña,
  filtros y llegada con `?universidad=`).
- Frontend: `lib/map.test.js`, `components/InicioPage.test.jsx` y `components/inicio/ReviewsModal.test.jsx`.
- Verificación real en navegador, de punta a punta (Overpass simulado → Python → NestJS → BD → mapa) en
  escritorio y móvil: pines, globos, filtros por categoría, zonas, selección desde la lista y sin desborde.
  Los mosaicos se simularon porque el entorno de pruebas no llega a OpenStreetMap.
