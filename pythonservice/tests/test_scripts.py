from datetime import UTC, datetime

import httpx

from pipeline.runner import run_universities_pipeline
from pipeline.settings import Settings
from scripts.run_pipeline import summarize
from tests.conftest import make_client, online_routes


def run(handler):
    return run_universities_pipeline(
        ["mineduc_ies", "wikidata"],
        Settings(backoff_seconds=0, retries=1),
        make_client(handler),
        clock=lambda: datetime(2026, 10, 24, tzinfo=UTC),
        sleep=lambda _s: None,
    )


def test_summary_of_a_good_run():
    text = summarize(run(online_routes))
    assert "Estado: succeeded" in text
    assert "128/128 filas válidas (100.0%)" in text
    assert "Cruzadas con Wikidata: 6 (10.9%)" in text
    assert "Universidades sin cruzar" in text
    assert "edición 2026-05" in text


def test_summary_of_a_failed_run_shows_the_reason():
    text = summarize(run(lambda r: httpx.Response(503)))
    assert "Estado: failed" in text
    assert "mineduc_ies: unavailable" in text
    assert "wikidata: skipped" in text
