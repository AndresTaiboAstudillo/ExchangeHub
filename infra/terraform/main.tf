locals {
  root         = "${path.module}/../.."
  frontend_url = "http://localhost:${var.frontend_port}"
  backend_url  = "http://localhost:${var.backend_port}"

  labels = {
    "com.exchangehub.environment" = var.environment
    "com.exchangehub.managed-by"  = "terraform"
  }
}

# ───────────────────────── Redes ─────────────────────────
# "internal": sin acceso desde fuera de Docker. Solo la ven el backend, Postgres y Python.
# "public": la comparten el backend y el frontend.
# Así el frontend no puede llegar ni a la base de datos ni al servicio Python.

resource "docker_network" "internal" {
  name     = "${var.name_prefix}-internal"
  internal = true
}

resource "docker_network" "public" {
  name = "${var.name_prefix}-public"
}

# "egress": red NO interna, con salida a internet. Solo la usa python-service para descargar
# las fuentes de datos (Mineduc y Wikidata). No publica puertos, así que nada entra por aquí.
resource "docker_network" "egress" {
  name = "${var.name_prefix}-egress"
}

resource "docker_volume" "postgres_data" {
  name = "${var.name_prefix}-postgres-data"
}

# ───────────────────────── Imágenes ─────────────────────────
# Postgres se descarga de Docker Hub. Las imágenes de la aplicación se construyen ANTES con
# infra/build-images.sh (BuildKit) y aquí solo se leen del Docker local: construirlas desde
# el proveedor de Terraform resultó muy lento y se agotaba el plazo.

resource "docker_image" "postgres" {
  name         = var.postgres_image
  keep_locally = true
}

data "docker_image" "backend" {
  name = "${var.name_prefix}/backend:local"
}

data "docker_image" "python_service" {
  name = "${var.name_prefix}/python-service:local"
}

data "docker_image" "frontend" {
  name = "${var.name_prefix}/frontend:local"
}

# ───────────────────────── Contenedores ─────────────────────────

resource "docker_container" "postgres" {
  name    = "${var.name_prefix}-postgres"
  image   = docker_image.postgres.image_id
  restart = "unless-stopped"

  env = [
    "POSTGRES_USER=${var.postgres_user}",
    "POSTGRES_PASSWORD=${var.postgres_password}",
    "POSTGRES_DB=${var.postgres_db}",
  ]

  networks_advanced {
    name    = docker_network.internal.name
    aliases = ["postgres"]
  }

  volumes {
    volume_name    = docker_volume.postgres_data.name
    container_path = "/var/lib/postgresql/data"
  }

  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U ${var.postgres_user} -d ${var.postgres_db}"]
    interval = "5s"
    timeout  = "3s"
    retries  = 10
  }

  wait         = true
  wait_timeout = 120

  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_container" "python_service" {
  name    = "${var.name_prefix}-python-service"
  image   = data.docker_image.python_service.id
  restart = "unless-stopped"

  env = [
    "PIPELINE_CONTACT=${var.pipeline_contact}",
  ]

  # Sin "ports": solo es alcanzable desde la red interna (la ve el backend, no el frontend).
  networks_advanced {
    name    = docker_network.internal.name
    aliases = ["python-service"]
  }

  # Salida a internet para recuperar las fuentes de datos.
  networks_advanced {
    name = docker_network.egress.name
  }

  wait         = true
  wait_timeout = 60

  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_container" "backend" {
  name    = "${var.name_prefix}-backend"
  image   = data.docker_image.backend.id
  restart = "unless-stopped"

  env = [
    "DATABASE_URL=postgresql://${urlencode(var.postgres_user)}:${urlencode(var.postgres_password)}@postgres:5432/${var.postgres_db}",
    "PORT=8000",
    "JWT_SECRET=${var.jwt_secret}",
    "JWT_EXPIRES_IN_SECONDS=${var.jwt_expires_in_seconds}",
    "FRONTEND_ORIGIN=${local.frontend_url}",
    "PYTHON_SERVICE_URL=http://python-service:8001",
    "PYTHON_PIPELINE_TIMEOUT_MS=120000",
    "INGESTION_INTERVAL_HOURS=${var.ingestion_interval_hours}",
  ]

  # El backend es el único servicio conectado a las dos redes.
  networks_advanced {
    name    = docker_network.internal.name
    aliases = ["backend"]
  }

  networks_advanced {
    name = docker_network.public.name
  }

  ports {
    internal = 8000
    external = var.backend_port
    ip       = "127.0.0.1"
  }

  wait         = true
  wait_timeout = 180

  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }

  depends_on = [
    docker_container.postgres,
    docker_container.python_service,
  ]
}

resource "docker_container" "frontend" {
  name    = "${var.name_prefix}-frontend"
  image   = data.docker_image.frontend.id
  restart = "unless-stopped"

  # Solo en la red pública: no ve a Postgres ni a Python.
  networks_advanced {
    name = docker_network.public.name
  }

  ports {
    internal = 3000
    external = var.frontend_port
    ip       = "127.0.0.1"
  }

  dynamic "labels" {
    for_each = local.labels
    content {
      label = labels.key
      value = labels.value
    }
  }

  depends_on = [docker_container.backend]
}
