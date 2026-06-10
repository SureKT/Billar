import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import jugadores, partidas, turnos, catalogos, torneos, equipos, logros
from app import events

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    events.set_loop(asyncio.get_event_loop())
    init_db()
    STATIC_DIR.mkdir(exist_ok=True)
    yield


app = FastAPI(title="Billar App", version="1.0.0", lifespan=lifespan)

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
app.include_router(torneos.router)
app.include_router(equipos.router)
app.include_router(logros.router)

ASSETS_DIR = STATIC_DIR / "assets"

# Servir frontend estático si existe el build
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR), html=False), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    # Archivos reales del build (manifest.json, sw.js, iconos…) — si el catch-all
    # se los traga devolviendo index.html, la PWA no registra (MIME text/html).
    # no-cache: son archivos SIN hash en el nombre — el navegador debe revalidar
    # o se queda pegado a un bundle viejo tras cada deploy (sw.js especialmente).
    no_cache = {"Cache-Control": "no-cache"}
    if full_path:
        candidato = (STATIC_DIR / full_path).resolve()
        if candidato.is_file() and candidato.is_relative_to(STATIC_DIR.resolve()):
            return FileResponse(str(candidato), headers=no_cache)
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index), headers=no_cache)
    return {"message": "Frontend no compilado. Ejecuta: cd frontend && npm run build"}
