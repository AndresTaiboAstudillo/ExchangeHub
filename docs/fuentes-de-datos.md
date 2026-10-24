# Fuentes de información web

Estado: octubre de 2026. Lo marcado como **POR CONFIRMAR** es algo que no pude verificar desde mi entorno
de trabajo (no tenía acceso a esos sitios) y que conviene revisar antes de entregar.

## 1. Resumen

ExchangeHub orienta a estudiantes internacionales en Chile. La pantalla **Universidades** necesita datos
reales y verificables sobre las instituciones de educación superior. Se combinan dos fuentes, una oficial y
otra abierta, y existe una tercera capa opcional (textos) que **todavía no está implementada**.

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
- **Cobertura real: no medida.** Solo conozco una fila real (Universidad Adolfo Ibáñez, `Q611995`). Con el
  comando `python -m scripts.run_pipeline` se mide en tu máquina (ver `docs/evaluacion.md`).

### F3. Páginas de relaciones internacionales (pendiente)

Texto informativo para estudiantes de intercambio, para que el buscador tenga contenido más allá de los
nombres. Requiere que definas entre 6 y 10 páginas y que revisemos `robots.txt` y términos de cada una.
No se ha descargado nada de estos sitios.

### Fuentes evaluadas y descartadas

| Fuente | Motivo |
|---|---|
| SIES (`mifuturo.cl`) | Al intentar acceder de forma automatizada, el sitio lo rechazó por sus reglas para robots. No se usa mediante scraping. |
| Portal *Niños, Niñas y Estudiantes Extranjeros* (Mineduc) | Trata sobre educación escolar, no sobre intercambio universitario. |
| Portales de arriendo y redes sociales | Suelen prohibir el scraping en sus términos y contienen datos personales. |

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

- Reemplaza los datos de ejemplo de la pantalla Universidades por información real y trazable.
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

### Sobre el `robots.txt` del Ministerio

No pude leer el `robots.txt` de `ayudamineduc.cl` desde mi entorno: una herramienta de lectura web lo rechazó
como `robots_disallowed`, lo que sugiere que el sitio restringe a los robots. **POR CONFIRMAR** abriéndolo en
tu navegador. Para no depender de esa suposición, el pipeline consulta `robots.txt` en cada ejecución y no
descarga nada que no esté permitido; si el archivo está bloqueado, el camino previsto es descargarlo a mano
(es un archivo público de acceso libre para personas) y apuntar `MINEDUC_CATALOG_FILE` a él.

## 6. Frecuencia y estrategia de actualización

- El Ministerio publica ediciones periódicas (la vigente es *mayo 2026*). Se recomienda revisar **una vez por
  semana** (`INGESTION_INTERVAL_HOURS=168`). Es una revisión barata: si la huella del contenido no cambió,
  no se modifica ningún registro.
- Los datos se consideran **desactualizados** si la última recuperación exitosa tiene más de 14 días
  (`DATA_STALE_AFTER_DAYS`). La pantalla lo avisa.
- Si una fuente no responde, se conserva el último dato válido, se registra la falla y se sigue sirviendo
  lo que ya está guardado.
- F3 (cuando exista): una vez al mes.

## 7. Revisión legal, ética y privacidad

| Aspecto | Decisión |
|---|---|
| Licencia de F1 | El sitio que la publica remite a Creative Commons Atribución 2.0 Chile. **POR CONFIRMAR** que esa licencia cubre el archivo. Se atribuye la fuente en la pantalla y en la tabla `data_sources`. |
| Licencia de F2 | Wikidata es CC0: sin restricciones. Se muestra el enlace a cada entidad. |
| Datos personales | Solo se tratan datos de **instituciones**. No se recopilan nombres de funcionarios ni correos personales. Marco: Ley 19.628 y la Ley 21.719, que entra en vigencia el **1 de diciembre de 2026** ([Diario Constitucional](https://www.diarioconstitucional.cl/2026/06/12/la-ley-21-719-entra-en-vigor-el-1-de-diciembre-y-expone-vacios-en-regulacion-de-pequenas-empresas/)). |
| `robots.txt` y términos | Se verifican en tiempo de ejecución para las páginas descargadas (ver sección 5). |
| Carga sobre el servidor | Una petición a la vez, reintentos con espera creciente (se respeta `Retry-After`, con tope de 30 s), tiempos máximos de espera y tamaño máximo de respuesta. |
| Identificación | `User-Agent: ExchangeHubBot/1.0 (proyecto universitario; contacto: …)`. Configura `PIPELINE_CONTACT`. |
| Seguridad (SSRF) | Las URL de las fuentes salen de la configuración del servicio, nunca de la petición del usuario. |
| Derechos de autor del texto | Aplicará a F3: se indexa para buscar, pero a los usuarios solo se les mostrará un fragmento con el enlace al original. |
| Procedencia | Cada registro guarda fuente, URL, fecha de recuperación y huella del contenido. |
| Retiro | Si una institución pidiera retirar su contenido, se elimina y se excluye de futuras recuperaciones. |
| Honestidad hacia el usuario | La pantalla indica las fuentes y avisa que Wikidata cubre solo una parte de las instituciones y puede contener errores. |

## 8. Pendientes

1. Abrir `robots.txt` de `ayudamineduc.cl` y confirmar si se puede descargar el archivo de forma automática.
2. Confirmar el alcance de la licencia de F1.
3. Ejecutar `python -m scripts.run_pipeline` en tu máquina para conocer la cobertura real de Wikidata.
4. Decidir si se implementa F3 (lista de URL, `robots.txt` y términos de cada una).
