from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.logic_logros import (
    CATALOGO, LogroCatalogo, LogroEstado, LogroGlobal,
    calcular_logros, calcular_logros_todos,
)
from app.models import Jugador

router = APIRouter(prefix="/api/logros", tags=["logros"])


@router.get("/catalogo", response_model=list[LogroCatalogo])
def get_catalogo():
    return CATALOGO


@router.get("/todos", response_model=list[LogroGlobal])
def get_logros_todos(session: Session = Depends(get_session)):
    jugadores = session.exec(select(Jugador).where(Jugador.activo == True)).all()  # noqa: E712
    return calcular_logros_todos(jugadores, session)


@router.get("/{jugador_id}", response_model=list[LogroEstado])
def get_logros_jugador(jugador_id: int, session: Session = Depends(get_session)):
    return calcular_logros(jugador_id, session)
