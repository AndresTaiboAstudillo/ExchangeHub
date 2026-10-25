# Limitaciones identificadas

Resumen de los límites conocidos del proyecto. El detalle de cada uno está en el documento indicado.

## Fuentes y datos (`docs/fuentes-de-datos.md`)
- **Permisos de la fuente principal por confirmar.** El `robots.txt` del sitio del Ministerio de Educación
  no pudo leerse y la licencia CC BY 2.0 Chile del archivo debe confirmarse. Mientras tanto, el pipeline
  respeta `robots.txt` en tiempo de ejecución y puede trabajar con un Excel descargado a mano.
- **Disponibilidad de la fuente.** El sitio del Ministerio ha estado fuera de servicio y, en mantención,
  responde con una página HTML en vez del archivo; el pipeline lo detecta y usa el archivo local.
- **El catálogo es pobre en atributos.** Solo trae nombre, tipo, categoría, propiedad y estado
  (128 instituciones: 55 universidades, 30 institutos profesionales y 43 CFT).
- **Cobertura de Wikidata sin medir.** El sitio web, las coordenadas y el año de fundación dependen de
  Wikidata y cubren solo una parte de las universidades. La cobertura real se mide con
  `python -m scripts.run_pipeline`.
- **Cruce conservador.** Solo se enlazan universidades, uno a uno y nunca ante ambigüedad; algunas
  quedarán sin enlazar a propósito.
- **Capa de texto no implementada.** Las páginas web de las universidades como corpus de recuperación
  quedaron fuera de esta entrega.

## Recuperación de información (`docs/evaluacion.md`)
- El índice vive en memoria y se reconstruye al cambiar los datos; es adecuado para cientos de
  documentos, no para millones.
- Las siglas dependen de una lista curada a mano (`search/aliases.ts`).
- Las búsquedas por lugar («universidades de Valparaíso») no se pueden resolver con el catálogo, que no
  trae ubicación (R-Prec 0.50 en esas consultas).
- La evaluación usa 29 consultas etiquetadas por el propio equipo sobre 128 documentos: detecta
  regresiones, no demuestra calidad general.

## Observabilidad (`docs/observabilidad.md`)
- Las métricas de tiempos viven en memoria y se reinician con el contenedor.
- No hay recolección centralizada de registros ni alertas.

## Seguridad y dependencias
- `multer` se fuerza a la versión 2.5.0 con `overrides` porque `@nestjs/platform-express` aún pide la
  2.4.0; conviene quitar el `override` cuando esa dependencia se actualice.
- Quedan avisos en dependencias de **desarrollo** (por ejemplo `tmp`, `undici`, `@vitest/mocker`); el CI
  solo bloquea las de producción.
- Trivy solo bloquea vulnerabilidades CRITICAL con corrección disponible.
- La documentación interactiva de la API (`/docs`) está activa por defecto; en un despliegue público
  conviene desactivarla con `API_DOCS_ENABLED=false`.

## Despliegue (`docs/despliegue-staging.md`)
- Staging usa el Docker del ejecutor (local); con el ejecutor de GitHub no permanece disponible tras el job.
- No hay entorno de producción ni despliegue remoto.

## Producto
- La **universidad de destino** del estudiante aún no se guarda en el perfil (solo existe la de
  procedencia); es requisito de la capacidad adaptativa.
- La capacidad adaptativa está **especificada** (`docs/capacidad-adaptativa.md`), no implementada.
- La adaptación a móvil (Capacitor/Android) está pendiente.
