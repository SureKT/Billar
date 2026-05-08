from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.models import Bola, Falta, Turno, Partida
from app.database import get_session

router = APIRouter(prefix="/api", tags=["catalogos"])


class FaltaConFrecuencia(BaseModel):
    id: int
    nombre: str
    penalizacion: str
    frecuencia: int        # global
    frecuencia_bola8: int  # solo en partidas de bola 8
    frecuencia_bola9: int  # solo en partidas de bola 9


def _contar_faltas_por_modalidad(session: Session, modalidad: str) -> dict[int, int]:
    rows = session.exec(
        select(Turno.falta_id, func.count(Turno.id))
        .join(Partida, Turno.partida_id == Partida.id)  # type: ignore[arg-type]
        .where(Turno.falta_id.is_not(None), Partida.modalidad == modalidad)
        .group_by(Turno.falta_id)
    ).all()
    return {falta_id: count for falta_id, count in rows}


@router.get("/bolas", response_model=list[Bola])
def listar_bolas(session: Session = Depends(get_session)):
    return session.exec(select(Bola).order_by(Bola.numero)).all()


@router.get("/faltas", response_model=list[FaltaConFrecuencia])
def listar_faltas(session: Session = Depends(get_session)):
    faltas = session.exec(select(Falta)).all()

    counts_raw = session.exec(
        select(Turno.falta_id, func.count(Turno.id))
        .where(Turno.falta_id.is_not(None))
        .group_by(Turno.falta_id)
    ).all()
    counts        = {fid: c for fid, c in counts_raw}
    counts_bola8  = _contar_faltas_por_modalidad(session, "bola8")
    counts_bola9  = _contar_faltas_por_modalidad(session, "bola9")

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
