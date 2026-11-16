"""Comercios, servicios y alojamientos turísticos desde OpenStreetMap (Overpass, ODbL)."""

import hashlib
import json
from dataclasses import dataclass, field

from .errors import SourceFormatError

SOURCE = "osm_places"

# (sur, oeste, norte, este): Valparaíso, Viña del Mar y Playa Ancha hasta Reñaca.
DEFAULT_BBOX = (-33.08, -71.68, -32.95, -71.48)
# Evita consultas enormes que Overpass rechazaría o que tardarían demasiado.
MAX_SPAN_DEGREES = 0.6

# etiqueta OSM -> categoría de ExchangeHub
CATEGORIES: dict[tuple[str, str], str] = {
    ("amenity", "marketplace"): "feria",
    ("amenity", "pharmacy"): "farmacia",
    ("shop", "supermarket"): "supermercado",
    ("shop", "convenience"): "minimarket",
    ("shop", "bakery"): "panaderia",
    ("shop", "greengrocer"): "verduleria",
    ("shop", "laundry"): "lavanderia",
    # Alojamientos turísticos: sirven para los primeros días (no son arriendos mensuales).
    ("tourism", "hotel"): "hotel",
    ("tourism", "hostel"): "hostal",
    ("tourism", "guest_house"): "hospedaje",
    ("tourism", "apartment"): "hospedaje",
}


QUERY_TIMEOUT = 40  # segundos que Overpass puede trabajar antes de abortar por su cuenta


def build_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    box = f"({south},{west},{north},{east})"
    # Un filtro exacto por categoría: es mucho más rápido que una expresión regular.
    filters = "".join(f'nwr["{key}"="{value}"]{box};' for (key, value) in CATEGORIES)
    return f"[out:json][timeout:{QUERY_TIMEOUT}];({filters});out center tags qt;"


@dataclass
class Place:
    external_id: str
    category: str
    name: str
    latitude: float
    longitude: float
    address: str | None = None
    opening_hours: str | None = None
    website: str | None = None

    def record_hash(self) -> str:
        payload = json.dumps(
            [
                self.external_id,
                self.category,
                self.name,
                self.latitude,
                self.longitude,
                self.address,
                self.opening_hours,
                self.website,
            ],
            ensure_ascii=False,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@dataclass
class OsmParse:
    places: list[Place] = field(default_factory=list)
    rejected: list[str] = field(default_factory=list)
    received: int = 0
    duplicates: int = 0


def _category(tags: dict) -> str | None:
    for key in ("amenity", "shop", "tourism"):
        category = CATEGORIES.get((key, tags.get(key, "")))
        if category:
            return category
    return None


def _address(tags: dict) -> str | None:
    street = (tags.get("addr:street") or "").strip()
    number = (tags.get("addr:housenumber") or "").strip()
    city = (tags.get("addr:city") or "").strip()
    line = " ".join(p for p in (street, number) if p)
    return ", ".join(p for p in (line, city) if p) or None


def _website(tags: dict) -> str | None:
    url = (tags.get("website") or tags.get("contact:website") or "").strip()
    return url if url.lower().startswith(("http://", "https://")) else None


def _coords(element: dict) -> tuple[float, float] | None:
    source = element if "lat" in element else element.get("center") or {}
    try:
        lat, lon = float(source["lat"]), float(source["lon"])
    except (KeyError, TypeError, ValueError):
        return None
    return (lat, lon) if -90 <= lat <= 90 and -180 <= lon <= 180 else None


def parse_overpass(payload: object) -> OsmParse:
    """Normaliza la respuesta de Overpass; descarta lo que no tenga nombre, categoría o punto."""
    if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list):
        raise SourceFormatError(SOURCE, "la respuesta no tiene la lista 'elements'")

    result = OsmParse()
    seen: set[str] = set()
    for element in payload["elements"]:
        result.received += 1
        if not isinstance(element, dict):
            result.rejected.append("elemento inválido")
            continue
        kind, osm_id = element.get("type"), element.get("id")
        external_id = f"{kind}/{osm_id}"
        tags = element.get("tags") if isinstance(element.get("tags"), dict) else {}
        name = (tags.get("name") or "").strip()
        category = _category(tags)
        point = _coords(element)
        if kind not in {"node", "way", "relation"} or osm_id is None:
            result.rejected.append("elemento sin tipo o id")
        elif not name:
            result.rejected.append(f"{external_id}: sin nombre")
        elif category is None:
            result.rejected.append(f"{external_id}: categoría no soportada")
        elif point is None:
            result.rejected.append(f"{external_id}: sin coordenadas")
        elif external_id in seen:
            result.duplicates += 1
        else:
            seen.add(external_id)
            result.places.append(
                Place(
                    external_id=external_id,
                    category=category,
                    name=name[:200],
                    latitude=point[0],
                    longitude=point[1],
                    address=_address(tags),
                    opening_hours=(tags.get("opening_hours") or None),
                    website=_website(tags),
                )
            )
    return result
