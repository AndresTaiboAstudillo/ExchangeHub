"""Descarga HTTP con reintentos, backoff exponencial y tope de tamaño."""

import time
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from .errors import SourceUnavailable

RETRY_STATUS = {429, 500, 502, 503, 504}
MAX_RETRY_AFTER = 30.0


@dataclass(frozen=True)
class Fetched:
    content: bytes
    url: str
    elapsed_ms: int


def _retry_after(response: httpx.Response) -> float | None:
    value = response.headers.get("Retry-After")
    if value is None:
        return None
    try:
        return min(max(float(value), 0.0), MAX_RETRY_AFTER)
    except ValueError:
        return None


def fetch(
    client: httpx.Client,
    url: str,
    *,
    source: str,
    params: dict | None = None,
    headers: dict | None = None,
    retries: int = 3,
    backoff: float = 1.0,
    max_bytes: int = 5_000_000,
    sleep: Callable[[float], None] = time.sleep,
) -> Fetched:
    """GET con reintentos. Falla rápido en 4xx; lanza SourceUnavailable al agotar intentos."""
    started = time.monotonic()
    last_error = "sin intentos"
    attempts = max(1, retries)
    for attempt in range(attempts):
        wait = backoff * (2**attempt)
        try:
            response = client.get(url, params=params, headers=headers)
        except httpx.HTTPError as exc:
            last_error = f"error de red ({type(exc).__name__})"
        else:
            if response.status_code in RETRY_STATUS:
                last_error = f"HTTP {response.status_code}"
                wait = _retry_after(response) or wait
            elif response.status_code >= 400:
                raise SourceUnavailable(source, f"HTTP {response.status_code} en {url}")
            else:
                if len(response.content) > max_bytes:
                    raise SourceUnavailable(source, f"respuesta demasiado grande (> {max_bytes} B)")
                elapsed = int((time.monotonic() - started) * 1000)
                return Fetched(response.content, str(response.url), elapsed)
        if attempt < attempts - 1:
            sleep(wait)
    raise SourceUnavailable(source, f"{last_error} tras {attempts} intentos")
