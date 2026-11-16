"""Pipeline de comercios y servicios (OpenStreetMap)."""

import json
import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime

import httpx

from . import osm
from .errors import SourceFormatError, SourceUnavailable
from .http import fetch
from .models import PlaceOut, PlacesResult
from .settings import Settings

logger = logging.getLogger("pipeline.places")


def run_places_pipeline(
    bbox: tuple[float, float, float, float] | None,
    settings: Settings,
    client: httpx.Client,
    *,
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    sleep: Callable[[float], None] = time.sleep,
) -> PlacesResult:
    """Una sola consulta a Overpass (respeta su política de uso) y normaliza el resultado."""
    box = bbox or osm.DEFAULT_BBOX
    result = PlacesResult(status="failed")
    started = time.monotonic()
    try:
        fetched = None
        failures: list[str] = []
        for endpoint in settings.overpass_endpoints:
            try:
                fetched = fetch(
                    client,
                    endpoint,
                    source=osm.SOURCE,
                    params={"data": osm.build_query(box)},
                    headers={"User-Agent": settings.user_agent, "Accept": "application/json"},
                    # El siguiente servidor de la lista hace de reintento.
                    retries=1,
                    timeout=settings.overpass_read_timeout,
                    backoff=settings.backoff_seconds,
                    max_bytes=20_000_000,
                    sleep=sleep,
                )
                result.url = endpoint
                break
            except SourceUnavailable as exc:
                failures.append(f"{endpoint}: {exc.reason}")
                logger.warning("overpass_endpoint_failed", extra={"endpoint": endpoint})
        if fetched is None:
            raise SourceUnavailable(
                osm.SOURCE, "; ".join(failures) or "sin servidores configurados"
            )
        result.fetched_at = clock()
        try:
            payload = json.loads(fetched.content)
        except ValueError as exc:
            raise SourceFormatError(osm.SOURCE, "la respuesta no es JSON válido") from exc
        parsed = osm.parse_overpass(payload)
    except (SourceUnavailable, SourceFormatError) as exc:
        result.error = exc.reason
        result.elapsed_ms = int((time.monotonic() - started) * 1000)
        logger.warning("places_failed", extra={"source": osm.SOURCE, "error": exc.reason})
        return result

    result.status = "ok"
    result.records_received = parsed.received
    result.records_valid = len(parsed.places)
    result.records_rejected = len(parsed.rejected)
    result.duplicates_discarded = parsed.duplicates
    result.places = [PlaceOut(**p.__dict__, content_hash=p.record_hash()) for p in parsed.places]
    result.elapsed_ms = int((time.monotonic() - started) * 1000)
    logger.info(
        "places_ok",
        extra={
            "source": osm.SOURCE,
            "valid": result.records_valid,
            "rejected": result.records_rejected,
        },
    )
    return result
