provider "docker" {
  # null = usar DOCKER_HOST o el valor por defecto del sistema.
  # En Windows con Docker Desktop: "npipe:////./pipe/docker_engine".
  host = var.docker_host
}
