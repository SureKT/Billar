from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import NombreEquipo

router = APIRouter(prefix="/api/equipos-nombres", tags=["equipos"])


def _make_key(jugadores_ids: list[int]) -> str:
    return ",".join(str(i) for i in sorted(jugadores_ids))


class UpsertBody(BaseModel):
    jugadores_ids: list[int]
    nombre: str


@router.get("")
def listar(session: Session = Depends(get_session)):
    return session.exec(select(NombreEquipo)).all()


@router.get("/lookup")
def lookup(jugadores: str, session: Session = Depends(get_session)):
    key = _make_key([int(x) for x in jugadores.split(",") if x])
    ne = session.exec(select(NombreEquipo).where(NombreEquipo.jugadores_key == key)).first()
    if not ne:
        return None
    return ne


@router.post("", status_code=201)
def upsert(body: UpsertBody, session: Session = Depends(get_session)):
    if len(body.jugadores_ids) < 1:
        raise HTTPException(400, "Se necesita al menos un jugador")
    nombre = body.nombre.strip()
    if not nombre:
        raise HTTPException(400, "El nombre no puede estar vacío")
    key = _make_key(body.jugadores_ids)
    ne = session.exec(select(NombreEquipo).where(NombreEquipo.jugadores_key == key)).first()
    if ne:
        ne.nombre = nombre
    else:
        ne = NombreEquipo(jugadores_key=key, nombre=nombre)
        session.add(ne)
    session.commit()
    session.refresh(ne)
    return ne


@router.delete("/{id}", status_code=204)
def eliminar(id: int, session: Session = Depends(get_session)):
    ne = session.get(NombreEquipo, id)
    if not ne:
        raise HTTPException(404)
    session.delete(ne)
    session.commit()
