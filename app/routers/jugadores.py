from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.models import Jugador, Turno, Partida, PartidaJugador
from app.database import get_session

router = APIRouter(prefix="/api/jugadores", tags=["jugadores"])


class JugadorCreate(BaseModel):
    nombre: str


class JugadorStats(BaseModel):
    id: int
    nombre: str
    partidas_jugadas: int
    partidas_ganadas: int
    bolas_metidas: int
    turnos_con_bola_en_mano: int
    bolas_metidas_con_bola_en_mano: int


def _calcular_stats(session: Session, jugador: Jugador) -> JugadorStats:
    participaciones = session.exec(
        select(PartidaJugador).where(PartidaJugador.jugador_id == jugador.id)
    ).all()
    partida_ids = [p.partida_id for p in participaciones]
    partidas_jugadas = len(partida_ids)
    partidas_ganadas = 0
    for pid in partida_ids:
        partida = session.get(Partida, pid)
        if partida and partida.ganador_equipo:
            pj = session.exec(
                select(PartidaJugador).where(
                    PartidaJugador.partida_id == pid,
                    PartidaJugador.jugador_id == jugador.id,
                )
            ).first()
            if pj and pj.equipo == partida.ganador_equipo:
                partidas_ganadas += 1

    turnos = session.exec(select(Turno).where(Turno.jugador_id == jugador.id)).all()
    bolas_metidas = sum(len(t.bolas_metidas) for t in turnos)
    turnos_bm = sum(1 for t in turnos if t.bola_en_mano)
    bolas_desde_bm = sum(len(t.bolas_metidas) for t in turnos if t.bola_en_mano)

    return JugadorStats(
        id=jugador.id,
        nombre=jugador.nombre,
        partidas_jugadas=partidas_jugadas,
        partidas_ganadas=partidas_ganadas,
        bolas_metidas=bolas_metidas,
        turnos_con_bola_en_mano=turnos_bm,
        bolas_metidas_con_bola_en_mano=bolas_desde_bm,
    )


@router.get("", response_model=list[Jugador])
def listar_jugadores(session: Session = Depends(get_session)):
    return session.exec(select(Jugador).order_by(Jugador.nombre)).all()


@router.post("", response_model=Jugador, status_code=201)
def crear_jugador(datos: JugadorCreate, session: Session = Depends(get_session)):
    existente = session.exec(select(Jugador).where(Jugador.nombre == datos.nombre)).first()
    if existente:
        raise HTTPException(status_code=409, detail="Ya existe un jugador con ese nombre")
    jugador = Jugador(nombre=datos.nombre)
    session.add(jugador)
    session.commit()
    session.refresh(jugador)
    return jugador


@router.put("/{jugador_id}", response_model=Jugador)
def editar_jugador(jugador_id: int, datos: JugadorCreate, session: Session = Depends(get_session)):
    jugador = session.get(Jugador, jugador_id)
    if not jugador:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    existente = session.exec(select(Jugador).where(Jugador.nombre == datos.nombre)).first()
    if existente and existente.id != jugador_id:
        raise HTTPException(status_code=409, detail="Ya existe un jugador con ese nombre")
    jugador.nombre = datos.nombre
    session.add(jugador)
    session.commit()
    session.refresh(jugador)
    return jugador


@router.get("/stats", response_model=list[JugadorStats])
def stats_todos(session: Session = Depends(get_session)):
    jugadores = session.exec(select(Jugador).order_by(Jugador.nombre)).all()
    return [_calcular_stats(session, j) for j in jugadores]


@router.get("/{jugador_id}/stats", response_model=JugadorStats)
def stats_jugador(jugador_id: int, session: Session = Depends(get_session)):
    jugador = session.get(Jugador, jugador_id)
    if not jugador:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    return _calcular_stats(session, jugador)


@router.delete("/{jugador_id}", status_code=204)
def eliminar_jugador(jugador_id: int, session: Session = Depends(get_session)):
    jugador = session.get(Jugador, jugador_id)
    if not jugador:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    for t in session.exec(select(Turno).where(Turno.jugador_id == jugador_id)).all():
        session.delete(t)
    for pj in session.exec(select(PartidaJugador).where(PartidaJugador.jugador_id == jugador_id)).all():
        session.delete(pj)
    session.delete(jugador)
    session.commit()
