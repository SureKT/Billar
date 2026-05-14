from collections import Counter
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel

from app.models import Jugador, Turno, Partida, PartidaJugador, Falta
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
    falta_frecuente_bola8_id: Optional[int] = None
    falta_frecuente_bola9_id: Optional[int] = None
    falta_frecuente_bola8_nombre: Optional[str] = None
    falta_frecuente_bola9_nombre: Optional[str] = None
    bolas_por_turno_reciente: Optional[float] = None  # últimas 5 partidas; None = sin datos
    color: Optional[str] = None
    activo: bool = True
    racha_mejor: int = 0          # best ever consecutive win streak
    duracion_promedio_min: Optional[float] = None  # avg finished-game duration in minutes


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

    # Best ever win streak (chronological order)
    racha_mejor = 0
    streak_temp = 0
    for _, gano in reversed(resultados):   # resultados sorted desc → reversed = asc
        if gano:
            streak_temp += 1
            racha_mejor = max(racha_mejor, streak_temp)
        else:
            streak_temp = 0

    # Average game duration (only finished games with fecha_fin)
    duraciones_min = []
    for pid in partida_ids:
        p = session.get(Partida, pid)
        if p and p.fecha_fin:
            mins = (p.fecha_fin - p.fecha).total_seconds() / 60
            duraciones_min.append(mins)
    duracion_promedio_min = round(sum(duraciones_min) / len(duraciones_min), 1) if duraciones_min else None

    turnos = session.exec(select(Turno).where(Turno.jugador_id == jugador.id)).all()
    # Excluir bola blanca (0) de todos los conteos de bolas
    bolas_metidas = sum(sum(1 for b in t.bolas_metidas if b != 0) for t in turnos)
    turnos_bm = sum(1 for t in turnos if t.bola_en_mano)
    bolas_desde_bm = sum(sum(1 for b in t.bolas_metidas if b != 0) for t in turnos if t.bola_en_mano)

    # Falta más frecuente por modalidad (se construye sobre partidas ya cargadas)
    modalidad_por_partida = {}
    for pid in partida_ids:
        p = session.get(Partida, pid)
        if p:
            modalidad_por_partida[pid] = p.modalidad

    falta_count: dict[str, Counter] = {"bola8": Counter(), "bola9": Counter()}
    for t in turnos:
        if t.falta_id:
            mod = modalidad_por_partida.get(t.partida_id)
            if mod in falta_count:
                falta_count[mod][t.falta_id] += 1

    def top_falta(mod: str) -> Optional[int]:
        c = falta_count[mod]
        return c.most_common(1)[0][0] if c else None

    def falta_nombre(fid: Optional[int]) -> Optional[str]:
        if fid is None:
            return None
        f = session.get(Falta, fid)
        return f.nombre if f else None

    # Tendencia: bolas por turno en las últimas 5 partidas finalizadas
    partidas_fin = sorted(
        [session.get(Partida, pid) for pid in partida_ids
         if session.get(Partida, pid) and session.get(Partida, pid).ganador_equipo],
        key=lambda p: p.fecha, reverse=True,
    )
    ultimas_5_ids = {p.id for p in partidas_fin[:5]}
    bolas_por_turno_reciente: Optional[float] = None
    if len(ultimas_5_ids) >= 2:
        t_rec = [t for t in turnos if t.partida_id in ultimas_5_ids]
        b_rec = sum(sum(1 for b in t.bolas_metidas if b != 0) for t in t_rec)
        bolas_por_turno_reciente = round(b_rec / len(t_rec), 2) if t_rec else 0.0

    fid8 = top_falta("bola8")
    fid9 = top_falta("bola9")

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
        falta_frecuente_bola8_id=fid8,
        falta_frecuente_bola9_id=fid9,
        falta_frecuente_bola8_nombre=falta_nombre(fid8),
        falta_frecuente_bola9_nombre=falta_nombre(fid9),
        bolas_por_turno_reciente=bolas_por_turno_reciente,
        color=jugador.color,
        activo=jugador.activo,
        racha_mejor=racha_mejor,
        duracion_promedio_min=duracion_promedio_min,
    )


@router.get("", response_model=list[Jugador])
def listar_jugadores(session: Session = Depends(get_session)):
    # Devuelve siempre todos (activos e inactivos) — la pantalla de gestión los necesita todos
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
def stats_todos(incluir_inactivos: bool = False, session: Session = Depends(get_session)):
    q = select(Jugador).order_by(Jugador.nombre)
    if not incluir_inactivos:
        q = q.where(Jugador.activo == True)  # noqa: E712
    jugadores = session.exec(q).all()
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


class ColorUpdate(BaseModel):
    color: Optional[str] = None  # hex string o null para quitar


@router.patch("/{jugador_id}/color", response_model=Jugador)
def actualizar_color(jugador_id: int, datos: ColorUpdate, session: Session = Depends(get_session)):
    jugador = session.get(Jugador, jugador_id)
    if not jugador:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    jugador.color = datos.color
    session.add(jugador)
    session.commit()
    session.refresh(jugador)
    return jugador


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


@router.patch("/{jugador_id}/activo", response_model=Jugador)
def toggle_activo(jugador_id: int, session: Session = Depends(get_session)):
    jugador = session.get(Jugador, jugador_id)
    if not jugador:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    jugador.activo = not jugador.activo
    session.add(jugador)
    session.commit()
    session.refresh(jugador)
    return jugador


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
