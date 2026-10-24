"""Ejecuta el pipeline contra las fuentes REALES y muestra un resumen de calidad.

Uso (desde pythonservice/, con el entorno virtual activado):
    PIPELINE_CONTACT="tu-correo@ejemplo.cl" python -m scripts.run_pipeline [--json salida.json]

Sirve para ver la cobertura real de Wikidata y el estado de cada fuente sin levantar el resto
del sistema. No escribe en la base de datos.
"""

import argparse
from pathlib import Path

import httpx

from pipeline.models import PipelineResult
from pipeline.runner import run_universities_pipeline
from pipeline.settings import Settings


def summarize(result: PipelineResult) -> str:
    q = result.quality
    lines = [f"Estado: {result.status}", ""]
    for s in result.sources:
        detail = s.error or (f"edición {s.edition}" if s.edition else "")
        lines.append(
            f"- {s.code}: {s.status} · recibidos {s.records_received} · válidos {s.records_valid}"
            f" · {s.elapsed_ms} ms {('· ' + detail) if detail else ''}".rstrip()
        )
        lines.extend(f"    nota: {n}" for n in s.notes)
    lines += [
        "",
        f"Catálogo: {q.catalog_valid}/{q.catalog_rows} filas válidas ({q.pct_valid:.1%}),"
        f" {q.duplicates_discarded} duplicadas descartadas, {q.catalog_rejected} rechazadas",
        f"Universidades en el catálogo: {q.universities_in_catalog}",
        f"Entidades en Wikidata: {q.wikidata_entities}",
        f"Cruzadas con Wikidata: {q.matched} ({q.match_rate:.1%})",
        f"Cobertura de sitio web: {q.with_website} ({q.coverage_website:.1%})",
        f"Cobertura de coordenadas: {q.with_coordinates} ({q.coverage_coordinates:.1%})",
    ]
    if q.unmatched_catalog_sample:
        lines += ["", "Universidades sin cruzar (muestra):"]
        lines += [f"  - {n}" for n in q.unmatched_catalog_sample]
    if q.unmatched_entities_sample:
        lines += ["", "Entidades de Wikidata sin cruzar (muestra):"]
        lines += [f"  - {n}" for n in q.unmatched_entities_sample]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--json", type=Path, help="guardar el resultado completo en este archivo")
    args = parser.parse_args()

    settings = Settings.from_env()
    timeout = httpx.Timeout(settings.read_timeout, connect=settings.connect_timeout)
    headers = {"User-Agent": settings.user_agent}
    with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
        result = run_universities_pipeline(["mineduc_ies", "wikidata"], settings, client)
    print(summarize(result))
    if args.json:
        args.json.write_text(result.model_dump_json(indent=1), encoding="utf-8")
        print(f"\nResultado completo guardado en {args.json}")


if __name__ == "__main__":
    main()
