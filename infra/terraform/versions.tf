terraform {
  required_version = ">= 1.5.0"

  required_providers {
    docker = {
      source = "kreuzwerker/docker"
      # Se fija la 3.6.2 a propósito: desde la 3.7.0 el proveedor se firma con una
      # clave que el registro de HashiCorp no acepta, y `terraform init` falla.
      version = "3.6.2"
    }
  }
}
