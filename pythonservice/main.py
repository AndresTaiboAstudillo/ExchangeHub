from fastapi import FastAPI

app = FastAPI(
    title="ExchangeHub Python Service",
    description="Servicio Python para ExchangeHub",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "Python service funcionando"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }