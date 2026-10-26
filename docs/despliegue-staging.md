## 1. Qué ejecuta el pipeline

El flujo de trabajo `.github/workflows/ci.yml` corre en cada Pull Request y en cada push a `main`;
`.github/workflows/codeql.yml` lo complementa con análisis estático.

| Requisito | Dónde se cumple |
|---|---|
| Pruebas unitarias del servicio Python | Job `python`: `pytest` (incluye las pruebas del pipeline de datos) |
| Pruebas de integración NestJS ↔ FastAPI | Job `compose-smoke`: levanta PostgreSQL, Python y backend reales, ejecuta una ingesta completa, consulta los datos desde NestJS, repite la ingesta y comprueba que no duplica |
| Pruebas del proceso de recuperación de información | Job `python` (recuperación, limpieza, cruce) y job `backend` (`npm test` incluye la evaluación de la búsqueda con 29 consultas etiquetadas) |
| Linting de Python | Job `python`: `ruff check` y `ruff format --check` |
| Análisis estático de seguridad | `ruff` con reglas `S` (equivalentes a bandit) y CodeQL para Python y TypeScript |
| Dependencias vulnerables de Python | Job `dependency-audit`: `pip-audit` |
| Detección de secretos | Job `secrets-scan`: gitleaks |
| Vulnerabilidades de las imágenes Docker | Job `docker`: Trivy; bloquea si hay vulnerabilidades CRITICAL con corrección |
| Validación de Terraform | Job `terraform`: `fmt`, `validate` y `plan` |
| Despliegue automático en staging | Job `staging` (sección 2) |
| Pruebas de salud posteriores al despliegue | `infra/scripts/post-deploy-check.sh`, ejecutado por el job `staging` |

El job `ci-ok` agrupa todas las etapas y es el que conviene exigir en la protección de la rama.

## 2. Despliegue en staging

**Cuándo corre:** solo en `main`, después de que `ci-ok` haya pasado, y manualmente desde la pestaña
Actions con «Run workflow».

**Qué hace**
1. Construye las tres imágenes (`infra/build-images.sh`).
2. Valida y aplica Terraform (`infra/terraform`, proveedor Docker local): crea las redes `internal`,
   `public` y `egress`, PostgreSQL, el servicio Python, el backend y el frontend.
3. Espera a que el backend quede listo y ejecuta `infra/scripts/post-deploy-check.sh`.
4. Si algo falla, imprime los registros de cada contenedor.
5. Destruye el ambiente, salvo que se haya configurado como permanente.

**Qué comprueba el script posterior al despliegue**

- El backend responde en menos de 150 s y `/health` devuelve `ok`.
- `/health/ready` informa PostgreSQL y el servicio Python como `up`.
- `X-Request-Id` se conserva de la petición a la respuesta.
- El frontend responde 200 y contiene la aplicación.
- CORS permite el origen del frontend (si no, el navegador bloquearía la aplicación).
- Registro, login, ruta protegida (401 sin token, 200 con token) y consulta de universidades.
- Las rutas de administración rechazan a un usuario normal (403).

El script sale con error si cualquier comprobación falla, lo que hace fallar el job.

**Ejecutor y ambiente permanente.** Con el ejecutor de GitHub el staging existe solo mientras dura
el job (el ejecutor es efímero), así que sirve como prueba de que el despliegue funciona. Para un
staging que permanezca disponible en tu computador:

1. En el repositorio: *Settings → Actions → Runners → New self-hosted runner*, y sigue los pasos
   en tu máquina (requiere Docker).
2. Crea las Variables `STAGING_RUNNER` (la etiqueta del ejecutor, por ejemplo `self-hosted`) y
   `STAGING_KEEP` con valor `true`.
3. Tras cada push a `main`, el job despliega sobre ese Docker y deja el ambiente en pie en
   `http://localhost:3100` (frontend) y `http://localhost:8100` (backend).

El estado de Terraform se guarda en `~/.exchangehub-staging/terraform.tfstate`, fuera del
repositorio, porque contiene los secretos y `actions/checkout` borraría cualquier archivo local.

## 3. Variables y Secrets de GitHub Actions

Configuración no sensible → **Variables** (*Settings → Secrets and variables → Actions → Variables*).
Información sensible → **Secrets**. El job `staging` usa el entorno `staging`, que GitHub crea
solo en el primer uso y permite acotar ahí también los valores.

| Nombre | Tipo | Para qué | Si falta |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Secret | Contraseña de PostgreSQL | Se genera una al vuelo (y se enmascara en los registros) |
| `JWT_SECRET` | Secret | Firma de los tokens (mínimo 32 caracteres) | Se genera una al vuelo |
| `POSTGRES_USER`, `POSTGRES_DB` | Variable | Usuario y base | `exchangehub`, `exchangehubdb` |
| `PIPELINE_CONTACT` | Variable | Contacto que se incluye en el User-Agent de las descargas | `sin-contacto-configurado` |
| `INGESTION_INTERVAL_HOURS` | Variable | Revisión periódica de las fuentes (0 = solo manual) | `0` |
| `STAGING_FRONTEND_PORT`, `STAGING_BACKEND_PORT` | Variable | Puertos publicados | `3100`, `8100` |
| `STAGING_RUNNER`, `STAGING_KEEP` | Variable | Ejecutor propio y ambiente permanente | `ubuntu-latest`, `false` |
| `NEXT_PUBLIC_API_URL`, `FRONTEND_ORIGIN` | Variable | Usadas por la prueba de integración con Docker Compose | `http://localhost:8000`, `http://localhost:3000` |

Ningún secreto se escribe en el repositorio: el estado de Terraform, `terraform.tfvars` y `.env`
están excluidos por `.gitignore`.

## 4. Desplegar y comprobar a mano

Desde la raíz del repositorio, con Docker y Terraform instalados:

```bash
bash infra/build-images.sh

cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edita las contraseñas
terraform init
terraform apply

cd ../..
bash infra/scripts/post-deploy-check.sh        # usa los puertos 8100 y 3100 por defecto
```

Para destruirlo: `terraform destroy` en `infra/terraform`.

## 5. Solución de problemas

| Síntoma | Causa probable |
|---|---|
| `staging` no aparece en la ejecución | No es `main` o no es un push o ejecución manual; en un Pull Request no corre |
| `terraform apply` falla con «port is already allocated» | Otro servicio usa 3100 u 8100; cambia `STAGING_FRONTEND_PORT` o `STAGING_BACKEND_PORT` |
| El script falla en CORS | El frontend se construyó con otro puerto del backend: reconstruye con `infra/build-images.sh` |
| El script falla en `/health/ready` con Python `down` | El contenedor de Python no arrancó; revisa sus registros en el paso «Registros si algo falló» |
| La ingesta de `compose-smoke` falla | Mira el campo `error` de la respuesta y los registros del servicio Python; ver `docs/pipeline-de-datos.md` |

## 6. Limitaciones

- Con el ejecutor de GitHub, el staging no permanece disponible tras el job.
- Staging usa el Docker del propio ejecutor: no es una máquina remota ni protege contra fallos de
  esa máquina.
- La prueba de integración reproduce la ingesta con el Excel de pruebas del repositorio si las fuentes
  públicas no responden; no mide la disponibilidad real de esas fuentes.
- Trivy solo bloquea las vulnerabilidades CRITICAL con corrección disponible; las de gravedad alta se
  informan sin bloquear.
