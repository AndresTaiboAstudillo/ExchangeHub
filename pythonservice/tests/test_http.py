import httpx
import pytest

from pipeline.errors import SourceUnavailable
from pipeline.http import fetch
from tests.conftest import make_client


def run(handler, **kw):
    sleeps: list[float] = []
    kw.setdefault("sleep", sleeps.append)
    return fetch(make_client(handler), "https://x.cl/a", source="t", **kw), sleeps


def test_ok_first_try():
    result, sleeps = run(lambda r: httpx.Response(200, content=b"hola"))
    assert result.content == b"hola" and sleeps == []


def test_retries_with_exponential_backoff_then_succeeds():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(503) if calls["n"] < 3 else httpx.Response(200, content=b"ok")

    result, sleeps = run(handler, backoff=1.0)
    assert result.content == b"ok" and sleeps == [1.0, 2.0]


def test_retry_after_is_honored_and_capped():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "999"})
        if calls["n"] == 2:
            return httpx.Response(429, headers={"Retry-After": "2"})
        return httpx.Response(200, content=b"ok")

    _, sleeps = run(handler)
    assert sleeps == [30.0, 2.0]


def test_gives_up_after_last_attempt():
    with pytest.raises(SourceUnavailable) as exc:
        run(lambda r: httpx.Response(500), retries=3)
    assert "3 intentos" in exc.value.reason


def test_4xx_fails_fast():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(404)

    with pytest.raises(SourceUnavailable):
        run(handler)
    assert calls["n"] == 1


def test_network_errors_are_retried():
    def handler(request):
        raise httpx.ConnectError("sin red")

    with pytest.raises(SourceUnavailable) as exc:
        run(handler, retries=2)
    assert "error de red" in exc.value.reason


def test_oversized_response_is_rejected():
    with pytest.raises(SourceUnavailable):
        run(lambda r: httpx.Response(200, content=b"x" * 100), max_bytes=10)
