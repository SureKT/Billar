import asyncio
from collections import defaultdict
from datetime import datetime
from itertools import combinations
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from app.models import Partida, PartidaJugador, Jugador, Turno
from app.database import get_session
from app import events

router = APIRouter(prefix="/api/partidas", tags=["partidas"])


class EquipoInput(BaseModel):
    jugador_ids: list[int]  # al menos 1 jugador por equipo


class PartidaCreate(BaseModel):
    modalidad: str = "bola8"
    equipo1: EquipoInput
    equipo2: EquipoInput
    primer_jugador_id: Optional[int] = None


class TiemposUpdate(BaseModel):
    fecha: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None


class PartidaResumen(BaseModel):
    id: int
    modalidad: str
    fecha: datetime
    fecha_fin: Optional[datetime]
    estado: str
    ganador_equipo: Optional[int]
    equipo1_grupo: Optional[str]
    equipo2_grupo: Optional[str]
    siguiente_jugador_id: Optional[int]
    bola_en_mano: bool
    equipo1_jugadores: list[int]
    equipo2_jugadores: list[int]


def _build_resumen(session: Session, partida: Partida) -> PartidaResumen:
    pjs = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida.id)
        .order_by(PartidaJugador.orden)
    ).all()
    eq1 = [p.jugador_id for p in pjs if p.equipo == 1]
    eq2 = [p.jugador_id for p in pjs if p.equipo == 2]
    return PartidaResumen(
        id=partida.id,
        modalidad=partida.modalidad,
        fecha=partida.fecha,
        fecha_fin=partida.fecha_fin,
        estado=partida.estado,
        ganador_equipo=partida.ganador_equipo,
        equipo1_grupo=partida.equipo1_grupo,
        equipo2_grupo=partida.equipo2_grupo,
        siguiente_jugador_id=partida.siguiente_jugador_id,
        bola_en_mano=partida.bola_en_mano,
        equipo1_jugadores=eq1,
        equipo2_jugadores=eq2,
    )


class SugerenciaJugador(BaseModel):
    id: int
    nombre: str
    color: Optional[str] = None


class Sugerencia(BaseModel):
    equipo1: list[SugerenciaJugador]
    equipo2: list[SugerenciaJugador]
    enfrentamientos: int        # veces que estos jugadores se han enfrentado (equipos cruzados)
    interacciones_totales: int  # veces que han jugado en la misma partida (cualquier combo)


@router.get("/sugerencias", response_model=list[Sugerencia])
def sugerencias_partidas(
    jugadores_por_equipo: int = 1,
    session: Session = Depends(get_session),
):
    """Devuelve matchups sugeridos basados en los enfrentamientos históricos más bajos."""
    jugadores = session.exec(select(Jugador).order_by(Jugador.nombre)).all()
    if len(jugadores) < jugadores_por_equipo * 2:
        return []

    # Matrices de interacción
    confrontaciones: dict = defaultdict(lambda: defaultdict(int))  # equipos opuestos
    interacciones: dict = defaultdict(lambda: defaultdict(int))     # misma partida, cualquier equipo

    partidas = session.exec(select(Partida)).all()
    for partida in partidas:
        pjs = session.exec(
            select(PartidaJugador).where(PartidaJugador.partida_id == partida.id)
        ).all()
        eq1 = [p.jugador_id for p in pjs if p.equipo == 1]
        eq2 = [p.jugador_id for p in pjs if p.equipo == 2]
        todos = eq1 + eq2

        for a, b in combinations(sorted(todos), 2):
            interacciones[a][b] += 1
            interacciones[b][a] += 1

        for a in eq1:
            for b in eq2:
                confrontaciones[a][b] += 1
                confrontaciones[b][a] += 1

    jug_map = {j.id: j for j in jugadores}
    jug_ids = [j.id for j in jugadores]
    candidatos: list[tuple] = []
    seen: set = set()

    if jugadores_por_equipo == 1:
        for a, b in combinations(jug_ids, 2):
            key = (min(a, b), max(a, b))
            if key in seen:
                continue
            seen.add(key)
            candidatos.append((
                confrontaciones[a][b],
                interacciones[a][b],
                [a], [b],
            ))
    else:
        for t1 in combinations(jug_ids, jugadores_por_equipo):
            restantes = [j for j in jug_ids if j not in t1]
            for t2 in combinations(restantes, jugadores_por_equipo):
                t1s = tuple(sorted(t1))
                t2s = tuple(sorted(t2))
                key = (min(t1s, t2s), max(t1s, t2s))
                if key in seen:
                    continue
                seen.add(key)
                enf = sum(confrontaciones[a][b] for a in t1s for b in t2s)
                intr = sum(interacciones[a][b] for a in t1s for b in t2s)
                candidatos.append((enf, intr, list(t1s), list(t2s)))

    candidatos.sort(key=lambda x: (x[0], x[1]))

    result = []
    for enf, intr, t1_ids, t2_ids in candidatos[:6]:
        result.append(Sugerencia(
            equipo1=[SugerenciaJugador(id=i, nombre=jug_map[i].nombre, color=jug_map[i].color) for i in t1_ids],
            equipo2=[SugerenciaJugador(id=i, nombre=jug_map[i].nombre, color=jug_map[i].color) for i in t2_ids],
            enfrentamientos=enf,
            interacciones_totales=intr,
        ))
    return result


@router.get("", response_model=list[PartidaResumen])
def listar_partidas(session: Session = Depends(get_session)):
    partidas = session.exec(select(Partida).order_by(Partida.fecha.desc())).all()
    return [_build_resumen(session, p) for p in partidas]


@router.post("", response_model=PartidaResumen, status_code=201)
def crear_partida(datos: PartidaCreate, session: Session = Depends(get_session)):
    if datos.modalidad not in ("bola8", "bola9"):
        raise HTTPException(status_code=400, detail="Modalidad inválida")

    todos_ids = datos.equipo1.jugador_ids + datos.equipo2.jugador_ids
    if len(todos_ids) != len(set(todos_ids)):
        raise HTTPException(status_code=400, detail="Un jugador no puede estar en ambos equipos")

    for jid in todos_ids:
        if not session.get(Jugador, jid):
            raise HTTPException(status_code=404, detail=f"Jugador {jid} no encontrado")

    partida = Partida(modalidad=datos.modalidad)
    session.add(partida)
    session.flush()

    orden = 0
    for jid in datos.equipo1.jugador_ids:
        session.add(PartidaJugador(partida_id=partida.id, jugador_id=jid, equipo=1, orden=orden))
        orden += 1
    for jid in datos.equipo2.jugador_ids:
        session.add(PartidaJugador(partida_id=partida.id, jugador_id=jid, equipo=2, orden=orden))
        orden += 1

    # Primer jugador: el indicado o por defecto el primero del equipo 1
    if datos.primer_jugador_id and datos.primer_jugador_id in todos_ids:
        partida.siguiente_jugador_id = datos.primer_jugador_id
    else:
        partida.siguiente_jugador_id = datos.equipo1.jugador_ids[0]
    session.commit()
    session.refresh(partida)
    return _build_resumen(session, partida)


@router.get("/{partida_id}", response_model=PartidaResumen)
def obtener_partida(partida_id: int, session: Session = Depends(get_session)):
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    return _build_resumen(session, partida)


@router.get("/{partida_id}/estado")
def estado_partida(partida_id: int, session: Session = Depends(get_session)):
    """Devuelve bolas metidas y bolas pendientes por equipo."""
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    turnos = session.exec(select(Turno).where(Turno.partida_id == partida_id)).all()
    metidas: set[int] = set()
    for t in turnos:
        metidas.update(t.bolas_metidas)

    lisas = set(range(1, 8))
    rayadas = set(range(9, 16))

    def pendientes_grupo(grupo: str | None) -> list[int]:
        if grupo == "lisas":
            return sorted(lisas - metidas)
        if grupo == "rayadas":
            return sorted(rayadas - metidas)
        return []

    # Bola 9: bolas 1-9 pendientes y objetivo (la más baja en mesa)
    bolas_pendientes_9: list[int] = []
    bola_objetivo: int | None = None
    if partida.modalidad == "bola9":
        bolas_9 = set(range(1, 10))
        bolas_pendientes_9 = sorted(bolas_9 - metidas)
        bola_objetivo = bolas_pendientes_9[0] if bolas_pendientes_9 else None

    return {
        "bolas_metidas": sorted(metidas),
        "equipo1_pendientes": pendientes_grupo(partida.equipo1_grupo),
        "equipo2_pendientes": pendientes_grupo(partida.equipo2_grupo),
        "bolas_pendientes_9": bolas_pendientes_9,
        "bola_objetivo": bola_objetivo,
    }


@router.get("/{partida_id}/eventos")
async def eventos_partida(partida_id: int, request: Request):
    """SSE: envía 'update' cada vez que cambia el estado de la partida."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=20)
    events._subscribers[partida_id].add(queue)

    async def stream():
        try:
            yield "data: connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=25)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"  # keep-alive, no dispara onmessage
        finally:
            events._subscribers[partida_id].discard(queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.patch("/{partida_id}/tiempos", response_model=PartidaResumen)
def actualizar_tiempos(partida_id: int, datos: TiemposUpdate, session: Session = Depends(get_session)):
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    if datos.fecha is not None:
        partida.fecha = datos.fecha
    if datos.fecha_fin is not None:
        partida.fecha_fin = datos.fecha_fin
    session.add(partida)
    session.commit()
    session.refresh(partida)
    return _build_resumen(session, partida)


@router.delete("/{partida_id}", status_code=204)
def eliminar_partida(partida_id: int, session: Session = Depends(get_session)):
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    # Eliminar turnos y participaciones primero
    for t in session.exec(select(Turno).where(Turno.partida_id == partida_id)).all():
        session.delete(t)
    for pj in session.exec(select(PartidaJugador).where(PartidaJugador.partida_id == partida_id)).all():
        session.delete(pj)
    session.delete(partida)
    session.commit()
