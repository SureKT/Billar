from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.models import Bola, Falta, Turno, Partida, PartidaJugador
from app.database import get_session

router = APIRouter(prefix="/api", tags=["catalogos"])


class FaltaConFrecuencia(BaseModel):
    id: int
    nombre: str
    penalizacion: str
    frecuencia: int        # global
    frecuencia_bola8: int  # solo en partidas de bola 8
    frecuencia_bola9: int  # solo en partidas de bola 9


def _contar_faltas_por_modalidad(
    session: Session,
    modalidad: str,
    jugador_ids: Optional[list[int]] = None,
    desde: Optional[datetime] = None,
) -> dict[int, int]:
    q = (
        select(Turno.falta_id, func.count(Turno.id))
        .join(Partida, Turno.partida_id == Partida.id)  # type: ignore[arg-type]
        .where(Turno.falta_id.is_not(None), Partida.modalidad == modalidad)
    )
    if jugador_ids is not None:
        q = q.where(Turno.jugador_id.in_(jugador_ids))
    if desde is not None:
        q = q.where(Partida.fecha >= desde)
    rows = session.exec(q.group_by(Turno.falta_id)).all()
    return {falta_id: count for falta_id, count in rows}


@router.get("/bolas", response_model=list[Bola])
def listar_bolas(session: Session = Depends(get_session)):
    return session.exec(select(Bola).order_by(Bola.numero)).all()


@router.get("/faltas", response_model=list[FaltaConFrecuencia])
def listar_faltas(
    jugadores: Optional[str] = Query(default=None, description="IDs separados por coma para filtrar"),
    desde: Optional[datetime] = Query(default=None, description="Solo faltas en partidas con fecha >= desde"),
    session: Session = Depends(get_session),
):
    faltas = session.exec(select(Falta)).all()

    jugador_ids: Optional[list[int]] = None
    if jugadores:
        jugador_ids = [int(x) for x in jugadores.split(",") if x.strip()]

    q_global = select(Turno.falta_id, func.count(Turno.id)).where(Turno.falta_id.is_not(None))
    if jugador_ids is not None:
        q_global = q_global.where(Turno.jugador_id.in_(jugador_ids))
    if desde is not None:
        q_global = q_global.join(Partida, Turno.partida_id == Partida.id).where(Partida.fecha >= desde)  # type: ignore[arg-type]
    counts_raw = session.exec(q_global.group_by(Turno.falta_id)).all()
    counts        = {fid: c for fid, c in counts_raw}
    counts_bola8  = _contar_faltas_por_modalidad(session, "bola8", jugador_ids, desde)
    counts_bola9  = _contar_faltas_por_modalidad(session, "bola9", jugador_ids, desde)

    return [
        FaltaConFrecuencia(
            id=f.id,
            nombre=f.nombre,
            penalizacion=f.penalizacion,
            frecuencia=counts.get(f.id, 0),
            frecuencia_bola8=counts_bola8.get(f.id, 0),
            frecuencia_bola9=counts_bola9.get(f.id, 0),
        )
        for f in faltas
    ]
