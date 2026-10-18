#!/usr/bin/env bash
# Construye las imágenes del ambiente de staging con BuildKit (docker build).
# Ejecútalo ANTES de `terraform plan` / `terraform apply`:
#
#   bash infra/build-images.sh
#
# Variables opcionales (deben coincidir con las de Terraform):
#   NAME_PREFIX   prefijo de las imágenes   (por defecto: exchangehub-staging)
#   BACKEND_PORT  puerto público del backend (por defecto: 8100). El frontend lo
#                 incorpora al construirse, así que si lo cambias hay que reconstruir.
set -euo pipefail

PREFIX="${NAME_PREFIX:-exchangehub-staging}"
BACKEND_PORT="${BACKEND_PORT:-8100}"

# Trabajar desde la raíz del repositorio, esté donde esté el script.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

build() {
  local name="$1" context="$2"
  shift 2
  echo "==> Construyendo ${PREFIX}/${name}:local"
  docker build --tag "${PREFIX}/${name}:local" "$@" "${context}"
}

build backend backend
build python-service pythonservice
build frontend frontend --build-arg "NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}"

echo "Imágenes listas. Ahora puedes ejecutar terraform plan / apply en infra/terraform."
