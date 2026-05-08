from datetime import datetime
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
    partidas_jugadas_bola8: int
    partidas_ganadas_bola8: int
    partidas_jugadas_bola9: int
    partidas_ganadas_bola9: int
    bolas_metidas: int
    bolas_por_turno: float
    turnos_con_bola_en_mano: int
    bolas_metidas_con_bola_en_mano: int
    racha_actual: int  # positivo = racha ganadora, negativo = perdedora, 0 = sin partidas


class H2HRecord(BaseModel):
    jugador_id: int
    nombre: str
    ganadas: int
    jugadas: int


class PartidaResumenJugador(BaseModel):
    id: int
    fecha: datetime
    modalidad: str
    gano: bool
    rival_nombres: list[str]


def _calcular_stats(session: Session, jugador: Jugador) -> JugadorStats:
    participaciones = session.exec(
        select(PartidaJugador).where(PartidaJugador.jugador_id == jugador.id)
    ).all()
    partida_ids = [p.partida_id for p in participaciones]
    partidas_jugadas = len(partida_ids)
    partidas_ganadas = 0
    partidas_jugadas_bola8 = 0
    partidas_ganadas_bola8 = 0
    partidas_jugadas_bola9 = 0
    partidas_ganadas_bola9 = 0

    resultados = []  # (fecha, gano) para calcular racha
    for pid in partida_ids:
        partida = session.get(Partida, pid)
        if not partida:
            continue
        # Conteo por modalidad (todas las partidas, no solo finalizadas)
        if partida.modalidad == "bola8":
            partidas_jugadas_bola8 += 1
        elif partida.modalidad == "bola9":
            partidas_jugadas_bola9 += 1
        pj = session.exec(
            select(PartidaJugador).where(
                PartidaJugador.partida_id == pid,
                PartidaJugador.jugador_id == jugador.id,
            )
        ).first()
        if partida.ganador_equipo and pj:
            gano = pj.equipo == partida.ganador_equipo
            if gano:
                partidas_ganadas += 1
                if partida.modalidad == "bola8":
                    partidas_ganadas_bola8 += 1
                elif partida.modalidad == "bola9":
                    partidas_ganadas_bola9 += 1
            resultados.append((partida.fecha, gano))

    # Racha: ordenar por fecha desc y contar consecutivos del mismo tipo
    resultados.sort(key=lambda x: x[0], reverse=True)
    racha = 0
    for _, gano in resultados:
        if racha == 0:
            racha = 1 if gano else -1
        elif (racha > 0) == gano:
            racha += 1 if gano else -1
        else:
            break

    turnos = session.exec(select(Turno).where(Turno.jugador_id == jugador.id)).all()
    bolas_metidas = sum(len(t.bolas_metidas) for t in turnos)
    turnos_bm = sum(1 for t in turnos if t.bola_en_mano)
    bolas_desde_bm = sum(len(t.bolas_metidas) for t in turnos if t.bola_en_mano)

    return JugadorStats(
        id=jugador.id,
        nombre=jugador.nombre,
        partidas_jugadas=partidas_jugadas,
        partidas_ganadas=partidas_ganadas,
        partidas_jugadas_bola8=partidas_jugadas_bola8,
        partidas_ganadas_bola8=partidas_ganadas_bola8,
        partidas_jugadas_bola9=partidas_jugadas_bola9,
        partidas_ganadas_bola9=partidas_ganadas_bola9,
        bolas_metidas=bolas_metidas,
        bolas_por_turno=round(bolas_metidas / len(turnos), 2) if turnos else 0.0,
        turnos_con_bola_en_mano=turnos_bm,
        bolas_metidas_con_bola_en_mano=bolas_desde_bm,
        racha_actual=racha,
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


@router.get("/{jugador_id}/h2h", response_model=list[H2HRecord])
def head_to_head(jugador_id: int, session: Session = Depends(get_session)):
    jugador = session.get(Jugador, jugador_id)
    if not jugador:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    participaciones = session.exec(
        select(PartidaJugador).where(PartidaJugador.jugador_id == jugador_id)
    ).all()

    h2h: dict[int, dict] = {}
    for pj in participaciones:
        partida = session.get(Partida, pj.partida_id)
        if not partida or not partida.ganador_equipo:
            continue
        gano = pj.equipo == partida.ganador_equipo
        rival_equipo = 2 if pj.equipo == 1 else 1
        rivales = session.exec(
            select(PartidaJugador).where(
                PartidaJugador.partida_id == pj.partida_id,
                PartidaJugador.equipo == rival_equipo,
            )
        ).all()
        for rival in rivales:
            if rival.jugador_id not in h2h:
                h2h[rival.jugador_id] = {"jugador_id": rival.jugador_id, "ganadas": 0, "jugadas": 0}
            h2h[rival.jugador_id]["jugadas"] += 1
            if gano:
                h2h[rival.jugador_id]["ganadas"] += 1

    result = []
    for opp_id, stats in h2h.items():
        opp = session.get(Jugador, opp_id)
        if opp:
            result.append(H2HRecord(
                jugador_id=opp_id,
                nombre=opp.nombre,
                ganadas=stats["ganadas"],
                jugadas=stats["jugadas"],
            ))
    return sorted(result, key=lambda x: (-x.jugadas, x.nombre))


@router.get("/{jugador_id}/ultimas-partidas", response_model=list[PartidaResumenJugador])
def ultimas_partidas(jugador_id: int, session: Session = Depends(get_session)):
    jugador = session.get(Jugador, jugador_id)
    if not jugador:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    participaciones = session.exec(
        select(PartidaJugador).where(PartidaJugador.jugador_id == jugador_id)
    ).all()

    result = []
    for pj in participaciones:
        partida = session.get(Partida, pj.partida_id)
        if not partida or not partida.ganador_equipo:
            continue
        gano = pj.equipo == partida.ganador_equipo
        rival_equipo = 2 if pj.equipo == 1 else 1
        rivales = session.exec(
            select(PartidaJugador).where(
                PartidaJugador.partida_id == pj.partida_id,
                PartidaJugador.equipo == rival_equipo,
            )
        ).all()
        rival_nombres = []
        for r in rivales:
            opp = session.get(Jugador, r.jugador_id)
            if opp:
                rival_nombres.append(opp.nombre)
        result.append(PartidaResumenJugador(
            id=partida.id,
            fecha=partida.fecha,
            modalidad=partida.modalidad,
            gano=gano,
            rival_nombres=rival_nombres,
        ))

    result.sort(key=lambda x: x.fecha, reverse=True)
    return result[:5]


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
