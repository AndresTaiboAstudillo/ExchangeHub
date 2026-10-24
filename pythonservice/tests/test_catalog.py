import io
from datetime import UTC, datetime

import openpyxl
import pytest

from pipeline.catalog import discover_latest_url, edition_from_url, parse_catalog
from pipeline.errors import SourceFormatError
from tests.conftest import fixture_bytes

NOW = datetime(2026, 10, 24, tzinfo=UTC)
HEADER = ["NÚMERO REGISTRO", "NOMBRE", "TIPO INSTITUCIÓN", "VIGENCIA", "FUNCIONAMIENTO"]


def build_xlsx(rows, *, preamble=0, header=HEADER) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for _ in range(preamble):
        ws.append(["Instituciones vigentes"])
    ws.append(header)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def parse(content):
    return parse_catalog(content, fetched_at=NOW, url="https://x/ies_vig_may_26.xlsx")


def test_discover_picks_latest_edition():
    html = fixture_bytes("ficha_mineduc.html").decode()
    url, edition = discover_latest_url(html, "https://www.ayudamineduc.cl/ficha/x")
    assert url == "https://www.ayudamineduc.cl/sites/default/files/ies_vig_may_26.xlsx"
    assert edition == "2026-05"


def test_discover_returns_none_without_files():
    assert discover_latest_url("<a href='/a.pdf'>x</a>", "https://x.cl/") is None


def test_edition_from_url():
    assert edition_from_url("https://x/ies_vig_dic_25.xlsx") == "2025-12"
    assert edition_from_url("https://x/otro.xlsx") is None


def test_real_catalog():
    result = parse(fixture_bytes("ies_vig_may_26.xlsx"))
    assert result.rows_received == 128
    assert len(result.records) == 128
    assert not result.rejected and result.duplicates_discarded == 0
    cats = [r.category for r in result.records]
    assert cats.count("universidad") == 55
    assert cats.count("instituto_profesional") == 30
    assert cats.count("centro_formacion_tecnica") == 43
    assert all(r.is_vigente for r in result.records)
    biobio = next(r for r in result.records if r.registry_number == "A6")
    assert biobio.name == "Universidad del Bío-Bío"
    assert biobio.ownership == "estatal"
    assert len(biobio.provenance[0].content_hash) == 64


def test_header_found_after_preamble_and_accent_insensitive():
    content = build_xlsx(
        [["A1", "UNIVERSIDAD DE CHILE", "UNIVERSIDAD ESTATAL", "VIGENTE", "FUNCIONANDO"]],
        preamble=3,
        header=["NUMERO REGISTRO", "Nombre", "Tipo Institucion", "Vigencia", "Funcionamiento"],
    )
    assert len(parse(content).records) == 1


def test_missing_header_raises_format_error():
    with pytest.raises(SourceFormatError):
        parse(build_xlsx([], header=["a", "b", "c", "d", "e"]))


def test_not_an_excel_raises_format_error():
    with pytest.raises(SourceFormatError):
        parse(b"esto no es un excel")


def test_invalid_rows_are_rejected_with_reason():
    rows = [
        ["A1", "UNIVERSIDAD UNO", "UNIVERSIDAD ESTATAL", "VIGENTE", "FUNCIONANDO"],
        ["???", "UNIVERSIDAD DOS", "UNIVERSIDAD ESTATAL", "VIGENTE", "FUNCIONANDO"],
        ["A3", None, "UNIVERSIDAD ESTATAL", "VIGENTE", "FUNCIONANDO"],
        ["A4", "UNIVERSIDAD CUATRO", "ACADEMIA RARA", "VIGENTE", "FUNCIONANDO"],
    ]
    result = parse(build_xlsx(rows))
    assert [r.registry_number for r in result.records] == ["A1"]
    assert len(result.rejected) == 3
    assert result.rejected[0].row == 3
    assert "formato inválido" in result.rejected[0].reason
    assert "desconocido" in result.rejected[2].reason


def test_duplicates_by_number_and_by_name_are_discarded():
    rows = [
        ["A1", "UNIVERSIDAD DE CHILE", "UNIVERSIDAD ESTATAL", "VIGENTE", "FUNCIONANDO"],
        ["A1", "OTRA", "UNIVERSIDAD ESTATAL", "VIGENTE", "FUNCIONANDO"],
        ["A2", "Universidad de  Chile", "UNIVERSIDAD ESTATAL", "VIGENTE", "FUNCIONANDO"],
    ]
    result = parse(build_xlsx(rows))
    assert len(result.records) == 1
    assert result.duplicates_discarded == 2


def test_blank_rows_are_not_counted():
    rows = [
        ["A1", "UNIVERSIDAD UNO", "UNIVERSIDAD ESTATAL", "VIGENTE", "FUNCIONANDO"],
        [None, None, None, None, None],
    ]
    assert parse(build_xlsx(rows)).rows_received == 1


def test_non_vigente_flag():
    rows = [["A1", "UNIVERSIDAD UNO", "UNIVERSIDAD ESTATAL", "NO VIGENTE", "CERRADA"]]
    assert parse(build_xlsx(rows)).records[0].is_vigente is False
