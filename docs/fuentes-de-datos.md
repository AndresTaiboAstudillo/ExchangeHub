# Fuentes de información web


## 1. Resumen


| Capa | Fuente | Qué aporta | Estado |
|---|---|---|---|
| F1 | Ministerio de Educación: *Instituciones Vigentes Reconocidas por el MINEDUC* (Excel) | Catálogo base: nombre, tipo, vigencia y estado de funcionamiento | Implementada |
| F2 | Wikidata (consulta SPARQL) | Sitio web, coordenadas y año de fundación de las universidades | Implementada |
| F3 | Páginas de relaciones internacionales de cada universidad | Texto para el buscador | **No implementada** (falta la lista de URL y revisar `robots.txt` y términos de cada sitio) |

## 2. Fuentes identificadas

### F1. Catálogo del Mineduc

- Ficha: `https://www.ayudamineduc.cl/ficha/instituciones-vigentes-reconocidas-por-el-mineduc`.
- Archivo de la edición de mayo de 2026: `https://ayudamineduc.cl/sites/default/files/ies_vig_may_26.xlsx`
  (el nombre sigue el patrón `ies_vig_<mes>_<aa>.xlsx`).
- La ficha excluye a las instituciones de las Fuerzas Armadas (dependen del Ministerio de Defensa).
- **Qué contiene realmente.** Una hoja con 128 filas y solo cinco columnas: `NÚMERO REGISTRO`, `NOMBRE`,
  `TIPO INSTITUCIÓN`, `VIGENCIA` y `FUNCIONAMIENTO`. **No trae región, comuna, dirección, teléfono ni sitio
  web.** Por eso se complementa con Wikidata.

| Valor | Cantidad |
|---|---|
| Universidades (estatales 18, particulares con aportes 9, privadas 28) | 55 |
| Institutos profesionales | 30 |
| Centros de formación técnica (estatales 15, otros 28) | 43 |
| Funcionando / en proceso de cierre / en proceso de revocación | 123 / 3 / 2 |

### F2. Wikidata

- Punto de consulta SPARQL: `https://query.wikidata.org/sparql`. Datos bajo licencia **CC0** (dominio público).
- Se piden las entidades que son universidades (`P31/P279* Q3918`) en Chile (`P17 Q298`), con sitio web (`P856`),
  coordenadas (`P625`) y fecha de fundación (`P571`) cuando existen.


### Fuentes evaluadas y descartadas

| Fuente | Motivo |
|---|---|
| SIES (`mifuturo.cl`) | Al intentar acceder de forma automatizada, el sitio lo rechazó por sus reglas para robots. No se usa mediante scraping. |
| Portal *Niños, Niñas y Estudiantes Extranjeros* (Mineduc) | Trata sobre educación escolar, no sobre intercambio universitario. |

## 3. Descripción de los datos

| Campo | Origen | Ejemplo |
|---|---|---|
| `registry_number` | F1 | `C26` |
| `name` | F1 (normalizado a mayúsculas/minúsculas) | `Universidad Adolfo Ibáñez` |
| `institution_type`, `category`, `ownership` | F1 | `UNIVERSIDAD PRIVADA`, `universidad`, `privada` |
| `operating_status`, `is_vigente` | F1 | `funcionando`, `true` |
| `wikidata_id`, `website`, `latitude`, `longitude`, `founded_year` | F2 | `Q611995`, `https://www.uai.cl`, -33.486, -70.518, 1988 |
| Procedencia de cada dato | ambas | fuente, identificador externo, URL, fecha de recuperación, huella SHA-256 |

## 4. Justificación dentro del proyecto

- El catálogo oficial garantiza cobertura completa y estado vigente; Wikidata agrega datos útiles (sitio web,
  mapa) sin depender de scraping.
- Permite vincular `users.university_origin` (texto libre) con una institución del catálogo
  (`GET /universities/resolve`).
- Es el corpus del buscador con ranking (requisito 6).

## 5. Método de obtención

- **F1:** descarga automatizada del Excel, **condicionada a `robots.txt`**. Primero se lee la ficha para
  descubrir la edición más reciente. Si la ficha o el archivo no están permitidos o no responden, se usa un
  Excel descargado a mano (`MINEDUC_CATALOG_FILE`). Si tampoco existe, la ingesta falla y se conservan los datos
  anteriores.
- **F2:** una consulta SPARQL. Es una API documentada para uso programático, así que no se le aplica
  `robots.txt`, pero sí su política de uso: `User-Agent` que identifica al proyecto con un contacto, una sola
  consulta por ejecución y reintentos con espera creciente.


## 6. Frecuencia y estrategia de actualización

- El Ministerio publica ediciones periódicas (la vigente es *mayo 2026*). Se recomienda revisar **una vez por
  semana** (`INGESTION_INTERVAL_HOURS=168`). Es una revisión barata: si la huella del contenido no cambió,
  no se modifica ningún registro.
- Los datos se consideran **desactualizados** si la última recuperación exitosa tiene más de 14 días
  (`DATA_STALE_AFTER_DAYS`). La pantalla lo avisa.
- Si una fuente no responde, se conserva el último dato válido, se registra la falla y se sigue sirviendo
  lo que ya está guardado.
- F3 (cuando exista): una vez al mes.


