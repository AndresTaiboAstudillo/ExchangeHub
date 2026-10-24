from fastapi.testclient import TestClient

from main import app

client = TestClient(app, raise_server_exceptions=False)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Python service funcionando"}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_pipeline_validation_error_has_consistent_shape():
    response = client.post("/v1/pipeline/universities/run", json={"sources": ["wikidata"]})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == 422
    assert error["message"] == "Datos inválidos"
    assert error["details"]


def test_unknown_route_uses_error_format():
    response = client.get("/no-existe")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == 404


def test_unhandled_error_returns_generic_500():
    @app.get("/boom")
    def boom():
        raise RuntimeError("secreto interno")

    response = client.get("/boom")
    assert response.status_code == 500
    assert response.json() == {"error": {"code": 500, "message": "Error interno del servicio"}}
