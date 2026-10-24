import httpx

from pipeline.robots import RobotsChecker
from tests.conftest import make_client


def checker(handler, **kw):
    sleeps: list[float] = []
    calls: list[str] = []

    def wrapped(request):
        calls.append(str(request.url))
        return handler(request)

    return RobotsChecker(make_client(wrapped), "ExchangeHubBot", sleep=sleeps.append, **kw), calls


def robots(text: str, status: int = 200):
    return lambda request: httpx.Response(status, content=text.encode())


def test_missing_robots_allows_everything():
    c, _ = checker(robots("", 404))
    assert c.allowed("https://x.cl/cualquier/cosa") == (True, "")


def test_forbidden_robots_is_treated_as_unrestricted_per_rfc():
    c, _ = checker(robots("", 403))
    assert c.allowed("https://x.cl/a")[0] is True


def test_disallow_all_blocks_with_reason():
    c, _ = checker(robots("User-agent: *\nDisallow: /"))
    allowed, reason = c.allowed("https://x.cl/ficha/algo")
    assert allowed is False
    assert "x.cl" in reason and "/ficha/algo" in reason


def test_specific_rules_for_our_agent():
    text = "User-agent: ExchangeHubBot\nDisallow: /ficha\n\nUser-agent: *\nAllow: /"
    c, _ = checker(robots(text))
    assert c.allowed("https://x.cl/ficha/a")[0] is False
    assert c.allowed("https://x.cl/files/a.xlsx")[0] is True


def test_other_agents_rules_do_not_apply_to_us():
    c, _ = checker(robots("User-agent: OtroBot\nDisallow: /"))
    assert c.allowed("https://x.cl/a")[0] is True


def test_server_error_is_conservative_and_retried():
    c, calls = checker(robots("", 503), retries=3)
    allowed, reason = c.allowed("https://x.cl/a")
    assert allowed is False and "HTTP 503" in reason
    assert len(calls) == 3


def test_network_error_is_conservative():
    def boom(request):
        raise httpx.ConnectError("sin red")

    c, _ = checker(boom, retries=2)
    allowed, reason = c.allowed("https://x.cl/a")
    assert allowed is False and "ConnectError" in reason


def test_recovers_if_a_retry_succeeds():
    state = {"n": 0}

    def flaky(request):
        state["n"] += 1
        return httpx.Response(503) if state["n"] == 1 else httpx.Response(404)

    c, _ = checker(flaky, retries=2)
    assert c.allowed("https://x.cl/a")[0] is True


def test_one_request_per_origin():
    c, calls = checker(robots("User-agent: *\nAllow: /"))
    for path in ("/a", "/b", "/c"):
        c.allowed(f"https://x.cl{path}")
    c.allowed("https://otro.cl/a")
    assert calls == ["https://x.cl/robots.txt", "https://otro.cl/robots.txt"]
