# Observabilidad inicial

## Registros estructurados

NestJS y FastAPI escriben **una línea JSON por evento** en la salida estándar (la recoge
`docker compose logs`). Campos comunes: `time` (UTC), `level`, `context`, `requestId` y `message`,
más los campos propios de cada evento. El nivel mínimo se configura con `LOG_LEVEL`
(`debug`, `info`, `warn`, `error`; por defecto `info`).

| Evento (`message`) | Quién | Campos principales |
|---|---|---|
| `http_request` | NestJS y FastAPI | `method`, `route` (plantilla, p. ej. `/universities/:id`), `path`, `status`, `duration_ms` |
| `python_call` | NestJS | `method`, `path`, `status`, `duration_ms` de la llamada a Python |
| `source_ok` / `source_problem` | FastAPI | `source`, `source_status`, `elapsed_ms`, `records_received`, `error`, `notes` |
| `source_problem` | NestJS | `runId`, `source`, `status`, `error`, `elapsed_ms` |
| `pipeline_finished` | FastAPI | `pipeline_status`, `universities`, `rejected`, `elapsed_ms` |
| `ingestion_finished` | NestJS | `runId`, `status`, `created`, `updated`, `unchanged`, `deactivated` |

Nivel según el estado HTTP: 5xx → `error`, 4xx → `warn`, el resto → `info`. Las comprobaciones de
`/health` se registran solo en `debug`, porque Docker las hace cada pocos segundos.

**Privacidad:** no se registran cuerpos de petición, cabeceras de autorización ni la query string.
La ruta registrada es la plantilla, no la URL con valores.

## Identificador de correlación

1. NestJS toma `X-Request-Id` de la petición si cumple `^[A-Za-z0-9._-]{8,64}$`; si falta o no es
   válido (por ejemplo, con saltos de línea que falsificarían registros) genera un UUID.
2. Lo devuelve en la cabecera `X-Request-Id` de la respuesta.
3. Lo reenvía a FastAPI en cada llamada. FastAPI aplica la misma regla y también lo devuelve.
4. Las ingestas programadas, que no vienen de una petición, generan uno propio por ejecución.

Para seguir una petición de punta a punta:

```
docker compose logs backend python-service | grep <X-Request-Id>
```

## Salud

| Endpoint | Qué comprueba |
|---|---|
| `GET /health` (NestJS) | El proceso está vivo. Lo usa el healthcheck de Docker. |
| `GET /health/ready` (NestJS) | PostgreSQL (`SELECT 1`) y el servicio Python; responde 503 si alguno cae. |
| `GET /health` (FastAPI) | El proceso está vivo. |

## Métrica de tiempo de respuesta

`GET /metrics/http` (solo administradores) devuelve, por método y ruta, desde que arrancó el
proceso: `count`, `errors4xx`, `errors5xx`, `avg_ms`, `p50_ms`, `p95_ms` y `max_ms`. Los percentiles
se calculan sobre las últimas 200 muestras de cada ruta. Las rutas inexistentes se agrupan como
`no-encontrada` y hay un tope de 200 rutas para que la métrica no crezca sin límite.


