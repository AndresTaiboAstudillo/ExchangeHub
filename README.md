# Readme para Ingeniería Web Avanzada
# ExchangeHub
# Aplicación web y móvil para estudiantes extranjeros que vengan a Chile de intercambio.
# Andrés Taibo
# El proyecto busca reducir la frustración de los estudiantes extranjeros al entregarles una herramienta centralizada que los ayudará a encontrar alojamiento, comercio y a otras personas en una situación similar.
# Los usuarios objetivo son estudiantes de intercambio.
# Objetivo general: Desarrollar una plataforma digital integral que mejore la experiencia de movilidad estudiantil internacional en Chile, promoviendo la inclusión, la seguridad y la colaboración entre instituciones académicas y estudiantes internacionales.
# Objetivos específicos:
* Analizar los requerimientos funcionales y no funcionales de los estudiantes internacionales en Chile, con el fin de determinar las necesidades críticas en términos de vivienda, trámites administrativos e integración social.
* Identificar las fuentes de datos y servicios de terceros (API de OpenStreetMap) que permitan la extracción de información confiable sobre geolocalización y listados de alojamiento verificado.
* Diseñar la arquitectura del sistema y la interfaz de usuario (UX/UI), definiendo la estructura de la base de datos en PostgreSQL y el flujo de navegación para asegurar una experiencia intuitiva y centralizada.
* Desarrollar la plataforma web full-stack utilizando el stack Next.js, Node.js y Express, integrando los módulos de comunicación en tiempo real, mapas interactivos y el repositorio de guías informativas.
* Validar la eficiencia y usabilidad de la solución propuesta mediante pruebas con usuarios reales y la aplicación de la métrica System Usability Scale (SUS), para asegurar que la plataforma cumple con los estándares de calidad esperados.
 # alcance y exclusiones: La aplicación se basa en opiniones de estudiantes de intercambio, no se incluyen transacciones ni emparejamiento con arrendadores o comercios.
 # principales funcionalidades
 * Mapa de comercio, zonas de interés y arriendos con reviews de estudiantes.
 * Foro general para discusiones relacionadas con el ámbito académico
 * Chat en tiempo real
 * Perfil personal y amistades
 * Buscador de amigos
 # La arquitectura se organiza por sus tres capas, el cliente, servidor y datos. Sigue una relación del cliente con el servidor con separación clara de sus responsabilidades. Next.js gestiona todo lo que lleva la interfaz y rendering, Node.js maneja la API REST y autenticación, y finalmente PostgreSQL incorpora los datos. Los servicios externos usados como openstreetmap y SMTP se ilustran como módulos independientes para no juntar la lógica del sistema a un proveedor específico. 
 # tecnologias y herramientas utilizadas
 * Nodejs, postgres, Next js
 * Socket io
 * OpenStreetMap, Smtp
 # fuente o fuentes de info web
* P. Arias, I. Figueroa, C. Iturrieta, y J. Pérez, “Apuntes 73: Análisis del estudiantado extranjero en el sistema escolar, 2024,” Centro de Estudios MINEDUC (CEM), Ministerio de Educación, Chile, ene. 2025. [En línea]. Disponible: https://hdl.handle.net/20.500.12365/21440. [Accedido: 08-abr-2026]
* “El comparador de alojamiento para estudiantes | Erasmus Play,” Erasmus Play, 2026. [En línea]. Disponible: https://erasmusplay.com/es/. [Accedido: 08-abr-2026].
* “Cómo encontrar alojamiento como estudiante internacional - Lumos,” Lumos, 2026. [En línea]. Disponible: https://lumoslatam.com/como-encontrar-alojamiento-como-estudiante-internacional/. [Accedido: 08-abr-2026].
* helpHousing, “Alojamiento para jóvenes internacionales,” 2026. [En línea]. Disponible: https://www.helphousing.com/es. [Accedido: 08-abr-2026].
* Universidad de Chile, “Universidad de Chile recibe a 250 estudiantes internacionales de pregrado este semestre,” 10-abr-2026. [En línea]. Disponible: https://uchile.cl/noticias/237667/u-de-chile-recibe-a-250-estudiantes-internacionales-de-pregrado. [Accedido: 10-abr-2026].
* Universidad Católica de Chile, “Ven a la UC,” Dirección de Internacionalización, 2026. [En línea]. Disponible: https://internacionalizacion.uc.cl/ven-a-la-uc/. [Accedido: 10-abr-2026].
* Universidad de La Frontera, “Programa de acogida,” 2026. [En línea]. Disponible: https://internacionalizacion.ufro.cl/movilidad-estudiantil/estudia-en-la-ufro/programa-de-acogida/. [Accedido: 11-abr-2026].
* Duoc UC, “Duocanos crean aplicación móvil para estudiantes de intercambio,” 11-abr-2026. [En línea]. Disponible: https://www.duoc.cl/?noticia_post_type=duocanos-crean-aplicacion-movil-para-estudiantes-de-intercambio. [Accedido: 11-abr-2026].
* Universidad de Santiago de Chile, “Lanzan App que entrega información sobre el intercambio internacional para las y los estudiantes,” 12-abr-2026. [En línea]. Disponible: https://www.usach.cl/news/lanzan-app-entrega-informacion-sobre-intercambio-internacional-para-las-y-los-estudiantes. [Accedido: 12-abr-2026].
* Geoportal de Chile, “Geoportal de Chile,” 2026. [En línea]. Disponible: https://geoportal.cl. [Accedido: 12-abr-2026].
* Inesdi Business Techschool, “Sistemas de Información Geográfica (SIG): qué son, usos y ejemplos,” 12-abr-2026. [En línea]. Disponible: https://www.inesdi.com/blog/sistemas-de-informacion-geografica-SIG/. [Accedido: 12-abr-2026].
* S. Micheletti Dellamaria, F. Saravia Cortés, y J. Muñoz Tique, “Movilidad estudiantil internacional y efectos en el ámbito personal, académico y laboral: el caso de la Universidad del Bío-Bío en Chile,” Rev. Educ. Las Américas, vol. 12, no. 1, 2022. [En línea]. Disponible: https://portal.amelica.org/ameli/journal/248/2483735001/. [Accedido: 12-abr-2026].
* T. Anderson y H. Kanuka, “On-Line Forums: New Platforms for Professional Development and Group Collaboration,” J. Comput.-Mediat. Commun., vol. 3, no. 3, dic. 1997. DOI: 10.1111/j.1083-6101.1997.tb00078.x.
* J. Owyang, C. Tran, y C. Silva, “The collaborative economy,” Altimeter Group, EE. UU., Informe, 2013.
* D. J. Maguire, “An overview and definition of GIS,” en Geographical Information Systems: Principles and Applications, vol. 1, no. 1, pp. 9-20
* Google Cloud, "¿Qué es una API REST?," Google Cloud. [En línea]. Disponible: https://cloud.google.com/discover/what-is-rest-api?hl=es. [Accedido: 9-sep-2026]. 
* Microsoft, "WebSockets," Microsoft Learn, 30-ago-2026. [En línea]. Disponible: https://learn.microsoft.com/es-es/windows/apps/develop/networking/websockets. [Accedido: 9-sep-2026]. 
* Amazon Web Services, "¿Cuál es la diferencia entre el front end y back end en el desarrollo de aplicaciones?," AWS. [En línea]. Disponible: https://aws.amazon.com/es/compare/the-difference-between-frontend-and-backend/. [Accedido: 9-sep-2026].  
* I. Sommerville, Ingeniería de software, 9.ª ed. Naucalpan de Juárez, México: Pearson Educación, 2011. 
* J. Brooke, "SUS: A quick and dirty usability scale," in Usability Evaluation in Industry, P. W. Jordan, B. Thomas, B. A. Weerdmeester, and I. L. McClelland, Eds. London, UK: Taylor & Francis, 1996, pp. 189-194.
* K. Schwaber and J. Sutherland, The Scrum Guide: The Definitive Guide to Scrum: The Rules of the Game. Scrum.org and ScrumGuides.org, Nov. 2020. [En línea]. Available: https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-US.pdf.[Accedido: 12-abr-2026]

 # El sistema generará recomendaciones de amistades dependiendo de los intereses del usuario
 # Requisitos

* Node.js 22 o superior (el CI usa 22) y npm 11 o superior
* Python 3.11 o superior
* Git
* Docker con Compose (se usa `docker compose`; en instalaciones antiguas el comando es `docker-compose`)
* Opcional, para la app Android: Android Studio con el SDK de Android 16 (API 36) y JDK 21
* Opcional, para el despliegue a staging a mano: Terraform 1.9 o superior

# Instrucciones de instalación

```bash
git clone https://github.com/AndresTaiboAstudillo/ExchangeHub
cd ExchangeHub
cp .env.example .env        # completa POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB y JWT_SECRET
```

Después instala las dependencias de cada parte (solo si vas a ejecutar el código fuera de Docker):

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd pythonservice && python -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt && cd ..
```

En Windows con Git Bash, la activación del entorno virtual es `source .venv/Scripts/activate`.

# Configuración de variables de entorno

Hay tres lugares donde se definen, según cómo ejecutes el proyecto:

* `.env` en la raíz: lo usa Docker Compose (copia de `.env.example`).
* `backend/.env`: lo usa el backend cuando lo ejecutas con `npm run start:dev` (copia de `backend/.env.example`).
* `frontend/.env.local`: solo si ejecutas el frontend con `npm run dev` y la API no está en `http://localhost:8000`.

| Variable | Dónde | Descripción | Ejemplo |
|---|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `.env` | Credenciales de la base de datos | `exchangehub`, `una-clave-segura`, `exchangehubdb` |
| `DATABASE_URL` | backend | Conexión a PostgreSQL (solo en ejecución local) | `postgresql://usuario:clave@localhost:5432/nombre_db` |
| `PORT` | backend | Puerto del backend | `8000` |
| `JWT_SECRET` | `.env` y backend | Firma de los tokens (mínimo 32 caracteres) | genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN_SECONDS` | `.env` y backend | Duración del token | `3600` |
| `FRONTEND_ORIGIN` | `.env` y backend | Orígenes permitidos por CORS, separados por comas | `http://localhost:3000,https://localhost` |
| `PYTHON_SERVICE_URL` | backend | Dirección del servicio Python (en Docker se define sola) | `http://localhost:8001` |
| `NEXT_PUBLIC_API_URL` | `.env` y frontend | URL del backend; se incorpora al compilar | `http://localhost:8000` |
| `PIPELINE_CONTACT` | `.env` | Contacto incluido en el User-Agent de las descargas | `tu-correo@ejemplo.cl` |
| `INGESTION_INTERVAL_HOURS` | `.env` | Revisión periódica de las fuentes (`0` = solo manual) | `168` |
| `MINEDUC_CATALOG_FILE` | servicio Python | Excel local del catálogo, si la descarga falla | `/data/ies_vigentes.xlsx` |
| `LOG_LEVEL` | `.env` | `debug`, `info`, `warn` o `error` | `info` |
| `API_DOCS_ENABLED` | backend | `false` desactiva la documentación `/docs` | `true` |
| `MOBILE_API_URL` | al compilar la app Android | URL de la API para el móvil | `http://10.0.2.2:8000` |

Los archivos `.env` no se suben a Git.

# Instrucciones de ejecución

1. Levantar la base de datos:
   * en bash: `docker compose up -d postgres`

2. Servicio Python (puerto 8001):
   * en bash:
   * `cd pythonservice`
   * `source .venv/bin/activate`
   * `uvicorn main:app --reload --port 8001`

3. Backend (puerto 8000):
   * en bash:
   * `cd backend`
   * `npm install`
   * `npx prisma generate`
   * `npx prisma migrate dev` (en un ambiente que no sea de desarrollo, `npx prisma migrate deploy`)
   * `npm run start:dev`

4. Frontend (puerto 3000):
   * en bash:
   * `cd frontend`
   * `npm install`
   * `npm run dev`

Para ejecutar todo junto con Docker, ver «Proceso de construcción con Docker».

# Cargar las universidades

La tabla de universidades está vacía hasta que un administrador lanza la ingesta:

1. Regístrate en la aplicación.
2. Hazte administrador (el rol se guarda en la base de datos):
   ```bash
   docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "update users set role = '"'"'admin'"'"' where email = '"'"'tu@correo.com'"'"';"'
   ```
3. Obtén un token y lanza la ingesta:
   ```bash
   curl -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" \
     -d '{"email":"tu@correo.com","password":"tu-contraseña"}'
   curl -X POST http://localhost:8000/universities/ingestion -H "Authorization: Bearer TU_TOKEN"
   ```

La respuesta indica `succeeded`, `partial` (falló solo Wikidata) o `failed`, y cuántas instituciones se crearon,
actualizaron o quedaron igual.

**Si el sitio del Ministerio no está disponible**, descarga el Excel a mano y guárdalo como
`datos/ies_vigentes.xlsx`. Luego, en el servicio `python-service` de `docker-compose.yml`, agrega la variable
`MINEDUC_CATALOG_FILE: /data/ies_vigentes.xlsx` y el volumen `./datos/ies_vigentes.xlsx:/data/ies_vigentes.xlsx:ro`.
El pipeline lo usa cuando la descarga falla.

# Instrucciones de uso

* Regístrate o inicia sesión desde la pantalla de bienvenida. Las secciones de la barra de navegación son
  Inicio, Universidades, Comunidad y Perfil.
* **Inicio:** mapa con alojamientos, comercios y zonas. Por ahora usa datos de ejemplo incluidos en el frontend;
  aún no se leen del backend.
* **Universidades:** instituciones de educación superior de Chile (por defecto, las universidades), con búsqueda
  por relevancia, filtros por tipo y propiedad, y sitio web, año de fundación y ubicación cuando están disponibles.
  Estos datos sí vienen del backend.
* **Comunidad:** el foro (publicaciones, respuestas y «me gusta») y las sugerencias y solicitudes de amistad
  funcionan con el backend.
* **Perfil:** datos del estudiante.

# Ejecución de pruebas

* En bash:
  ```bash
  cd backend
  npm test                  # unitarias (incluye la evaluación de la búsqueda)
  npm run test:e2e          # API con la base de datos simulada
  npx prisma migrate deploy && npm run test:integration   # requiere PostgreSQL y DATABASE_URL

  cd ../pythonservice
  ruff check . && ruff format --check . && pytest -q

  cd ../frontend
  npm run lint && npm test
  ```

Resultados de la última ejecución y qué cubre cada suite: [`docs/evidencia-de-pruebas.md`](docs/evidencia-de-pruebas.md).

# Proceso de construcción con Docker

* Construir y levantar los servicios en segundo plano (`postgres`, `python-service`, `backend` y `frontend`):
  `docker compose up -d --build`

* Las migraciones de la base de datos se aplican solas cuando arranca el backend. Si necesitas aplicarlas a mano:
  `docker compose exec backend npx prisma migrate deploy`

* Verificar que todo está activo:
  * `docker compose ps`
  * `docker compose logs -f backend`
  * `curl http://localhost:8000/health/ready` (comprueba PostgreSQL y el servicio Python)

* Detener los servicios: `docker compose down`  (con `-v` también borra los datos de la base)

| Servicio | Dirección |
|---|---|
| Frontend | http://localhost:3000 |
| API (NestJS) | http://localhost:8000 |
| Documentación de la API | http://localhost:8000/docs |

El servicio Python no se publica fuera de Docker.

# Proceso de despliegue

El despliegue a staging es automático y se hace con Terraform sobre Docker:

1. Cada Pull Request ejecuta el CI: pruebas, lint, análisis estático (CodeQL y ruff), detección de secretos
   (gitleaks), dependencias vulnerables (`npm audit` y `pip-audit`), escaneo de las imágenes con Trivy, validación
   de Terraform y una prueba de integración con Docker Compose.
2. Al fusionar a `main`, el job **staging** construye las imágenes, aplica Terraform y ejecuta las pruebas de salud
   posteriores (`infra/scripts/post-deploy-check.sh`).
3. La configuración no sensible se guarda como *Variables* de GitHub Actions y la sensible (`POSTGRES_PASSWORD`,
   `JWT_SECRET`) como *Secrets*.

A mano, desde la raíz del proyecto:

```bash
bash infra/build-images.sh
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars    # reemplaza las contraseñas
terraform init && terraform apply
cd ../.. && bash infra/scripts/post-deploy-check.sh
```

Detalle, variables y cómo dejar un staging permanente: [`docs/despliegue-staging.md`](docs/despliegue-staging.md)
e [`infra/README.md`](infra/README.md).

# Enlace al ambiente de staging

El staging corre en Docker local, no hay una dirección pública:

* Frontend: http://localhost:3100
* Backend: http://localhost:8100 (salud: http://localhost:8100/health/ready)

Con el ejecutor de GitHub, el ambiente existe solo mientras dura el job de despliegue. Para tenerlo siempre
disponible en tu computador, registra un ejecutor propio y define las Variables `STAGING_RUNNER` y
`STAGING_KEEP=true` (ver `docs/despliegue-staging.md`).

# Documentación de la API

* Interfaz interactiva de NestJS: http://localhost:8000/docs (especificación JSON en `/docs-json`). Las rutas
  protegidas exigen `Authorization: Bearer <token>`: pulsa *Authorize* y pega el token de `POST /auth/login`.
  En un despliegue público conviene desactivarla con `API_DOCS_ENABLED=false`.
* Especificaciones versionadas: [`docs/api/nestjs-openapi.json`](docs/api/nestjs-openapi.json) y
  [`docs/api/fastapi-openapi.json`](docs/api/fastapi-openapi.json).
* El servicio Python solo es accesible dentro de Docker; su ruta principal es `POST /v1/pipeline/universities/run`.

---

# Arquitectura

```
 Navegador / app Android ──▶ Frontend (Next.js) ──▶ Backend (NestJS) ──▶ PostgreSQL
                                                          │
                                                          └──▶ Servicio Python (FastAPI) ──▶ Mineduc, Wikidata
```

Regla de diseño: el frontend solo habla con NestJS. NestJS es el único que llama al servicio Python y a la base
de datos.

# Datos de universidades y recuperación de información

El servicio Python recupera el catálogo oficial del Ministerio de Educación y lo cruza con Wikidata; NestJS lo
guarda con su procedencia (fuente, URL, fecha y huella SHA-256), evita duplicados y lo ofrece con un buscador por
relevancia (BM25). Si una fuente falla, se conserva el último dato válido.

* Fuentes, licencias y restricciones: [`docs/fuentes-de-datos.md`](docs/fuentes-de-datos.md)
* Recuperación, limpieza y persistencia: [`docs/pipeline-de-datos.md`](docs/pipeline-de-datos.md)
* Métricas y evaluación (Precision@K, Recall@K, MRR): [`docs/evaluacion.md`](docs/evaluacion.md)

# Observabilidad

Registros JSON en backend y servicio Python con un `X-Request-Id` que viaja entre ambos, salud con comprobación de
PostgreSQL y Python, y tiempos de respuesta por ruta en `GET /metrics/http` (solo administradores). Para seguir una
petición: `docker compose logs backend python-service | grep <id>`. Detalle en
[`docs/observabilidad.md`](docs/observabilidad.md).

# App Android

```bash
cd frontend
npm run mobile:sync:dev     # compila la web móvil y la sincroniza con el proyecto de Android
npm run mobile:open         # abre Android Studio; ejecuta sobre un emulador o un teléfono
```

El backend debe permitir el origen de la app: `FRONTEND_ORIGIN=http://localhost:3000,https://localhost`.
Requisitos, configuración de producción y límites: [`docs/android.md`](docs/android.md).


 # imagenes y diagramas
 * Diagrama entidad relación
  <img width="2048" height="1035" alt="diagrama" src="https://github.com/user-attachments/assets/9895b9b2-9800-4459-a35c-76d1af544b57" />
  
 * Diagrama UML
   <img width="2048" height="1135" alt="diagramauml" src="https://github.com/user-attachments/assets/fa846219-cd93-4829-a54c-76ab0e4b29a3" />
   
 * Diagrama de arquitectura
  <img width="2048" height="1867" alt="arquitectura" src="https://github.com/user-attachments/assets/d2d646fb-edfb-46d9-b8ab-be91dc798579" />
  
 * Casos de uso
  <img width="728" height="712" alt="foro drawio" src="https://github.com/user-attachments/assets/26528e99-961e-43b0-8cca-0a7d0a7df40e" />
  <img width="698" height="592" alt="mapa drawio" src="https://github.com/user-attachments/assets/cfcd1941-e596-4368-ac56-224df8e0fd1b" />
  <img width="728" height="562" alt="seccionpersonal drawio" src="https://github.com/user-attachments/assets/4d219ce2-6420-4927-991a-aa38fedc263c" />
  <img width="547" height="522" alt="buscadoramigo drawio" src="https://github.com/user-attachments/assets/bff4f294-74b0-466d-9316-74e407d50589" />
  <img width="713" height="632" alt="admingeneral drawio" src="https://github.com/user-attachments/assets/5c6ce93a-850c-406b-8fbc-062fccf74626" />
  <img width="728" height="502" alt="universitaria drawio" src="https://github.com/user-attachments/assets/e9a50937-7a5b-42c2-8c64-46ee5e094309" />
  
 * Diagramas de actividad
  <img width="442" height="652" alt="agregaramigo drawio" src="https://github.com/user-attachments/assets/e9045de1-d945-48fd-8021-11ee34eddd15" />
  <img width="402" height="652" alt="comentarforo drawio" src="https://github.com/user-attachments/assets/92d28d0a-99a9-4a0a-abe0-e800d6b23c76" />
  <img width="402" height="652" alt="publicarforo drawio" src="https://github.com/user-attachments/assets/34684d22-afb2-475e-9d79-3e873c34f556" />
  <img width="402" height="652" alt="reseñamapa drawio" src="https://github.com/user-attachments/assets/90a6abd8-49c1-427b-856f-1fe05b47ea61" />
  
# Limitaciones conocidas

* Falta confirmar el `robots.txt` y la licencia del archivo del Ministerio; mientras tanto el pipeline funciona con
  un Excel local.
* La cobertura real de Wikidata (sitio web, coordenadas) aún no está medida.
* Los alojamientos, comercios y zonas del mapa usan datos de ejemplo del frontend, aún no del backend.
* La capacidad adaptativa está especificada, no implementada, y la universidad de destino todavía no se guarda en
  el perfil.
* El despliegue a staging es local; no hay entorno de producción.
 # Falta implementar el chat en tiempo real, las notificaciones y el mapa, ya que por ahora este aparece fuera de la aplicación.
