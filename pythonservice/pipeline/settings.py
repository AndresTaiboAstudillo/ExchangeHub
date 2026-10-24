import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Configuración del pipeline. Las URL vienen del entorno, nunca de la petición (evita SSRF)."""

    catalog_page_url: str = (
        "https://www.ayudamineduc.cl/ficha/instituciones-vigentes-reconocidas-por-el-mineduc"
    )
    catalog_fallback_url: str = "https://ayudamineduc.cl/sites/default/files/ies_vig_may_26.xlsx"
    sparql_endpoint: str = "https://query.wikidata.org/sparql"
    # Ruta a un Excel del catálogo descargado a mano. Se usa solo si la descarga automática
    # no está permitida (robots.txt) o falla.
    catalog_file: str | None = None
    contact: str = "sin-contacto-configurado"
    retries: int = 3
    backoff_seconds: float = 1.0
    connect_timeout: float = 10.0
    read_timeout: float = 45.0

    @property
    def user_agent(self) -> str:
        return f"ExchangeHubBot/1.0 (proyecto universitario; contacto: {self.contact})"

    @classmethod
    def from_env(cls) -> "Settings":
        d = cls()
        env = os.environ.get
        return cls(
            catalog_page_url=env("MINEDUC_CATALOG_PAGE_URL", d.catalog_page_url),
            catalog_fallback_url=env("MINEDUC_CATALOG_URL", d.catalog_fallback_url),
            sparql_endpoint=env("WIKIDATA_SPARQL_ENDPOINT", d.sparql_endpoint),
            catalog_file=env("MINEDUC_CATALOG_FILE") or None,
            contact=env("PIPELINE_CONTACT", d.contact),
            retries=int(env("PIPELINE_RETRIES", d.retries)),
            backoff_seconds=float(env("PIPELINE_BACKOFF_SECONDS", d.backoff_seconds)),
            connect_timeout=float(env("PIPELINE_CONNECT_TIMEOUT", d.connect_timeout)),
            read_timeout=float(env("PIPELINE_READ_TIMEOUT", d.read_timeout)),
        )
