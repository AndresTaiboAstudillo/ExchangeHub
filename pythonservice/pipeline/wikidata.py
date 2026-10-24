"""Capa de datos estructurados de Wikidata (CC0): sitio web, coordenadas y año de fundación."""

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urlsplit, urlunsplit

from .errors import SourceFormatError

SOURCE = "wikidata"

SPARQL_QUERY = """
SELECT ?item ?itemLabel ?website ?coord ?inception WHERE {
  ?item wdt:P31/wdt:P279* wd:Q3918 .
  ?item wdt:P17 wd:Q298 .
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 2000
""".strip()

_QID_RE = re.compile(r"/(Q\d+)$")
_POINT_RE = re.compile(
    r"^Point\(\s*(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*\)$"
)
# Chile continental, insular y antártico (con holgura)
LAT_RANGE = (-90.0, -17.0)
LON_RANGE = (-110.0, -65.0)
MIN_YEAR = 1500


@dataclass
class Entity:
    qid: str
    label: str
    website: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    founded_year: int | None = None

    def record_hash(self) -> str:
        payload = json.dumps(
            [self.qid, self.label, self.website, self.latitude, self.longitude, self.founded_year],
            ensure_ascii=False,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@dataclass
class WikidataParse:
    entities: list[Entity] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    rows_received: int = 0


def clean_website(url: str | None) -> str | None:
    if not url:
        return None
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or "." not in (parts.hostname or ""):
        return None
    path = parts.path.rstrip("/")
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, parts.query, ""))


def parse_point(wkt: str | None) -> tuple[float, float] | None:
    """'Point(lon lat)' → (lat, lon); descarta lo que cae fuera de Chile (ejes invertidos)."""
    if not wkt:
        return None
    m = _POINT_RE.match(wkt.strip())
    if not m:
        return None
    lon, lat = float(m.group(1)), float(m.group(2))
    if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1] and LON_RANGE[0] <= lon <= LON_RANGE[1]):
        return None
    return lat, lon


def parse_year(value: str | None, *, now: datetime) -> int | None:
    if not value:
        return None
    m = re.match(r"^(\d{4})-\d{2}-\d{2}", value.strip())
    if not m:
        return None
    year = int(m.group(1))
    return year if MIN_YEAR <= year <= now.year else None


def _val(binding: dict, key: str) -> str | None:
    cell = binding.get(key)
    return cell.get("value") if isinstance(cell, dict) else None


def _better_site(current: str | None, new: str | None) -> str | None:
    if current is None:
        return new
    if new is None:
        return current
    return new if (new.startswith("https") and not current.startswith("https")) else current


def parse_results(payload: dict, *, now: datetime) -> WikidataParse:
    try:
        bindings = payload["results"]["bindings"]
    except (KeyError, TypeError) as exc:
        raise SourceFormatError(SOURCE, "respuesta SPARQL sin results.bindings") from exc
    if not isinstance(bindings, list):
        raise SourceFormatError(SOURCE, "results.bindings no es una lista")

    out = WikidataParse(rows_received=len(bindings))
    merged: dict[str, Entity] = {}
    for b in bindings:
        item = _val(b, "item") or ""
        m = _QID_RE.search(item)
        if not m:
            out.warnings.append(f"fila sin QID válido: {item!r}")
            continue
        qid = m.group(1)
        label = _val(b, "itemLabel")
        if not label or label == qid:  # Wikidata devuelve el QID cuando no hay etiqueta
            out.warnings.append(f"{qid}: sin etiqueta, descartada")
            continue
        ent = merged.setdefault(qid, Entity(qid=qid, label=label.strip()))

        raw_site = _val(b, "website")
        site = clean_website(raw_site)
        if raw_site and not site:
            out.warnings.append(f"{qid}: sitio web inválido {raw_site!r}")
        ent.website = _better_site(ent.website, site)

        raw_coord = _val(b, "coord")
        point = parse_point(raw_coord)
        if raw_coord and not point:
            out.warnings.append(f"{qid}: coordenadas inválidas o fuera de Chile {raw_coord!r}")
        if point and ent.latitude is None:
            ent.latitude, ent.longitude = point

        raw_year = _val(b, "inception")
        year = parse_year(raw_year, now=now)
        if raw_year and year is None:
            out.warnings.append(f"{qid}: año de fundación inválido {raw_year!r}")
        if year and ent.founded_year is None:
            ent.founded_year = year
    out.entities = list(merged.values())
    return out
