import os
from datetime import UTC, datetime
from pathlib import Path

import httpx

from pipeline.runner import run_universities_pipeline
from pipeline.settings import Settings
from tests.conftest import (
    CATALOG_FILE,
    CATALOG_PAGE,
    SPARQL,
    fixture_bytes,
    make_client,
    online_routes,
)

SETTINGS = Settings(backoff_seconds=0, retries=2)
BOTH = ["mineduc_ies", "wikidata"]
FIXED = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)


def run(handler, sources=BOTH):
    return run_universities_pipeline(
        sources, SETTINGS, make_client(handler), clock=lambda: FIXED, sleep=lambda s: None
    )


def routes_with(**overrides):
    """Como online_routes, pero con respuestas a medida para algunas URL (por prefijo)."""

    def handler(request):
        url = str(request.url)
        for prefix, response in overrides.items():
            if url.startswith(prefix):
                return response(request) if callable(response) else response
        return online_routes(request)

    return handler


def test_full_run_succeeds_and_links_wikidata():
    result = run(online_routes)
    assert result.status == "succeeded"
    assert [s.status for s in result.sources] == ["ok", "ok"]
    assert result.sources[0].edition == "2026-05"
    assert result.sources[0].fetched_at == FIXED
    q = result.quality
    assert (q.catalog_rows, q.catalog_valid, q.pct_valid) == (128, 128, 1.0)
    assert q.universities_in_catalog == 55
    assert q.matched == 6 and q.match_rate == 0.1091
    assert q.with_website == 6 and q.with_coordinates == 4
    uai = next(u for u in result.universities if u.registry_number == "C26")
    assert uai.wikidata_id == "Q611995" and uai.website == "https://www.uai.cl"
    assert [p.source for p in uai.provenance] == ["mineduc_ies", "wikidata"]
    assert uai.provenance[1].url == "https://www.wikidata.org/wiki/Q611995"


def test_catalog_only_run():
    result = run(online_routes, sources=["mineduc_ies"])
    assert result.status == "succeeded"
    assert len(result.sources) == 1
    assert result.quality.matched == 0 and result.quality.wikidata_entities == 0


def test_wikidata_down_gives_partial_and_keeps_catalog():
    result = run(routes_with(**{SPARQL: httpx.Response(503)}))
    assert result.status == "partial"
    assert result.sources[1].status == "unavailable"
    assert len(result.universities) == 128
    assert all(u.wikidata_id is None for u in result.universities)


def test_wikidata_invalid_json_is_invalid_format():
    result = run(routes_with(**{SPARQL: httpx.Response(200, content=b"<html>")}))
    assert result.status == "partial"
    assert result.sources[1].status == "invalid_format"


def test_catalog_down_fails_and_skips_wikidata():
    down = httpx.Response(500)
    result = run(
        routes_with(**{CATALOG_PAGE: down, CATALOG_FILE: down, SETTINGS.catalog_fallback_url: down})
    )
    assert result.status == "failed"
    assert [s.status for s in result.sources] == ["unavailable", "skipped"]
    assert result.universities == [] and result.quality.catalog_rows == 0


def test_catalog_not_an_excel_is_unavailable_with_reason():
    result = run(routes_with(**{CATALOG_FILE: httpx.Response(200, content=b"no es excel")}))
    assert result.status == "failed"
    assert result.sources[0].status == "unavailable"
    assert "no es un archivo Excel" in result.sources[0].error


def test_catalog_corrupt_zip_is_invalid_format():
    corrupt = b"PK\x03\x04" + b"basura" * 20
    result = run(routes_with(**{CATALOG_FILE: httpx.Response(200, content=corrupt)}))
    assert result.status == "failed"
    assert result.sources[0].status == "invalid_format"


def test_ficha_down_falls_back_to_configured_url_with_note():
    result = run(routes_with(**{CATALOG_PAGE: httpx.Response(503)}), sources=["mineduc_ies"])
    assert result.status == "succeeded"
    notes = result.sources[0].notes
    assert any("ficha no disponible" in n for n in notes)
    assert not any("no se encontró" in n for n in notes)  # no se culpa a la ficha dos veces


def test_ficha_without_file_link_falls_back():
    page = httpx.Response(200, content=b"<html>sin enlaces</html>")
    result = run(routes_with(**{CATALOG_PAGE: page}), sources=["mineduc_ies"])
    assert result.status == "succeeded"
    assert any("no se encontró" in n for n in result.sources[0].notes)


def test_content_hash_changes_when_source_changes():
    a = run(online_routes).sources[0].content_hash
    b = run(
        routes_with(
            **{
                CATALOG_FILE: httpx.Response(
                    200, content=fixture_bytes("ies_vig_may_26.xlsx") + b"0"
                )
            }
        )
    ).sources[0]
    assert b.status == "invalid_format" or b.content_hash != a


def test_identical_runs_produce_identical_record_hashes():
    first, second = run(online_routes), run(online_routes)
    assert [u.provenance[0].content_hash for u in first.universities] == [
        u.provenance[0].content_hash for u in second.universities
    ]


ROBOTS = "https://www.ayudamineduc.cl/robots.txt"
ROBOTS_FALLBACK = "https://ayudamineduc.cl/robots.txt"
BLOCK_ALL = httpx.Response(200, content=b"User-agent: *\nDisallow: /")
BLOCK_FICHA = httpx.Response(200, content=b"User-agent: *\nDisallow: /ficha")


def test_robots_blocking_the_ficha_falls_back_to_configured_url():
    result = run(routes_with(**{ROBOTS: BLOCK_FICHA}), sources=["mineduc_ies"])
    assert result.status == "succeeded"
    assert any("ficha no leída" in n for n in result.sources[0].notes)
    # La ficha ni siquiera se pidió: se respetó robots.txt.


def test_robots_blocking_the_ficha_does_not_request_it():
    seen: list[str] = []

    def spy(request):
        seen.append(str(request.url))
        return routes_with(**{ROBOTS: BLOCK_FICHA})(request)

    run(spy, sources=["mineduc_ies"])
    assert not any("/ficha/" in u for u in seen)


def test_robots_blocking_the_file_fails_with_clear_reason_and_hint():
    result = run(
        routes_with(**{ROBOTS: BLOCK_ALL, ROBOTS_FALLBACK: BLOCK_ALL}), sources=["mineduc_ies"]
    )
    assert result.status == "failed"
    error = result.sources[0].error
    assert "no permitida" in error and "MINEDUC_CATALOG_FILE" in error


def test_robots_blocking_never_downloads_the_file():
    seen: list[str] = []

    def spy(request):
        seen.append(str(request.url))
        return routes_with(**{ROBOTS: BLOCK_ALL, ROBOTS_FALLBACK: BLOCK_ALL})(request)

    run(spy, sources=["mineduc_ies"])
    assert not any(u.endswith(".xlsx") for u in seen)


def test_blocked_download_uses_local_file_with_its_own_date(tmp_path: Path):
    local = tmp_path / "ies_vig_may_26.xlsx"
    local.write_bytes(fixture_bytes("ies_vig_may_26.xlsx"))
    os.utime(local, (1_780_000_000, 1_780_000_000))  # 2026-05-28
    settings = Settings(backoff_seconds=0, retries=1, catalog_file=str(local))
    result = run_universities_pipeline(
        ["mineduc_ies"],
        settings,
        make_client(routes_with(**{ROBOTS: BLOCK_ALL, ROBOTS_FALLBACK: BLOCK_ALL})),
        clock=lambda: FIXED,
        sleep=lambda s: None,
    )
    status = result.sources[0]
    assert result.status == "succeeded" and status.status == "ok"
    assert status.edition == "2026-05" and status.url == "file:ies_vig_may_26.xlsx"
    assert status.fetched_at.year == 2026 and status.fetched_at != FIXED
    assert any("archivo local" in n for n in status.notes)
    assert len(result.universities) == 128


def test_network_failure_also_falls_back_to_local_file(tmp_path: Path):
    local = tmp_path / "catalogo.xlsx"
    local.write_bytes(fixture_bytes("ies_vig_may_26.xlsx"))
    settings = Settings(backoff_seconds=0, retries=1, catalog_file=str(local))
    result = run_universities_pipeline(
        ["mineduc_ies"],
        settings,
        make_client(lambda r: httpx.Response(503)),
        clock=lambda: FIXED,
        sleep=lambda s: None,
    )
    assert result.status == "succeeded"
    assert result.sources[0].edition is None  # el nombre del archivo no indica la edición


def test_missing_local_file_reports_both_failures(tmp_path: Path):
    settings = Settings(backoff_seconds=0, retries=1, catalog_file=str(tmp_path / "no-existe.xlsx"))
    result = run_universities_pipeline(
        ["mineduc_ies"],
        settings,
        make_client(lambda r: httpx.Response(503)),
        clock=lambda: FIXED,
        sleep=lambda s: None,
    )
    assert result.status == "failed"
    assert "tampoco se pudo leer el archivo local" in result.sources[0].error


def test_wikidata_api_is_not_subject_to_page_robots():
    # La API SPARQL es un servicio documentado para uso programático: no se consulta robots.txt.
    seen: list[str] = []

    def spy(request):
        seen.append(str(request.url))
        return online_routes(request)

    run(spy)
    assert not any("query.wikidata.org/robots.txt" in u for u in seen)


def test_maintenance_page_with_200_is_not_taken_for_the_excel(tmp_path: Path):
    local = tmp_path / "ies_vigentes.xlsx"
    local.write_bytes(fixture_bytes("ies_vig_may_26.xlsx"))
    settings = Settings(backoff_seconds=0, retries=1, catalog_file=str(local))
    html = httpx.Response(200, text="<html>Sitio en mantención</html>")
    result = run_universities_pipeline(
        ["mineduc_ies"],
        settings,
        make_client(lambda r: html),
        clock=lambda: FIXED,
        sleep=lambda s: None,
    )
    status = result.sources[0]
    assert result.status == "succeeded" and status.status == "ok"
    assert len(result.universities) == 128
    assert any("no es un archivo Excel" in n for n in status.notes)


def test_maintenance_page_without_local_file_fails_with_clear_reason():
    html = httpx.Response(200, text="<html>Sitio en mantención</html>")
    result = run_universities_pipeline(
        ["mineduc_ies"],
        Settings(backoff_seconds=0, retries=1),
        make_client(lambda r: html),
        clock=lambda: FIXED,
        sleep=lambda s: None,
    )
    assert result.status == "failed"
    assert "no es un archivo Excel" in result.sources[0].error
