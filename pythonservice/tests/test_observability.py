import json
import logging
import re

import httpx
import pytest
from fastapi.testclient import TestClient

from main import app
from observability import JsonFormatter, configure_logging, current_request_id
from pipeline.runner import run_universities_pipeline
from pipeline.settings import Settings
from tests.conftest import make_client, online_routes

client = TestClient(app, raise_server_exceptions=False)
UUID = re.compile(r"^[0-9a-f-]{36}$")


def http_records(caplog):
    return [r for r in caplog.records if r.name == "pythonservice.http"]


def test_response_carries_a_generated_request_id():
    response = client.get("/health")
    assert UUID.match(response.headers["x-request-id"])


def test_valid_request_id_from_nestjs_is_kept():
    response = client.get("/health", headers={"X-Request-Id": "traza-nestjs-001"})
    assert response.headers["x-request-id"] == "traza-nestjs-001"


@pytest.mark.parametrize("bad", ["corto", "tiene espacios y caracteres / raros", "a" * 80])
def test_invalid_request_id_is_replaced(bad):
    response = client.get("/health", headers={"X-Request-Id": bad})
    assert UUID.match(response.headers["x-request-id"])


def test_request_is_logged_with_route_template_status_and_duration(caplog):
    caplog.set_level(logging.DEBUG)
    client.get("/?secreto=1", headers={"X-Request-Id": "traza-0000001"})
    (record,) = http_records(caplog)
    assert record.route == "/" and record.status == 200
    assert record.path == "/" and "secreto" not in json.dumps(record.__dict__, default=str)
    assert record.duration_ms >= 0


def test_client_errors_are_warnings_and_server_errors_are_errors(caplog):
    caplog.set_level(logging.DEBUG)
    client.get("/no-existe")
    client.post("/v1/pipeline/universities/run", json={"sources": ["wikidata"]})
    levels = {r.route: r.levelno for r in http_records(caplog)}
    assert levels["no-encontrada"] == logging.WARNING
    assert levels["/v1/pipeline/universities/run"] == logging.WARNING


def test_health_checks_are_logged_only_at_debug(caplog):
    caplog.set_level(logging.INFO)
    client.get("/health")
    assert http_records(caplog) == []


def test_unhandled_error_is_logged_and_still_returns_the_id(caplog):
    caplog.set_level(logging.DEBUG)

    @app.get("/boom-obs")
    def boom():
        raise RuntimeError("secreto interno")

    response = client.get("/boom-obs", headers={"X-Request-Id": "traza-error-001"})
    assert response.status_code == 500
    assert response.headers["x-request-id"] == "traza-error-001"
    assert "secreto interno" not in response.text
    assert any(r.levelno == logging.ERROR for r in http_records(caplog))


def test_request_id_is_not_leaked_outside_the_request():
    client.get("/health", headers={"X-Request-Id": "traza-fuera-001"})
    assert current_request_id() is None


def test_json_formatter_includes_extra_fields_and_request_id():
    record = logging.LogRecord("ctx", logging.WARNING, "f.py", 1, "hola %s", ("mundo",), None)
    record.source = "wikidata"
    line = JsonFormatter().format(record)
    data = json.loads(line)
    assert data["level"] == "warn" and data["context"] == "ctx"
    assert data["message"] == "hola mundo" and data["source"] == "wikidata"
    assert "requestId" in data and "\n" not in line


def test_configure_logging_writes_json_to_stdout(capsys):
    root = logging.getLogger()
    saved, level = root.handlers[:], root.level
    try:
        configure_logging("INFO")
        logging.getLogger("prueba").info("evento")
        out = capsys.readouterr().out.strip()
        assert json.loads(out)["message"] == "evento"
    finally:
        root.handlers, root.level = saved, level


def test_pipeline_logs_a_warning_for_a_failed_external_source(caplog):
    def routes(request: httpx.Request) -> httpx.Response:
        if "sparql" in str(request.url):
            return httpx.Response(503)
        return online_routes(request)

    caplog.set_level(logging.INFO)
    run_universities_pipeline(
        ["mineduc_ies", "wikidata"],
        Settings(backoff_seconds=0, retries=1),
        make_client(routes),
        sleep=lambda s: None,
    )
    problems = [r for r in caplog.records if r.getMessage() == "source_problem"]
    assert [p.source for p in problems] == ["wikidata"]
    assert problems[0].levelno == logging.WARNING and problems[0].error
    assert any(r.getMessage() == "source_ok" and r.source == "mineduc_ies" for r in caplog.records)
    assert any(r.getMessage() == "pipeline_finished" for r in caplog.records)
