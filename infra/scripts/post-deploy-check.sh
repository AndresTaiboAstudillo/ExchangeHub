#!/usr/bin/env bash
# Pruebas de salud posteriores al despliegue (staging).
#
#   BACKEND_URL=http://localhost:8100 FRONTEND_URL=http://localhost:3100 \
#     bash infra/scripts/post-deploy-check.sh
#
# Variables:
#   BACKEND_URL    URL del backend           (por defecto http://localhost:8100)
#   FRONTEND_URL   URL del frontend; vacía = se omiten las pruebas del frontend
#   WAIT_SECONDS   espera máxima a que el backend responda (por defecto 120)
#
# Sale con código distinto de cero si cualquier comprobación falla.
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8100}"
FRONTEND_URL="${FRONTEND_URL-http://localhost:3100}"
WAIT_SECONDS="${WAIT_SECONDS:-120}"
FAILED=0

pass() { echo "✓ $*"; }
fail() { echo "✗ $*" >&2; FAILED=1; }

wait_for() {
  local url="$1" deadline=$((SECONDS + WAIT_SECONDS))
  until curl -fsS -o /dev/null --max-time 5 "$url" 2>/dev/null; do
    if ((SECONDS >= deadline)); then return 1; fi
    sleep 3
  done
}

echo "Backend:  ${BACKEND_URL}"
echo "Frontend: ${FRONTEND_URL:-(omitido)}"

# 1. El backend y sus dependencias responden (base de datos y servicio Python).
if wait_for "${BACKEND_URL}/health/ready"; then
  pass "el backend quedó listo en menos de ${WAIT_SECONDS} s"
else
  echo "✗ el backend no quedó listo en ${WAIT_SECONDS} s" >&2
  curl -sS --max-time 5 "${BACKEND_URL}/health/ready" >&2 || true
  exit 1
fi

[ "$(curl -fsS "${BACKEND_URL}/health" | jq -r .status)" = "ok" ] \
  && pass "GET /health responde ok" || fail "GET /health no responde ok"

ready="$(curl -fsS "${BACKEND_URL}/health/ready")"
[ "$(jq -r .checks.database <<<"$ready")" = "up" ] \
  && pass "PostgreSQL conectado" || fail "PostgreSQL no está conectado: ${ready}"
[ "$(jq -r .checks.python <<<"$ready")" = "up" ] \
  && pass "el servicio Python responde" || fail "el servicio Python no responde: ${ready}"

# 2. Correlación: el backend conserva el identificador que recibe.
sent="post-deploy-$(date +%s)"
echoed="$(curl -fsS -D - -o /dev/null -H "X-Request-Id: ${sent}" "${BACKEND_URL}/health" \
  | tr -d '\r' | awk 'tolower($1)=="x-request-id:" {print $2}')"
[ "$echoed" = "$sent" ] \
  && pass "X-Request-Id se conserva" || fail "X-Request-Id no se conserva (recibido: '${echoed}')"

# 3. Frontend: responde y el backend lo acepta por CORS.
if [ -n "$FRONTEND_URL" ]; then
  if wait_for "$FRONTEND_URL"; then
    code="$(curl -sS -o /tmp/frontend-body.$$ -w '%{http_code}' "$FRONTEND_URL")"
    if [ "$code" = "200" ] && grep -q "ExchangeHub" "/tmp/frontend-body.$$"; then
      pass "el frontend responde 200 con la aplicación"
    else
      fail "el frontend respondió ${code} o no contiene la aplicación"
    fi
    rm -f "/tmp/frontend-body.$$"
  else
    fail "el frontend no respondió en ${WAIT_SECONDS} s"
  fi
  cors="$(curl -sS -D - -o /dev/null -H "Origin: ${FRONTEND_URL}" "${BACKEND_URL}/health" \
    | tr -d '\r' | awk 'tolower($1)=="access-control-allow-origin:" {print $2}')"
  [ "$cors" = "$FRONTEND_URL" ] \
    && pass "CORS permite el origen del frontend" \
    || fail "CORS no permite ${FRONTEND_URL} (cabecera: '${cors}')"
fi

# 4. Flujo funcional: registro, login, ruta protegida y consulta de universidades.
json='content-type: application/json'
email="staging-$(date +%s)-$RANDOM@example.com"
password="clave-segura-$RANDOM-$RANDOM"
register="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BACKEND_URL}/auth/register" \
  -H "$json" -d "{\"name\":\"Staging\",\"email\":\"${email}\",\"password\":\"${password}\"}")"
[ "$register" = "201" ] && pass "registro de usuario (201)" || fail "registro respondió ${register}"

token="$(curl -sS -X POST "${BACKEND_URL}/auth/login" -H "$json" \
  -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" | jq -r '.accessToken // empty')"
if [ -n "$token" ]; then
  pass "login entrega un token"
  auth="Authorization: Bearer ${token}"
  [ "$(curl -sS -o /dev/null -w '%{http_code}' "${BACKEND_URL}/users")" = "401" ] \
    && pass "una ruta protegida rechaza peticiones sin token (401)" \
    || fail "una ruta protegida no exige token"
  [ "$(curl -sS -o /dev/null -w '%{http_code}' -H "$auth" "${BACKEND_URL}/users")" = "200" ] \
    && pass "una ruta protegida acepta el token (200)" || fail "la ruta protegida rechazó el token"
  list="$(curl -sS -H "$auth" "${BACKEND_URL}/universities?limit=1")"
  if jq -e '(.items | type == "array") and (.total | type == "number")' >/dev/null <<<"$list"; then
    pass "GET /universities responde con la estructura esperada (total: $(jq -r .total <<<"$list"))"
  else
    fail "GET /universities no responde con la estructura esperada: ${list}"
  fi
  [ "$(curl -sS -o /dev/null -w '%{http_code}' -H "$auth" "${BACKEND_URL}/universities/ingestion-runs")" = "403" ] \
    && pass "las rutas de administración rechazan a un usuario normal (403)" \
    || fail "una ruta de administración no exige rol de administrador"
else
  fail "login no entregó un token"
fi

if [ "$FAILED" -ne 0 ]; then
  echo "Hubo comprobaciones fallidas." >&2
  exit 1
fi
echo "Todas las comprobaciones pasaron."
