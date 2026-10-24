"""Genera backend/test/fixtures/pipeline-result.json con el pipeline real y fuentes simuladas.

Mantiene alineados el contrato de Python y las pruebas de integración de NestJS.
Uso (desde pythonservice/):  python -m scripts.export_contract_fixture
"""

import json
from datetime import UTC, datetime
from pathlib import Path

from pipeline.runner import run_universities_pipeline
from pipeline.settings import Settings
from tests.conftest import make_client, online_routes

OUT = Path(__file__).resolve().parents[2] / "backend" / "test" / "fixtures" / "pipeline-result.json"
FIXED = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)


def main() -> None:
    result = run_universities_pipeline(
        ["mineduc_ies", "wikidata"],
        Settings(backoff_seconds=0),
        make_client(online_routes),
        clock=lambda: FIXED,
        sleep=lambda _s: None,
    )
    data = json.loads(result.model_dump_json())
    for source in data["sources"]:
        source["elapsed_ms"] = 0  # no determinista
    data["quality"]["elapsed_ms"] = 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"escrito {OUT} ({len(data['universities'])} universidades)")


if __name__ == "__main__":
    main()
