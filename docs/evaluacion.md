# Evaluación

Cubre el requisito 7. Hay dos tipos de medición: la **calidad de la búsqueda** (se mide con consultas
etiquetadas, sin base de datos) y la **calidad de los datos y de la recuperación** (se mide en vivo con
`GET /universities/metrics`).

## 1. Qué se mide y dónde

| Métrica pedida | Cómo se calcula | Dónde se ve |
|---|---|---|
| Precision@K y Recall@K | Sobre 29 consultas etiquetadas a mano (ver sección 2) | `test/eval/search-quality.spec.ts` |
| % de registros válidos | Filas válidas / filas recibidas del catálogo | `quality.pct_valid`; `lastGoodRun.pctValid` |
| % de duplicados | Filas descartadas por repetidas / filas recibidas; además, duplicados que quedan en la base | `lastGoodRun.pctDuplicates`; `database.duplicatesInDatabase` |
| Cobertura de las fuentes | Universidades cruzadas con Wikidata, con sitio web y con coordenadas, sobre el total de universidades | `matchRate`, `coverageWebsite`, `coverageCoordinates` |
| Tiempo de recuperación | Milisegundos por fuente (promedio y máximo de las últimas ejecuciones); tiempo de consulta del buscador | `retrievalMs`; sección 2 |
| Tasa de error | Ejecuciones `failed` / ejecuciones (últimas 20) | `ingestion.errorRate` |
| Actualidad de los datos | Días desde la última recuperación de cada fuente y si superó el umbral (14 días) | `freshness[]` |

## 2. Calidad de la búsqueda

Cómo reproducirlo (no necesita base de datos):

```bash
cd backend
npx vitest run test/eval                                   # verifica etiquetas y umbrales mínimos
EVAL_REPORT_PATH=informe.md npx vitest run test/eval       # además escribe el informe completo
```

### Cómo se etiquetó

Las relevancias están en `backend/test/eval/relevance.json`, hechas a mano sobre el catálogo de mayo de 2026.
Para que no dependan de mi opinión, **la prueba verifica las etiquetas contra los datos**: las consultas por nombre
deben coincidir con «el nombre contiene el término», y las de tipo con la categoría publicada por el Ministerio.

### Cómo leer las métricas

- **P@K** está acotada: con 2 relevantes, P@5 no puede pasar de 0,4. Por eso se reporta también **nP@K**
  (P@K dividida por ese máximo), que sí vale 1 para un resultado perfecto.
- **R@K** con muchos relevantes (por ejemplo, 43 CFT) tampoco puede llegar a 1 con K=10; se reporta igual por
  ser la métrica pedida.
- **R-Prec** (precisión en la posición R, con R = número de relevantes) no depende de K.
- **MRR** mide qué tan arriba aparece el primer resultado correcto.

### Resultados

Con las siglas curadas, sobre el conjunto completo: nP@5 = 0.97, nP@10 = 0.97, R@10 = 0.87,
MRR = 1.00 y R-Prec = 0.97. Sin las siglas curadas, MRR baja a 0.83: las consultas como
«usach» o «puc» no encuentran la institución correcta, porque esas siglas no están en los nombres oficiales.

Corpus: 128 instituciones del catálogo (edición 2026-05). Consultas: 29.

Criterio de relevancia: Etiquetado a mano sobre el catálogo del Mineduc (mayo 2026). Consultas de nombre: es relevante toda institución cuyo nombre contiene el término (cualquier tipo). Consultas de tipo: toda institución de ese tipo. Consultas de sigla: la institución a la que la sigla se refiere. Una consulta 'navegacional' (nombre completo) tiene un solo relevante. Consultas 'semantica': relevante es toda institución con sede en el lugar (conocimiento externo, no derivable del catálogo, que solo trae nombre y tipo); miden un límite conocido, no un fallo.

P@K = relevantes entre los K primeros / K (acotada por min(1, relevantes/K)); nP@K = P@K dividida por ese máximo alcanzable; R@K = relevantes entre los K primeros / total de relevantes; MRR = media de 1/posición del primer relevante; R-Prec = precisión en la posición R (R = número de relevantes).

### Resultados globales

| Grupo | Consultas | P@5 | nP@5 | R@5 | P@10 | nP@10 | R@10 | MRR | R-Prec |
|---|---|---|---|---|---|---|---|---|---|
| Sin siglas curadas | 29 | 0.48 | 0.79 | 0.63 | 0.35 | 0.79 | 0.69 | 0.83 | 0.79 |
| **Con siglas curadas (final)** | 29 | 0.52 | 0.97 | 0.80 | 0.37 | 0.97 | 0.87 | 1.00 | 0.97 |

### Por tipo de consulta (configuración final)

| Grupo | Consultas | P@5 | nP@5 | R@5 | P@10 | nP@10 | R@10 | MRR | R-Prec |
|---|---|---|---|---|---|---|---|---|---|
| navegacional | 4 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| nombre | 11 | 0.56 | 1.00 | 0.97 | 0.31 | 1.00 | 1.00 | 1.00 | 1.00 |
| mixta | 1 | 0.40 | 1.00 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | 1.00 |
| tipo | 6 | 1.00 | 1.00 | 0.27 | 0.98 | 1.00 | 0.52 | 1.00 | 1.00 |
| sigla | 5 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| semantica | 2 | 0.30 | 0.50 | 0.50 | 0.15 | 0.50 | 0.50 | 1.00 | 0.50 |

### Detalle por consulta (configuración final)

| Consulta | Tipo | Relevantes | P@5 | nP@5 | R@5 | P@10 | nP@10 | R@10 | RR | R-Prec |
|---|---|---|---|---|---|---|---|---|---|---|
| universidad católica | nombre | 8 | 1.00 | 1.00 | 0.63 | 0.80 | 1.00 | 1.00 | 1.00 | 1.00 |
| universidad estatal | tipo | 18 | 1.00 | 1.00 | 0.28 | 1.00 | 1.00 | 0.56 | 1.00 | 1.00 |
| universidad particular con aportes | tipo | 9 | 1.00 | 1.00 | 0.56 | 0.90 | 1.00 | 1.00 | 1.00 | 1.00 |
| universidad privada | tipo | 28 | 1.00 | 1.00 | 0.18 | 1.00 | 1.00 | 0.36 | 1.00 | 1.00 |
| instituto profesional | tipo | 30 | 1.00 | 1.00 | 0.17 | 1.00 | 1.00 | 0.33 | 1.00 | 1.00 |
| centro de formación técnica | tipo | 43 | 1.00 | 1.00 | 0.12 | 1.00 | 1.00 | 0.23 | 1.00 | 1.00 |
| cft estatal | tipo | 15 | 1.00 | 1.00 | 0.33 | 1.00 | 1.00 | 0.67 | 1.00 | 1.00 |
| valparaíso | nombre | 4 | 0.80 | 1.00 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | 1.00 |
| santo tomás | nombre | 3 | 0.60 | 1.00 | 1.00 | 0.30 | 1.00 | 1.00 | 1.00 | 1.00 |
| inacap | nombre | 3 | 0.60 | 1.00 | 1.00 | 0.30 | 1.00 | 1.00 | 1.00 | 1.00 |
| duoc | nombre | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| los lagos | nombre | 4 | 0.80 | 1.00 | 1.00 | 0.40 | 1.00 | 1.00 | 1.00 | 1.00 |
| san sebastián | nombre | 2 | 0.40 | 1.00 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | 1.00 |
| diego portales | nombre | 2 | 0.40 | 1.00 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | 1.00 |
| universidad de concepción | navegacional | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| universidad de chile | navegacional | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| arturo prat | navegacional | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| adolfo ibáñez | navegacional | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| bío bío | nombre | 2 | 0.40 | 1.00 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | 1.00 |
| instituto profesional santiago | mixta | 2 | 0.40 | 1.00 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | 1.00 |
| universidad tecnológica | nombre | 2 | 0.40 | 1.00 | 1.00 | 0.20 | 1.00 | 1.00 | 1.00 | 1.00 |
| pontificia | nombre | 3 | 0.60 | 1.00 | 1.00 | 0.30 | 1.00 | 1.00 | 1.00 | 1.00 |
| usach | sigla | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| utem | sigla | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| usm | sigla | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| puc | sigla | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| udp | sigla | 1 | 0.20 | 1.00 | 1.00 | 0.10 | 1.00 | 1.00 | 1.00 | 1.00 |
| universidad en valparaíso | semantica | 4 | 0.40 | 0.50 | 0.50 | 0.20 | 0.50 | 0.50 | 1.00 | 0.50 |
| universidad en temuco | semantica | 2 | 0.20 | 0.50 | 0.50 | 0.10 | 0.50 | 0.50 | 1.00 | 0.50 |

### Tiempos

Construcción del índice: 7.2 ms. Consulta: promedio 0.075 ms, máximo 0.242 ms.

### Cómo interpretar estos números (limitaciones)

- **El resultado casi perfecto es parcialmente esperable.** Las consultas por nombre se etiquetan con «el nombre
  contiene el término», justo lo que un índice por nombre resuelve. Sirve para detectar regresiones y comparar
  configuraciones (por ejemplo, el efecto de las siglas), no como prueba de que el buscador sea excelente.
- **Las consultas «semantica» muestran el límite real:** MRR 1.00 pero R-Prec 0.50. Encuentra lo que dice el
  lugar en el nombre y no el resto, porque el catálogo no trae ubicación.
- **Las siglas curadas se etiquetaron con la misma mano que las escribió.** Las consultas de sigla comprueban que
  la tabla funcione, no que cubra las siglas que la gente usa.
- **El conjunto es pequeño** (una persona, un catálogo de 128 filas) y las consultas no vienen de usuarios reales.
- Se evalúa solo el catálogo oficial: las filas de Wikidata del fixture son en parte sintéticas.

## 3. Calidad de los datos y de la recuperación

`GET /universities/metrics` (requiere sesión) calcula todo en vivo desde las ejecuciones guardadas:

```json
{
  "window": { "runs": 4, "size": 20 },
  "ingestion": { "succeeded": 2, "partial": 0, "failed": 2, "errorRate": 0.5 },
  "retrievalMs": { "mineduc_ies": { "samples": 2, "avg": 38, "max": 42 }, "wikidata": { "samples": 2, "avg": 4, "max": 4 } },
  "lastGoodRun": { "catalogRows": 128, "pctValid": 1, "rejected": 0, "duplicatesDiscarded": 0, "pctDuplicates": 0,
                   "matchRate": 0.1091, "coverageWebsite": 0.1091, "coverageCoordinates": 0.0727 },
  "database": { "total": 128, "active": 128, "duplicatesInDatabase": 0 },
  "freshness": [ { "source": "mineduc_ies", "ageDays": 0, "stale": false } ]
}
```

> **Importante:** este ejemplo se obtuvo con fuentes **locales de prueba** (los archivos de ejemplo servidos desde mi
> equipo) y con dos fallas provocadas a propósito. Los tiempos y la cobertura de Wikidata **no son los reales**.

### Lo que sí es real y lo que falta medir

| Métrica | Valor | Base |
|---|---|---|
| Registros válidos del catálogo | **128 de 128 (100 %)** | Excel real de mayo de 2026 |
| Duplicados en el catálogo | **0 (0 %)** | Excel real |
| Duplicados en la base | **0**, garantizado por restricciones `UNIQUE` | Esquema |
| Universidades en el catálogo | 55 | Excel real |
| Cobertura de Wikidata (cruce, sitio web, coordenadas) | **Sin medir** | Hay que ejecutarlo con la red real |
| Tiempo de recuperación por fuente | **Sin medir** | Ídem |
| Tasa de error en operación | **Sin medir** | Requiere ejecuciones reales a lo largo del tiempo |

Para completar la tabla, en tu máquina:

```bash
cd pythonservice
PIPELINE_CONTACT="tu-correo@ejemplo.cl" python -m scripts.run_pipeline --json resultado.json
```

Imprime el estado de cada fuente, los tiempos, la cobertura y una muestra de lo que no se pudo cruzar. Luego,
con el sistema levantado, `POST /universities/ingestion` y `GET /universities/metrics` dan las cifras
acumuladas.
