# Evidencia de pruebas


## 1. Resumen

| Suite | Herramienta | Resultado |
|---|---|---|
| Servicio Python (pipeline de datos, API, observabilidad) | pytest | **98 pasaron** |
| Backend, unitarias | Vitest | **49 pasaron** (7 archivos) |
| Backend, e2e con base de datos simulada | Vitest + Supertest | **29 pasaron** (2 archivos) |
| Backend, integración con PostgreSQL real | Vitest | **50 pasaron** (2 archivos) |
| Frontend | Vitest + Testing Library | **71 pasaron** (8 archivos) |
| Lint de Python (con reglas de seguridad) | ruff | sin avisos; formato correcto |
| Lint de TypeScript y JavaScript | oxlint, ESLint | sin avisos |
| Dependencias de producción | npm audit, pip-audit | **0 vulnerabilidades** (backend, frontend y Python) |

## 2. Qué cubre cada suite

**Servicio Python (98)**

| Archivo | Pruebas | Qué verifica |
|---|---|---|
| `test_catalog.py` | 11 | Lectura del Excel real del Ministerio, validación, filas rechazadas y duplicados |
| `test_wikidata.py` | 11 | Lectura de la respuesta SPARQL, valores inválidos y casos límite |
| `test_matching.py` | 6 | Cruce entre catálogo y Wikidata: exacto, por prefijo y aproximado; nunca ante ambigüedad |
| `test_text.py` | 5 | Normalización de nombres |
| `test_http.py` | 7 | Reintentos, esperas, límite de tamaño y errores 4xx sin reintento |
| `test_robots.py` | 9 | Interpretación de `robots.txt` según RFC 9309 |
| `test_runner.py` | 21 | Orquestación: fuentes caídas, página de mantención, archivo local, estados `succeeded`, `partial` y `failed` |
| `test_api.py` | 6 | Contrato de la API del pipeline |
| `test_main.py` | 7 | Formato de errores, 500 genérico, documentación OpenAPI versionada al día |
| `test_observability.py` | 13 | `X-Request-Id`, registros JSON, errores de fuente registrados |
| `test_scripts.py` | 2 | Scripts de apoyo y fixture del contrato con NestJS |

**Backend**

- *Unitarias (49):* motor de búsqueda BM25, métricas de evaluación, cliente del servicio Python
  (tiempos de espera, 502, 503 y 504, reenvío del identificador), registros JSON, métricas HTTP y la
  evaluación de la búsqueda con 29 consultas etiquetadas (`test/eval`).
- *e2e (29):* registro, login, rutas protegidas, salud, identificador de correlación y métricas HTTP,
  documentación OpenAPI.
- *Integración (50):* ingesta completa contra PostgreSQL real, idempotencia, desactivación de
  instituciones, conservación de datos si las fuentes fallan, búsqueda, `resolve`, permisos de
  administrador, y la parte social (amistades, publicaciones).

**Frontend (71):** utilidades, hooks y la página de Universidades (búsqueda, filtros, errores y reintento).

## 3. Evaluación de la recuperación de información

Resultado de las 29 consultas etiquetadas sobre las 128 instituciones del catálogo (detalle y criterio
de relevancia en `docs/evaluacion.md`):

| Configuración | nP@5 | nP@10 | R@10 | MRR | R-Prec |
|---|---|---|---|---|---|
| Sin siglas curadas | 0.79 | 0.79 | 0.69 | 0.83 | 0.79 |
| **Con siglas curadas (final)** | **0.97** | **0.97** | **0.87** | **1.00** | **0.97** |

Las consultas «semánticas» (por ejemplo, instituciones de una ciudad) alcanzan R-Prec 0.50: el catálogo
solo trae nombre y tipo. Es un límite conocido de los datos, no un fallo de la búsqueda.

## 4. Cómo reproducirlo

```bash
# Servicio Python
cd pythonservice && pip install -r requirements-dev.txt
ruff check . && ruff format --check . && pytest -q
pip-audit -r requirements.txt

# Backend (las de integración necesitan PostgreSQL y DATABASE_URL)
cd backend && npm ci && npx prisma generate
npm run lint && npm run build && npm test && npm run test:e2e
npx prisma migrate deploy && npm run test:integration
npm audit --omit=dev --audit-level=high

# Frontend
cd frontend && npm ci && npm run lint && npm test && npm run build
```

## 5. Verificación manual de punta a punta

Servicios reales (NestJS, FastAPI y PostgreSQL) levantados en local, con las fuentes públicas
inaccesibles desde ese entorno y el Excel del Ministerio como archivo local:

| Comprobación | Resultado |
|---|---|
| Primera ingesta | 128 instituciones creadas; estado `partial` (Wikidata no disponible) |
| Segunda ingesta | 0 creadas: no se duplica nada |
| Consulta desde NestJS | 128 instituciones consultables; 55 universidades |
| Correlación | El mismo `X-Request-Id` aparece en los registros de NestJS y de FastAPI |
| Errores de la fuente externa | Registrados como `source_problem`, con la causa |
| Pruebas posteriores al despliegue (`post-deploy-check.sh`) | 13 comprobaciones correctas; con fallos forzados (CORS, backend caído) el script termina con error |
| Prueba de integración de CI | Los pasos del job `compose-smoke` se ejecutaron contra los servicios reales y pasaron |


