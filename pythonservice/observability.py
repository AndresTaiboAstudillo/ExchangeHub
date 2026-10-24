"""Registros estructurados e identificador de correlación del servicio.

Cada petición recibe (o conserva, si es válido) el `X-Request-Id` que envía NestJS; ese
identificador aparece en todos los registros emitidos mientras se atiende la petición.
"""

import contextvars
import json
import logging
import re
import sys
import time
import uuid
from datetime import UTC, datetime

_REQUEST_ID: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)
_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
_HEADER = b"x-request-id"
_RESERVED = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime"}

access_logger = logging.getLogger("pythonservice.http")


def current_request_id() -> str | None:
    return _REQUEST_ID.get()


class JsonFormatter(logging.Formatter):
    """Una línea JSON por registro. Los campos pasados con `extra=` se incluyen tal cual."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower().replace("warning", "warn"),
            "context": record.name,
            "requestId": current_request_id(),
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["stack"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str = "INFO") -> None:
    """Deja todo el servicio (incluido uvicorn) escribiendo JSON por la salida estándar."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
    # La petición ya la registra RequestContextMiddleware; el acceso de uvicorn la duplicaría.
    access = logging.getLogger("uvicorn.access")
    access.handlers = []
    access.propagate = False


class RequestContextMiddleware:
    """Middleware ASGI: correlación, cabecera de respuesta y registro de cada petición.

    No se registra la query string ni el cuerpo. La ruta que se registra es la plantilla
    (`/v1/pipeline/universities/run`), no la URL completa.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = next((v.decode("latin-1") for k, v in scope["headers"] if k == _HEADER), None)
        request_id = incoming if incoming and _ID_PATTERN.match(incoming) else str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        token = _REQUEST_ID.set(request_id)
        started = time.perf_counter()
        status = 500

        async def send_with_id(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            route = getattr(scope.get("route"), "path", None) or "no-encontrada"
            level = (
                logging.ERROR
                if status >= 500
                else logging.WARNING
                if status >= 400
                else logging.DEBUG
                if route == "/health"
                else logging.INFO
            )
            access_logger.log(
                level,
                "http_request",
                extra={
                    "method": scope["method"],
                    "route": route,
                    "path": scope["path"],
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            _REQUEST_ID.reset(token)
