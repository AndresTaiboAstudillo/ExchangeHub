import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

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


class EchoRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)


@app.get("/")
def root():
    return {"message": "Python service funcionando"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/echo")
def echo(payload: EchoRequest):
    """Endpoint de ejemplo con validación; reemplazar por la lógica real."""
    return {"message": payload.message, "length": len(payload.message)}
