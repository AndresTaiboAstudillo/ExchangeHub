output "frontend_url" {
  description = "URL del frontend."
  value       = local.frontend_url
}

output "backend_url" {
  description = "URL del backend."
  value       = local.backend_url
}

output "health_check_url" {
  description = "Endpoint de salud: comprueba backend, base de datos y servicio Python."
  value       = "${local.backend_url}/health/ready"
}

output "networks" {
  description = "Redes creadas: internal (aislada) y public."
  value = {
    internal = docker_network.internal.name
    public   = docker_network.public.name
  }
}

output "containers" {
  description = "Nombres de los contenedores del ambiente."
  value = {
    frontend       = docker_container.frontend.name
    backend        = docker_container.backend.name
    python_service = docker_container.python_service.name
    postgres       = docker_container.postgres.name
  }
}
