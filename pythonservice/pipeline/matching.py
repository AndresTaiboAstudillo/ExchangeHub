"""Cruce entre el catálogo oficial y las entidades de Wikidata.

Reglas: solo se enlazan universidades, uno a uno, y nunca si hay ambigüedad.
Orden de intentos: nombre exacto → prefijo (≥3 palabras, candidato único) → difuso.
"""

from collections import Counter
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from .models import MatchInfo, UniversityRecord
from .text import name_key
from .wikidata import Entity

FUZZY_MIN = 0.90
FUZZY_MARGIN = 0.05
PREFIX_MIN_TOKENS = 3


@dataclass
class MatchResult:
    matches: dict[str, tuple[Entity, MatchInfo]] = field(default_factory=dict)
    unmatched_catalog: list[str] = field(default_factory=list)
    unmatched_entities: list[str] = field(default_factory=list)


def _is_prefix(short: str, long: str) -> bool:
    s, lg = short.split(), long.split()
    return len(s) >= PREFIX_MIN_TOKENS and len(s) < len(lg) and lg[: len(s)] == s


def match_entities(catalog: list[UniversityRecord], entities: list[Entity]) -> MatchResult:
    universities = [r for r in catalog if r.category == "universidad"]
    keys = {e.qid: name_key(e.label) for e in entities}
    key_counts = Counter(keys.values())
    # Dos entidades con el mismo nombre normalizado son ambiguas: no se usan.
    candidates = [e for e in entities if key_counts[keys[e.qid]] == 1]

    result = MatchResult()
    taken: set[str] = set()

    def link(rec: UniversityRecord, ent: Entity, method: str, score: float) -> None:
        result.matches[rec.registry_number] = (ent, MatchInfo(method=method, score=round(score, 4)))
        taken.add(ent.qid)

    pending: list[UniversityRecord] = []
    by_key = {keys[e.qid]: e for e in candidates}
    for rec in universities:
        ent = by_key.get(rec.name_key)
        if ent is not None and ent.qid not in taken:
            link(rec, ent, "exact", 1.0)
        else:
            pending.append(rec)

    still: list[UniversityRecord] = []
    for rec in pending:
        free = [e for e in candidates if e.qid not in taken]
        hits = [
            e
            for e in free
            if _is_prefix(keys[e.qid], rec.name_key) or _is_prefix(rec.name_key, keys[e.qid])
        ]
        if len(hits) == 1:
            ratio = SequenceMatcher(None, rec.name_key, keys[hits[0].qid]).ratio()
            link(rec, hits[0], "prefix", ratio)
        else:
            still.append(rec)

    for rec in still:
        free = [e for e in candidates if e.qid not in taken]
        scored = sorted(
            ((SequenceMatcher(None, rec.name_key, keys[e.qid]).ratio(), e) for e in free),
            key=lambda t: t[0],
            reverse=True,
        )
        if scored and scored[0][0] >= FUZZY_MIN:
            second = scored[1][0] if len(scored) > 1 else 0.0
            if scored[0][0] - second >= FUZZY_MARGIN:
                link(rec, scored[0][1], "fuzzy", scored[0][0])

    result.unmatched_catalog = [
        r.name for r in universities if r.registry_number not in result.matches
    ]
    result.unmatched_entities = [e.label for e in entities if e.qid not in taken]
    return result
