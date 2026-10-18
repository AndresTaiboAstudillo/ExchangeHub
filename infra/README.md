# Infraestructura preliminar (Terraform)

Define el ambiente de **staging** de ExchangeHub con Terraform y el proveedor de Docker.
En esta etapa el ambiente corre en el Docker local de quien lo ejecuta: no requiere cuenta
en ninguna nube ni genera costos.

## Descripción del ambiente de staging

**Propósito.** Probar el sistema completo (frontend, backend, servicio Python y base de datos)
conectado como lo estará en producción, antes de publicar cambios.

```
          navegador
              │
   ┌──────────┴──────────┐
   │  red "public"       │
   │  frontend :3100     │
   │  backend  :8100     │──────┐
   └─────────────────────┘      │
                         ┌──────┴──────────────────┐
                         │  red "internal"          │
                         │  (sin acceso exterior)   │
                         │  backend · postgres      │
                         │  python-service          │
                         └──────────────────────────┘
```

| Componente | Imagen | Publicado en el host | Redes |
|---|---|---|---|
| frontend | `exchangehub-staging/frontend:local`, construida desde `frontend/` | `127.0.0.1:3100` | public |
| backend (NestJS) | `exchangehub-staging/backend:local`, construida desde `backend/` | `127.0.0.1:8100` | public + internal |
| python-service (FastAPI) | `exchangehub-staging/python-service:local`, construida desde `pythonservice/` | no | internal |
| postgres | `postgres:16` | no | internal |

**Aislamiento.** La red `internal` está marcada como interna en Docker, por lo que ningún
contenedor de esa red es alcanzable desde fuera. Solo el backend pertenece a ambas redes:
el frontend no puede llegar a la base de datos ni al servicio Python, y el backend es el
único punto de acceso, tal como exige la arquitectura.

**Datos.** PostgreSQL usa el volumen `exchangehub-staging-postgres-data`, que sobrevive a
`terraform destroy` solo si no se elimina a mano; al destruir el ambiente el volumen también
se destruye. El backend aplica las migraciones de Prisma al arrancar.

**Secretos.** `postgres_password` y `jwt_secret` son variables sensibles: se entregan por
`terraform.tfvars` o por variables de entorno `TF_VAR_*`, nunca en el código.

**Diferencias con producción.** Corre en una sola máquina, sin alta disponibilidad, sin HTTPS,
sin respaldos de la base y con las imágenes construidas localmente en lugar de descargarse
desde un registro.

## Uso

Requisitos: [Terraform](https://developer.hashicorp.com/terraform/install) 1.5 o superior
y Docker en ejecución.

```bash
# 1. Construir las imágenes (desde la raíz del repositorio)
bash infra/build-images.sh

# 2. Terraform
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # completa los valores

terraform init
terraform fmt -check -recursive
terraform validate
terraform plan
terraform apply        # crea redes, volumen y contenedores
```

Las imágenes se construyen con `docker build` (BuildKit) y no con Terraform: construirlas desde
el proveedor era muy lento (más de 20 minutos frente a ~90 segundos) y agotaba el plazo.
Terraform solo las lee del Docker local, así que **`plan` y `apply` fallan con "did not find
docker image" si no ejecutaste antes `build-images.sh`**. Vuelve a ejecutarlo cada vez que cambies
el código y luego `terraform apply` para que los contenedores usen la imagen nueva.

Al terminar, `terraform output` muestra las URL. Comprueba el estado con
`curl http://localhost:8100/health/ready`.

Para eliminarlo todo: `terraform destroy`.

**Windows.** Con Docker Desktop, define `docker_host = "npipe:////./pipe/docker_engine"`
en `terraform.tfvars` (ya viene en el ejemplo).

Después del primer `terraform init`, sube a git el archivo `.terraform.lock.hcl`
para que todos usen exactamente la misma versión del proveedor.

## Advertencias

- **El archivo de estado contiene los secretos en texto plano.** `*.tfstate` está en el
  `.gitignore`; no lo subas ni lo compartas.
- Si cambias `backend_port`, reconstruye el frontend con `BACKEND_PORT=<puerto> bash infra/build-images.sh`:
  esa URL se incorpora a la imagen al construirla.
- Los puertos 3100 y 8100 se eligieron para no chocar con `docker-compose` (3000 y 8000).
- El proveedor se fija en la versión **3.6.2**: desde la 3.7.0 se firma con una clave
  que el registro de HashiCorp no acepta.

## Evolución a la nube

La estructura separa variables, recursos y salidas. Para llevar el ambiente a un proveedor
de nube bastaría con reemplazar los recursos `docker_*` de `main.tf` por los equivalentes del
proveedor elegido, manteniendo las variables y las salidas.
