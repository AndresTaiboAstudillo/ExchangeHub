import json
from datetime import UTC, datetime

import pytest

from pipeline.errors import SourceFormatError
from pipeline.wikidata import clean_website, parse_point, parse_results, parse_year
from tests.conftest import fixture_bytes

NOW = datetime(2026, 10, 24, tzinfo=UTC)


def test_parse_point_returns_lat_lon():
    assert parse_point("Point(-70.518 -33.486)") == (-33.486, -70.518)


@pytest.mark.parametrize("wkt", [None, "", "basura", "Point(-36.8 -73.0)", "Point(10 50)"])
def test_parse_point_rejects_invalid_or_outside_chile(wkt):
    assert parse_point(wkt) is None


def test_clean_website():
    assert clean_website("HTTP://WWW.Ejemplo.CL/") == "http://www.ejemplo.cl"
    assert clean_website("https://uai.cl/es/#top") == "https://uai.cl/es"
    assert clean_website("ftp://x.cl") is None
    assert clean_website("http://localhost") is None
    assert clean_website(None) is None


def test_parse_year():
    assert parse_year("1988-01-01T00:00:00Z", now=NOW) == 1988
    assert parse_year("1200-01-01T00:00:00Z", now=NOW) is None
    assert parse_year("2999-01-01T00:00:00Z", now=NOW) is None
    assert parse_year("xx", now=NOW) is None


def test_parse_real_and_synthetic_fixture():
    payload = json.loads(fixture_bytes("wikidata_universities.json"))
    result = parse_results(payload, now=NOW)
    by_id = {e.qid: e for e in result.entities}
    assert result.rows_received == 11
    assert "Q900008" not in by_id  # sin etiqueta
    uai = by_id["Q611995"]
    assert (uai.website, uai.latitude, uai.longitude, uai.founded_year) == (
        "https://www.uai.cl",
        -33.486,
        -70.518,
        1988,
    )
    assert by_id["Q900001"].website == "https://uchile.cl"  # fusionó filas y prefirió https
    assert by_id["Q900002"].latitude is None  # ejes invertidos
    assert by_id["Q900009"].website is None and by_id["Q900009"].founded_year is None
    assert any("sin etiqueta" in w for w in result.warnings)


def test_malformed_payload_raises():
    with pytest.raises(SourceFormatError):
        parse_results({"nope": 1}, now=NOW)
    with pytest.raises(SourceFormatError):
        parse_results({"results": {"bindings": "x"}}, now=NOW)


def test_record_hash_is_stable_and_sensitive():
    payload = json.loads(fixture_bytes("wikidata_universities.json"))
    a = parse_results(payload, now=NOW).entities[0]
    b = parse_results(payload, now=NOW).entities[0]
    assert a.record_hash() == b.record_hash()
    b.website = "https://otro.cl"
    assert a.record_hash() != b.record_hash()
