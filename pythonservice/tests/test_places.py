import json
from datetime import UTC, datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import main
from pipeline import osm
from pipeline.errors import SourceFormatError
from pipeline.models import PlacesRequest
from pipeline.places import run_places_pipeline
from pipeline.settings import Settings
from tests.conftest import fixture_bytes, make_client

OVERPASS = "https://overpass-api.de/api/interpreter"
NOW = datetime(2026, 11, 12, tzinfo=UTC)


def test_parse_keeps_only_valid_named_places_with_a_point():
    result = osm.parse_overpass(json.loads(fixture_bytes("overpass_places.json")))
    by_id = {p.external_id: p for p in result.places}
    assert result.received == 10
    assert set(by_id) == {"node/101", "way/202", "node/303", "node/304", "relation/408"}
    assert result.duplicates == 1  # node/101 repetido
    assert len(result.rejected) == 4  # sin nombre, categoría no soportada, sin punto, basura


def test_parse_maps_categories_address_and_center_of_ways():
    by_id = {
        p.external_id: p
        for p in osm.parse_overpass(json.loads(fixture_bytes("overpass_places.json"))).places
    }
    assert by_id["node/101"].category == "feria"
    assert by_id["node/101"].opening_hours == "We,Sa 08:00-15:00"
    super_ = by_id["way/202"]
    assert (super_.category, super_.latitude, super_.longitude) == (
        "supermercado",
        -33.0431,
        -71.6162,
    )
    assert super_.address == "Pedro Montt 2001, Valparaíso"
    assert super_.website == "https://www.lider.cl"
    assert by_id["node/303"].website is None  # esquemas no http(s) se descartan
    assert by_id["relation/408"].category == "verduleria"


def test_parse_maps_lodging_categories():
    payload = {
        "elements": [
            {
                "type": "node",
                "id": 1,
                "lat": -33.04,
                "lon": -71.62,
                "tags": {"tourism": "hotel", "name": "Hotel Cerro"},
            },
            {
                "type": "node",
                "id": 2,
                "lat": -33.04,
                "lon": -71.62,
                "tags": {"tourism": "hostel", "name": "Hostal Mar"},
            },
            {
                "type": "way",
                "id": 3,
                "center": {"lat": -33.0, "lon": -71.5},
                "tags": {"tourism": "guest_house", "name": "Casa Sol"},
            },
            {
                "type": "node",
                "id": 4,
                "lat": -33.04,
                "lon": -71.62,
                "tags": {"tourism": "apartment", "name": "Depto Playa"},
            },
            {
                "type": "node",
                "id": 5,
                "lat": -33.04,
                "lon": -71.62,
                "tags": {"tourism": "museum", "name": "Museo"},
            },
        ]
    }
    result = osm.parse_overpass(payload)
    assert {p.name: p.category for p in result.places} == {
        "Hotel Cerro": "hotel",
        "Hostal Mar": "hostal",
        "Casa Sol": "hospedaje",
        "Depto Playa": "hospedaje",
    }
    assert result.rejected == ["node/5: categoría no soportada"]
    assert '"tourism"="hostel"' in osm.build_query(osm.DEFAULT_BBOX)


@pytest.mark.parametrize("payload", [None, [], {}, {"elements": "x"}])
def test_parse_rejects_unexpected_shape(payload):
    with pytest.raises(SourceFormatError):
        osm.parse_overpass(payload)


def test_query_contains_bbox_and_every_category():
    query = osm.build_query((-33.1, -71.7, -33.0, -71.5))
    assert "(-33.1,-71.7,-33.0,-71.5)" in query
    assert "~" not in query  # sin expresiones regulares
    assert '"amenity"="marketplace"' in query and '"shop"="supermarket"' in query
    assert query.endswith("out center tags qt;")
    assert "[timeout:40]" in query


def test_bbox_validation():
    assert PlacesRequest(bbox=None).bbox is None
    assert PlacesRequest(bbox=(-33.1, -71.7, -33.0, -71.5)).bbox is not None
    for bad in [(-33.0, -71.5, -33.1, -71.7), (-34.0, -72.0, -33.0, -71.0), (-95, 0, 0, 10)]:
        with pytest.raises(ValidationError):
            PlacesRequest(bbox=bad)


def _settings():
    return Settings(retries=1, backoff_seconds=0)


def test_pipeline_ok_sends_one_polite_request():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, content=fixture_bytes("overpass_places.json"))

    result = run_places_pipeline(None, _settings(), make_client(handler), clock=lambda: NOW)
    assert result.status == "ok"
    assert (result.records_received, result.records_valid, result.records_rejected) == (10, 5, 4)
    assert len(result.places) == 5 and all(p.content_hash for p in result.places)
    assert len(seen) == 1
    assert str(seen[0].url).startswith(OVERPASS)
    assert "ExchangeHubBot" in seen[0].headers["user-agent"]


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(503),
        httpx.Response(200, content=b"<html>mantenimiento</html>"),
        httpx.Response(200, content=b"{}"),
    ],
)
def test_pipeline_failure_returns_failed_without_places(response):
    result = run_places_pipeline(
        None, _settings(), make_client(lambda r: response), sleep=lambda s: None
    )
    assert result.status == "failed" and result.places == [] and result.error


def test_endpoint_returns_result_and_validates_bbox():
    main.app.dependency_overrides[main.get_http_client] = lambda: make_client(
        lambda r: httpx.Response(200, content=fixture_bytes("overpass_places.json"))
    )
    try:
        client = TestClient(main.app)
        ok = client.post("/v1/pipeline/places/run", json={})
        assert ok.status_code == 200 and ok.json()["records_valid"] == 5
        bad = client.post("/v1/pipeline/places/run", json={"bbox": [-33.0, -71.5, -33.1, -71.7]})
        assert bad.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_pipeline_falls_back_to_the_next_overpass_server():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.host)
        if request.url.host == "overpass-api.de":
            return httpx.Response(502)
        return httpx.Response(200, content=fixture_bytes("overpass_places.json"))

    result = run_places_pipeline(
        None, _settings(), make_client(handler), clock=lambda: NOW, sleep=lambda s: None
    )
    assert result.status == "ok" and result.records_valid == 5
    assert calls == ["overpass-api.de", "overpass.kumi.systems"]
    assert "kumi" in result.url


def test_pipeline_reports_every_server_when_all_fail():
    result = run_places_pipeline(
        None, _settings(), make_client(lambda r: httpx.Response(504)), sleep=lambda s: None
    )
    assert result.status == "failed"
    assert "overpass-api.de" in result.error and "kumi" in result.error


def test_overpass_gets_its_own_longer_timeout_and_one_attempt_per_server():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.extensions["timeout"])
        raise httpx.ReadTimeout("lento", request=request)

    result = run_places_pipeline(
        None, Settings(retries=3, backoff_seconds=0), make_client(handler), sleep=lambda s: None
    )
    assert result.status == "failed"
    assert len(seen) == 2  # dos servidores, un intento cada uno
    assert all(t["read"] == 50.0 for t in seen)
