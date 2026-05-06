from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import jugadores, partidas, turnos, catalogos

app = FastAPI(title="Billar App", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jugadores.router)
app.include_router(partidas.router)
app.include_router(turnos.router)
app.include_router(catalogos.router)

STATIC_DIR = Path(__file__).parent / "static"


@app.on_event("startup")
def on_startup():
    init_db()
    # Crear directorio static si no existe (dev mode)
    STATIC_DIR.mkdir(exist_ok=True)


ASSETS_DIR = STATIC_DIR / "assets"

# Servir frontend estático si existe el build
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR), html=False), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "Frontend no compilado. Ejecuta: cd frontend && npm run build"}
