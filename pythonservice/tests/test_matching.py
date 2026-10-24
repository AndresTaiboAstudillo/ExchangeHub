from datetime import UTC, datetime

from pipeline.matching import match_entities
from pipeline.models import Provenance, UniversityRecord
from pipeline.text import name_key
from pipeline.wikidata import Entity


def rec(number, name, category="universidad"):
    return UniversityRecord(
        registry_number=number,
        name=name,
        name_key=name_key(name),
        institution_type="X",
        category=category,
        ownership="estatal",
        operating_status="funcionando",
        is_vigente=True,
        provenance=[
            Provenance(
                source="mineduc_ies",
                external_id=number,
                fetched_at=datetime(2026, 1, 1, tzinfo=UTC),
                content_hash="0" * 64,
            )
        ],
    )


def test_exact_match_ignores_accents_and_case():
    result = match_entities(
        [rec("A1", "Universidad de Valparaíso")], [Entity("Q1", "UNIVERSIDAD DE VALPARAISO")]
    )
    assert result.matches["A1"][1].method == "exact"


def test_prefix_requires_three_tokens_and_unique_candidate():
    catalog = [rec("A1", "Universidad de Santiago de Chile")]
    ok = match_entities(catalog, [Entity("Q1", "Universidad de Santiago")])
    assert ok.matches["A1"][1].method == "prefix"
    short = match_entities(
        [rec("A1", "Universidad de Chile Norte")], [Entity("Q1", "Universidad de")]
    )
    assert not short.matches


def test_fuzzy_match_and_ambiguity_margin():
    catalog = [rec("A1", "Universidad de Antofagasta")]
    assert (
        match_entities(catalog, [Entity("Q1", "Universidad de Antofagasa")]).matches["A1"][1].method
        == "fuzzy"
    )
    ambiguous = match_entities(
        catalog,
        [Entity("Q1", "Universidad de Antofagasa"), Entity("Q2", "Universidad de Antofagast")],
    )
    assert not ambiguous.matches


def test_same_name_entities_are_skipped():
    result = match_entities(
        [rec("A1", "Universidad de Talca")],
        [Entity("Q1", "Universidad de Talca"), Entity("Q2", "Universidad de Talca")],
    )
    assert not result.matches
    assert result.unmatched_catalog == ["Universidad de Talca"]


def test_only_universities_are_linked():
    result = match_entities(
        [rec("D1", "Instituto Profesional Algo", "instituto_profesional")],
        [Entity("Q1", "Instituto Profesional Algo")],
    )
    assert not result.matches


def test_one_to_one():
    result = match_entities(
        [rec("A1", "Universidad de Valparaíso"), rec("A2", "Universidad de Valparaiso")],
        [Entity("Q1", "Universidad de Valparaíso")],
    )
    assert len(result.matches) == 1
