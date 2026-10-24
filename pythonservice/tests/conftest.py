from collections.abc import Callable
from pathlib import Path

import httpx

FIXTURES = Path(__file__).parent / "fixtures"
CATALOG_PAGE = "https://www.ayudamineduc.cl/ficha/instituciones-vigentes-reconocidas-por-el-mineduc"
CATALOG_FILE = "https://www.ayudamineduc.cl/sites/default/files/ies_vig_may_26.xlsx"
SPARQL = "https://query.wikidata.org/sparql"


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def make_client(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True)


def online_routes(request: httpx.Request) -> httpx.Response:
    """Las dos fuentes disponibles, sirviendo los fixtures."""
    url = str(request.url)
    if url.startswith(CATALOG_PAGE):
        return httpx.Response(200, content=fixture_bytes("ficha_mineduc.html"))
    if url.endswith("ies_vig_may_26.xlsx"):
        return httpx.Response(200, content=fixture_bytes("ies_vig_may_26.xlsx"))
    if url.startswith(SPARQL):
        return httpx.Response(200, content=fixture_bytes("wikidata_universities.json"))
    return httpx.Response(404)
