import logging
from collections.abc import Iterator
from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from pipeline.models import PipelineResult, RunRequest
from pipeline.runner import run_universities_pipeline
from pipeline.settings import Settings

logger = logging.getLogger("pythonservice")

app = FastAPI(
    title="ExchangeHub Python Service",
    description="Servicio Python para ExchangeHub",
    version="1.0.0",
)


def error_body(code: int, message: str, details=None) -> dict:
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.status_code, str(exc.detail)),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=error_body(422, "Datos inválidos", jsonable_encoder(exc.errors())),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # El detalle va al log; al cliente solo se le da un mensaje genérico.
    logger.exception("Error no controlado en %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content=error_body(500, "Error interno del servicio"),
    )


@app.get("/")
def root():
    return {"message": "Python service funcionando"}


@app.get("/health")
def health():
    return {"status": "ok"}


def get_settings() -> Settings:
    return Settings.from_env()


def get_http_client(settings: Annotated[Settings, Depends(get_settings)]) -> Iterator[httpx.Client]:
    timeout = httpx.Timeout(settings.read_timeout, connect=settings.connect_timeout)
    with httpx.Client(
        timeout=timeout,
        follow_redirects=True,
        headers={"User-Agent": settings.user_agent},
    ) as client:
        yield client


@app.post(
    "/v1/pipeline/universities/run",
    response_model=PipelineResult,
    tags=["pipeline"],
    summary="Recupera, limpia y cruza los datos de universidades de Chile",
    description=(
        "Descarga el catálogo oficial del Mineduc y, opcionalmente, enriquece las universidades "
        "con datos estructurados de Wikidata. Valida, normaliza, deduplica y cruza los registros, "
        "y devuelve además la procedencia de cada dato y un informe de calidad.\n\n"
        "Las URL de las fuentes provienen de la configuración del servicio, nunca de la petición. "
        "Si el catálogo no está disponible, `status` es `failed`; si solo falla Wikidata, "
        "es `partial` y se devuelve igualmente el catálogo."
    ),
)
def run_universities(
    request: RunRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[httpx.Client, Depends(get_http_client)],
) -> PipelineResult:
    return run_universities_pipeline(request.sources, settings, client)
