variable "docker_host" {
  description = "Socket del daemon de Docker. En Windows: npipe:////./pipe/docker_engine. Si es null se usa el valor por defecto."
  type        = string
  default     = null
}

variable "environment" {
  description = "Nombre del ambiente."
  type        = string
  default     = "staging"
}

variable "name_prefix" {
  description = "Prefijo para los nombres de contenedores, redes, volúmenes e imágenes."
  type        = string
  default     = "exchangehub-staging"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*$", var.name_prefix))
    error_message = "name_prefix solo admite minúsculas, números y guiones."
  }
}

variable "frontend_port" {
  description = "Puerto local donde se publica el frontend. Distinto del 3000 para no chocar con docker-compose."
  type        = number
  default     = 3100

  validation {
    condition     = var.frontend_port >= 1024 && var.frontend_port <= 65535
    error_message = "frontend_port debe estar entre 1024 y 65535."
  }
}

variable "backend_port" {
  description = "Puerto local donde se publica el backend. Distinto del 8000 para no chocar con docker-compose."
  type        = number
  default     = 8100

  validation {
    condition     = var.backend_port >= 1024 && var.backend_port <= 65535
    error_message = "backend_port debe estar entre 1024 y 65535."
  }
}

variable "postgres_image" {
  description = "Imagen de PostgreSQL."
  type        = string
  default     = "postgres:16"
}

variable "postgres_user" {
  description = "Usuario de PostgreSQL."
  type        = string
  default     = "exchangehub"
}

variable "postgres_db" {
  description = "Nombre de la base de datos."
  type        = string
  default     = "exchangehubdb"
}

variable "postgres_password" {
  description = "Contraseña de PostgreSQL. Se pasa por terraform.tfvars o TF_VAR_postgres_password; nunca en el código."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.postgres_password) >= 12
    error_message = "postgres_password debe tener al menos 12 caracteres."
  }
}

variable "jwt_secret" {
  description = "Secreto para firmar los JWT del backend (mínimo 32 caracteres)."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "jwt_secret debe tener al menos 32 caracteres."
  }
}

variable "jwt_expires_in_seconds" {
  description = "Duración de los tokens de acceso, en segundos."
  type        = number
  default     = 3600
}

variable "pipeline_contact" {
  description = "Contacto que se incluye en el User-Agent de las descargas (correo o URL del proyecto)."
  type        = string
  default     = "sin-contacto-configurado"
}

variable "ingestion_interval_hours" {
  description = "Cada cuántas horas se revisan las fuentes de datos. 0 desactiva la revisión automática."
  type        = number
  default     = 0

  validation {
    condition     = var.ingestion_interval_hours >= 0
    error_message = "ingestion_interval_hours no puede ser negativo."
  }
}
