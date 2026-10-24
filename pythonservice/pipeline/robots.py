"""Respeto de robots.txt para las páginas que se descargan (no para APIs documentadas).

Reglas (RFC 9309): si robots.txt no existe (4xx) se permite todo; si no se puede leer por un error
del servidor o de red, se asume que NO está permitido (criterio conservador).
"""

import time
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

MAX_ROBOTS_BYTES = 500 * 1024


@dataclass(frozen=True)
class _Policy:
    mode: str  # allow_all | disallow_all | rules
    reason: str = ""
    parser: RobotFileParser | None = None


class RobotsChecker:
    def __init__(
        self,
        client: httpx.Client,
        agent_token: str,
        *,
        retries: int = 2,
        backoff: float = 1.0,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self._client = client
        self._token = agent_token
        self._retries = max(1, retries)
        self._backoff = backoff
        self._sleep = sleep
        self._cache: dict[str, _Policy] = {}

    def allowed(self, url: str) -> tuple[bool, str]:
        """(permitido, motivo). El motivo solo se llena cuando no está permitido."""
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._cache:
            self._cache[origin] = self._load(origin)
        policy = self._cache[origin]
        if policy.mode == "allow_all":
            return True, ""
        if policy.mode == "disallow_all":
            return False, policy.reason
        if policy.parser is not None and policy.parser.can_fetch(self._token, url):
            return True, ""
        return False, f"robots.txt de {parts.netloc} no permite {parts.path or '/'}"

    def _load(self, origin: str) -> _Policy:
        reason = "sin intentos"
        for attempt in range(self._retries):
            try:
                response = self._client.get(f"{origin}/robots.txt")
            except httpx.HTTPError as exc:
                reason = f"no se pudo leer robots.txt de {origin} ({type(exc).__name__})"
            else:
                status = response.status_code
                if status == 200:
                    parser = RobotFileParser()
                    text = response.content[:MAX_ROBOTS_BYTES].decode("utf-8", errors="replace")
                    parser.parse(text.splitlines())
                    return _Policy("rules", parser=parser)
                if 400 <= status < 500 and status != 429:
                    return _Policy("allow_all")  # no existe o no es público: sin restricciones
                reason = f"no se pudo leer robots.txt de {origin} (HTTP {status})"
            if attempt < self._retries - 1:
                self._sleep(self._backoff * (2**attempt))
        return _Policy("disallow_all", reason=reason)
