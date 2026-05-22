from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.logic_logros import CATALOGO, LogroCatalogo, LogroEstado, calcular_logros

router = APIRouter(prefix="/api/logros", tags=["logros"])


@router.get("/catalogo", response_model=list[LogroCatalogo])
def get_catalogo():
    return CATALOGO


@router.get("/{jugador_id}", response_model=list[LogroEstado])
def get_logros_jugador(jugador_id: int, session: Session = Depends(get_session)):
    return calcular_logros(jugador_id, session)
