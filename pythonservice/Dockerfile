FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py observability.py ./
COPY pipeline/ pipeline/

# Usuario sin privilegios
RUN useradd --create-home appuser
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=2)"

# El registro de cada petición lo hace la aplicación (JSON, con identificador de correlación).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log"]
