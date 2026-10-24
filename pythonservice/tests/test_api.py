import httpx
import pytest
from fastapi.testclient import TestClient

from main import app, get_http_client, get_settings
from pipeline.settings import Settings
from tests.conftest import make_client, online_routes

URL = "/v1/pipeline/universities/run"


@pytest.fixture
def api():
    app.dependency_overrides[get_settings] = lambda: Settings(backoff_seconds=0, retries=1)
    app.dependency_overrides[get_http_client] = lambda: make_client(online_routes)
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


def test_run_default_sources(api):
    response = api.post(URL, json={})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["quality"]["catalog_valid"] == 128
    assert len(body["universities"]) == 128
    assert body["universities"][0]["provenance"][0]["source"] == "mineduc_ies"


def test_run_catalog_only(api):
    body = api.post(URL, json={"sources": ["mineduc_ies"]}).json()
    assert [s["code"] for s in body["sources"]] == ["mineduc_ies"]


def test_unknown_source_is_422(api):
    response = api.post(URL, json={"sources": ["mineduc_ies", "otra"]})
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "Datos inválidos"


def test_catalog_required_is_422(api):
    assert api.post(URL, json={"sources": ["wikidata"]}).status_code == 422


def test_source_down_is_reported_in_body_not_as_http_error(api):
    app.dependency_overrides[get_http_client] = lambda: make_client(lambda r: httpx.Response(500))
    response = api.post(URL, json={})
    assert response.status_code == 200
    assert response.json()["status"] == "failed"


def test_openapi_documents_the_endpoint(api):
    op = api.get("/openapi.json").json()["paths"][URL]["post"]
    assert op["summary"] and "PipelineResult" in str(op["responses"]["200"])
