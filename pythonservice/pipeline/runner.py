"""Orquestación del pipeline: recuperar → validar → limpiar → cruzar → medir calidad."""

import hashlib
import json
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import httpx

from . import catalog, wikidata
from .errors import SourceFormatError, SourceUnavailable
from .http import fetch
from .matching import match_entities
from .models import (
    PipelineResult,
    Provenance,
    QualityReport,
    Rejected,
    SourceStatus,
    UniversityRecord,
)
from .robots import RobotsChecker
from .settings import Settings

SAMPLE_SIZE = 10
XLSX_SIGNATURE = b"PK\x03\x04"  # un .xlsx es un ZIP
ROBOTS_AGENT = "ExchangeHubBot"


def _now() -> datetime:
    return datetime.now(UTC)


def _ratio(num: int, den: int) -> float:
    return round(num / den, 4) if den else 0.0


def _local_catalog(
    settings: Settings, failure: str, status: SourceStatus
) -> tuple[bytes, str, datetime]:
    """Excel descargado a mano (MINEDUC_CATALOG_FILE): salida cuando la descarga no es posible."""
    hint = "alternativa: descargar el Excel a mano y configurar MINEDUC_CATALOG_FILE"
    if not settings.catalog_file:
        raise SourceUnavailable("mineduc_ies", f"{failure} ({hint})")
    path = Path(settings.catalog_file)
    try:
        content = path.read_bytes()
        modified = datetime.fromtimestamp(path.stat().st_mtime, UTC)
    except OSError as exc:
        reason = f"{failure}; tampoco se pudo leer el archivo local ({type(exc).__name__})"
        raise SourceUnavailable("mineduc_ies", reason) from exc
    status.notes.append(f"se usó el archivo local {path.name} ({failure})")
    # La fecha de recuperación es la del archivo, no la de hoy: así la frescura no se exagera.
    return content, f"file:{path.name}", modified


def _retrieve_catalog(
    settings: Settings, client: httpx.Client, clock: Callable[[], datetime], sleep
) -> tuple[SourceStatus, catalog.CatalogParse | None]:
    status = SourceStatus(code="mineduc_ies", status="unavailable")
    started = time.monotonic()
    kw = {"retries": settings.retries, "backoff": settings.backoff_seconds, "sleep": sleep}
    robots = RobotsChecker(
        client,
        ROBOTS_AGENT,
        retries=settings.retries,
        backoff=settings.backoff_seconds,
        sleep=sleep,
    )
    try:
        found = None
        page_ok, why = robots.allowed(settings.catalog_page_url)
        if not page_ok:
            status.notes.append(f"ficha no leída ({why}); se usa la URL configurada")
        else:
            try:
                page = fetch(client, settings.catalog_page_url, source="mineduc_ies", **kw)
            except SourceUnavailable as exc:
                status.notes.append(
                    f"ficha no disponible ({exc.reason}); se usa la URL configurada"
                )
            else:
                found = catalog.discover_latest_url(
                    page.content.decode("utf-8", errors="replace"), page.url
                )
                if found is None:
                    status.notes.append(
                        "no se encontró el archivo en la ficha; se usa la URL configurada"
                    )
        url = found[0] if found else settings.catalog_fallback_url

        content: bytes | None = None
        source_url, fetched_at = url, clock()
        file_ok, why = robots.allowed(url)
        failure = ""
        if not file_ok:
            failure = f"descarga automática no permitida: {why}"
        else:
            try:
                fetched = fetch(client, url, source="mineduc_ies", **kw)
            except SourceUnavailable as exc:
                failure = exc.reason
            else:
                if fetched.content[:4] == XLSX_SIGNATURE:
                    content, source_url, fetched_at = fetched.content, fetched.url, clock()
                else:
                    # Un sitio en mantención suele responder 200 con una página HTML.
                    failure = "la descarga no es un archivo Excel (¿sitio en mantención?)"
        if content is None:
            content, source_url, fetched_at = _local_catalog(settings, failure, status)

        status.url = source_url
        status.fetched_at = fetched_at
        status.content_hash = hashlib.sha256(content).hexdigest()
        status.edition = catalog.edition_from_url(source_url)
        parsed = catalog.parse_catalog(content, fetched_at=fetched_at, url=source_url)
    except SourceUnavailable as exc:
        status.status, status.error = "unavailable", exc.reason
        status.elapsed_ms = int((time.monotonic() - started) * 1000)
        return status, None
    except SourceFormatError as exc:
        status.status, status.error = "invalid_format", exc.reason
        status.elapsed_ms = int((time.monotonic() - started) * 1000)
        return status, None

    status.status = "ok"
    status.records_received = parsed.rows_received
    status.records_valid = len(parsed.records)
    status.records_rejected = len(parsed.rejected)
    status.duplicates_discarded = parsed.duplicates_discarded
    status.elapsed_ms = int((time.monotonic() - started) * 1000)
    return status, parsed


def _retrieve_wikidata(
    settings: Settings, client: httpx.Client, clock: Callable[[], datetime], sleep
) -> tuple[SourceStatus, wikidata.WikidataParse | None]:
    status = SourceStatus(code="wikidata", status="unavailable", url=settings.sparql_endpoint)
    started = time.monotonic()
    try:
        fetched = fetch(
            client,
            settings.sparql_endpoint,
            source="wikidata",
            params={"query": wikidata.SPARQL_QUERY, "format": "json"},
            headers={
                "Accept": "application/sparql-results+json",
                "User-Agent": settings.user_agent,
            },
            retries=settings.retries,
            backoff=settings.backoff_seconds,
            sleep=sleep,
        )
        status.fetched_at = clock()
        status.content_hash = hashlib.sha256(fetched.content).hexdigest()
        try:
            payload = json.loads(fetched.content)
        except ValueError as exc:
            raise SourceFormatError("wikidata", "la respuesta no es JSON válido") from exc
        parsed = wikidata.parse_results(payload, now=status.fetched_at)
    except SourceUnavailable as exc:
        status.status, status.error = "unavailable", exc.reason
        status.elapsed_ms = int((time.monotonic() - started) * 1000)
        return status, None
    except SourceFormatError as exc:
        status.status, status.error = "invalid_format", exc.reason
        status.elapsed_ms = int((time.monotonic() - started) * 1000)
        return status, None

    status.status = "ok"
    status.records_received = parsed.rows_received
    status.records_valid = len(parsed.entities)
    status.notes = parsed.warnings[:SAMPLE_SIZE]
    if len(parsed.warnings) > SAMPLE_SIZE:
        status.notes.append(f"... y {len(parsed.warnings) - SAMPLE_SIZE} advertencias más")
    status.elapsed_ms = int((time.monotonic() - started) * 1000)
    return status, parsed


def _empty_quality(elapsed_ms: int) -> QualityReport:
    return QualityReport(
        catalog_rows=0,
        catalog_valid=0,
        catalog_rejected=0,
        duplicates_discarded=0,
        pct_valid=0.0,
        universities_in_catalog=0,
        wikidata_entities=0,
        matched=0,
        match_rate=0.0,
        with_website=0,
        with_coordinates=0,
        coverage_website=0.0,
        coverage_coordinates=0.0,
        elapsed_ms=elapsed_ms,
    )


def run_universities_pipeline(
    sources: list[str],
    settings: Settings,
    client: httpx.Client,
    *,
    clock: Callable[[], datetime] = _now,
    sleep: Callable[[float], None] = time.sleep,
) -> PipelineResult:
    started_at = clock()
    t0 = time.monotonic()

    cat_status, cat = _retrieve_catalog(settings, client, clock, sleep)
    statuses = [cat_status]
    if cat is None:
        if "wikidata" in sources:
            skipped = SourceStatus(code="wikidata", status="skipped")
            skipped.notes.append("omitida: el catálogo base no está disponible")
            statuses.append(skipped)
        elapsed = int((time.monotonic() - t0) * 1000)
        return PipelineResult(
            status="failed",
            started_at=started_at,
            finished_at=clock(),
            sources=statuses,
            universities=[],
            rejected=[],
            quality=_empty_quality(elapsed),
        )

    records: list[UniversityRecord] = cat.records
    rejected: list[Rejected] = list(cat.rejected)
    wd: wikidata.WikidataParse | None = None
    matched = 0
    unmatched_cat: list[str] = [r.name for r in records if r.category == "universidad"]
    unmatched_ent: list[str] = []

    if "wikidata" in sources:
        wd_status, wd = _retrieve_wikidata(settings, client, clock, sleep)
        statuses.append(wd_status)
        if wd is not None:
            result = match_entities(records, wd.entities)
            by_number = {r.registry_number: r for r in records}
            for number, (ent, info) in result.matches.items():
                rec = by_number[number]
                rec.wikidata_id = ent.qid
                rec.website = ent.website
                rec.latitude, rec.longitude = ent.latitude, ent.longitude
                rec.founded_year = ent.founded_year
                rec.match = info
                rec.provenance.append(
                    Provenance(
                        source="wikidata",
                        external_id=ent.qid,
                        url=f"https://www.wikidata.org/wiki/{ent.qid}",
                        fetched_at=wd_status.fetched_at or clock(),
                        content_hash=ent.record_hash(),
                    )
                )
            matched = len(result.matches)
            unmatched_cat = result.unmatched_catalog
            unmatched_ent = result.unmatched_entities

    n_univ = sum(1 for r in records if r.category == "universidad")
    with_site = sum(1 for r in records if r.website)
    with_coord = sum(1 for r in records if r.latitude is not None)
    quality = QualityReport(
        catalog_rows=cat.rows_received,
        catalog_valid=len(records),
        catalog_rejected=len(cat.rejected),
        duplicates_discarded=cat.duplicates_discarded,
        pct_valid=_ratio(len(records), cat.rows_received),
        universities_in_catalog=n_univ,
        wikidata_entities=len(wd.entities) if wd else 0,
        matched=matched,
        match_rate=_ratio(matched, n_univ),
        with_website=with_site,
        with_coordinates=with_coord,
        coverage_website=_ratio(with_site, n_univ),
        coverage_coordinates=_ratio(with_coord, n_univ),
        unmatched_catalog_sample=unmatched_cat[:SAMPLE_SIZE],
        unmatched_entities_sample=unmatched_ent[:SAMPLE_SIZE],
        elapsed_ms=int((time.monotonic() - t0) * 1000),
    )
    wanted_wd = "wikidata" in sources
    status = "succeeded" if not wanted_wd or wd is not None else "partial"
    return PipelineResult(
        status=status,
        started_at=started_at,
        finished_at=clock(),
        sources=statuses,
        universities=records,
        rejected=rejected,
        quality=quality,
    )
