"""Contratos de entrada y salida del pipeline (pydantic v2)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .osm import MAX_SPAN_DEGREES

SourceCode = Literal["mineduc_ies", "wikidata"]
Category = Literal["universidad", "instituto_profesional", "centro_formacion_tecnica"]
Ownership = Literal["estatal", "particular_con_aportes", "privada", "otra"]


class RunRequest(BaseModel):
    sources: list[SourceCode] = Field(
        default_factory=lambda: ["mineduc_ies", "wikidata"],
        description="Fuentes a consultar. `mineduc_ies` es obligatoria (es el catálogo base).",
    )

    @field_validator("sources")
    @classmethod
    def _validate_sources(cls, v: list[str]) -> list[str]:
        unique = list(dict.fromkeys(v))
        if "mineduc_ies" not in unique:
            raise ValueError("la fuente 'mineduc_ies' es obligatoria")
        return unique


class SourceStatus(BaseModel):
    code: SourceCode
    status: Literal["ok", "unavailable", "invalid_format", "skipped"]
    url: str | None = None
    edition: str | None = Field(None, description="Edición publicada, p. ej. 2026-05")
    fetched_at: datetime | None = None
    content_hash: str | None = Field(None, description="SHA-256 del contenido descargado")
    records_received: int = 0
    records_valid: int = 0
    records_rejected: int = 0
    duplicates_discarded: int = 0
    elapsed_ms: int = 0
    notes: list[str] = Field(default_factory=list)
    error: str | None = None


class Rejected(BaseModel):
    source: SourceCode
    row: int | None = None
    external_id: str | None = None
    reason: str


class Provenance(BaseModel):
    source: SourceCode
    external_id: str
    url: str | None = None
    fetched_at: datetime
    content_hash: str = Field(description="SHA-256 del registro tal como se recibió")


class MatchInfo(BaseModel):
    method: Literal["exact", "prefix", "fuzzy"]
    score: float = Field(ge=0, le=1)


class UniversityRecord(BaseModel):
    registry_number: str
    name: str
    name_key: str
    institution_type: str = Field(description="Tipo tal como lo publica el Ministerio")
    category: Category
    ownership: Ownership
    operating_status: str
    is_vigente: bool
    wikidata_id: str | None = None
    website: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    founded_year: int | None = None
    match: MatchInfo | None = None
    provenance: list[Provenance] = Field(default_factory=list)


class QualityReport(BaseModel):
    catalog_rows: int
    catalog_valid: int
    catalog_rejected: int
    duplicates_discarded: int
    pct_valid: float
    universities_in_catalog: int
    wikidata_entities: int
    matched: int
    match_rate: float
    with_website: int
    with_coordinates: int
    coverage_website: float
    coverage_coordinates: float
    unmatched_catalog_sample: list[str] = Field(default_factory=list)
    unmatched_entities_sample: list[str] = Field(default_factory=list)
    elapsed_ms: int


class PipelineResult(BaseModel):
    status: Literal["succeeded", "partial", "failed"]
    started_at: datetime
    finished_at: datetime
    sources: list[SourceStatus]
    universities: list[UniversityRecord]
    rejected: list[Rejected]
    quality: QualityReport


class PlacesRequest(BaseModel):
    bbox: tuple[float, float, float, float] | None = Field(
        None,
        description=(
            "Zona a consultar como (sur, oeste, norte, este). "
            "Por defecto, Valparaíso y Viña del Mar."
        ),
    )

    @field_validator("bbox")
    @classmethod
    def _validate_bbox(cls, v):
        if v is None:
            return v
        south, west, north, east = v
        if not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
            raise ValueError(
                "bbox debe ser (sur, oeste, norte, este) con sur < norte y oeste < este"
            )
        if north - south > MAX_SPAN_DEGREES or east - west > MAX_SPAN_DEGREES:
            raise ValueError(f"la zona no puede superar {MAX_SPAN_DEGREES} grados por lado")
        return v


class PlaceOut(BaseModel):
    external_id: str = Field(description="Identificador OSM, p. ej. `node/123`")
    category: str
    name: str
    latitude: float
    longitude: float
    address: str | None = None
    opening_hours: str | None = None
    website: str | None = None
    content_hash: str


class PlacesResult(BaseModel):
    status: Literal["ok", "failed"]
    source: str = "osm_places"
    url: str | None = None
    fetched_at: datetime | None = None
    elapsed_ms: int = 0
    records_received: int = 0
    records_valid: int = 0
    records_rejected: int = 0
    duplicates_discarded: int = 0
    error: str | None = None
    places: list[PlaceOut] = Field(default_factory=list)
