# ---- build frontend ----
# El repo usa vite.config.js con outDir relativo: ../app/static respecto a frontend/.
# Reproducimos esa estructura (/build/frontend → /build/app/static) para no tocar la config.
FROM node:20-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- runtime ----
FROM python:3.12-slim
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY --from=frontend /build/app/static ./app/static

# DB fuera de la imagen (volumen). Override en compose.
ENV DATABASE_URL=sqlite:////data/billar.db

EXPOSE 8000

# 1 worker OBLIGATORIO: el pub/sub SSE (app/events.py) y la detección de logros
# guardan estado en memoria del proceso. Con 2+ workers se pierden broadcasts.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
