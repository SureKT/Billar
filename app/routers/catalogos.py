from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.models import Bola, Falta, Turno
from app.database import get_session

router = APIRouter(prefix="/api", tags=["catalogos"])


class FaltaConFrecuencia(BaseModel):
    id: int
    nombre: str
    penalizacion: str
    frecuencia: int  # total de veces usada en todas las partidas


@router.get("/bolas", response_model=list[Bola])
def listar_bolas(session: Session = Depends(get_session)):
    return session.exec(select(Bola).order_by(Bola.numero)).all()


@router.get("/faltas", response_model=list[FaltaConFrecuencia])
def listar_faltas(session: Session = Depends(get_session)):
    faltas = session.exec(select(Falta)).all()
    # Contar usos de cada falta en todos los turnos (barato: tabla pequeña)
    counts_raw = session.exec(
        select(Turno.falta_id, func.count(Turno.id))
        .where(Turno.falta_id.is_not(None))
        .group_by(Turno.falta_id)
    ).all()
    counts = {falta_id: count for falta_id, count in counts_raw}
    return [
        FaltaConFrecuencia(
            id=f.id,
            nombre=f.nombre,
            penalizacion=f.penalizacion,
            frecuencia=counts.get(f.id, 0),
        )
        for f in faltas
    ]
