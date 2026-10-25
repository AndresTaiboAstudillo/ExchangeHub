"""Escribe la especificación OpenAPI del servicio Python en docs/api/fastapi-openapi.json.

    python -m scripts.export_openapi

Una prueba comprueba que el archivo siga coincidiendo con la API real.
"""

import json
from pathlib import Path

from main import app

OUTPUT = Path(__file__).resolve().parents[2] / "docs" / "api" / "fastapi-openapi.json"


def render() -> str:
    return json.dumps(app.openapi(), indent=2, ensure_ascii=False, sort_keys=True) + "\n"


if __name__ == "__main__":
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render(), encoding="utf-8")
    print(f"Escrito {OUTPUT}")
