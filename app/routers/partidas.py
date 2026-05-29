import asyncio
from collections import defaultdict
from datetime import datetime
from itertools import combinations
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func
from pydantic import BaseModel
from typing import Optional

from app.models import Partida, PartidaJugador, Jugador, Turno, TorneoEnfrentamiento, Torneo
from app.database import get_session
from app.logic_logros import LogroNuevo, snapshot_logros, calcular_logros_nuevos
from app import events

router = APIRouter(prefix="/api/partidas", tags=["partidas"])


class EquipoInput(BaseModel):
    jugador_ids: list[int]  # al menos 1 jugador por equipo


class PartidaCreate(BaseModel):
    modalidad: str = "bola8"
    equipo1: EquipoInput
    equipo2: EquipoInput
    primer_jugador_id: Optional[int] = None
    equipo1_nombre: Optional[str] = None
    equipo2_nombre: Optional[str] = None


class TiemposUpdate(BaseModel):
    fecha: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None


class PartidaResumen(BaseModel):
    id: int
    numero: int
    modalidad: str
    fecha: datetime
    fecha_fin: Optional[datetime]
    estado: str
    ganador_equipo: Optional[int]
    equipo1_grupo: Optional[str]
    equipo2_grupo: Optional[str]
    equipo1_nombre: Optional[str] = None
    equipo2_nombre: Optional[str] = None
    siguiente_jugador_id: Optional[int]
    bola_en_mano: bool
    equipo1_jugadores: list[int]
    equipo2_jugadores: list[int]
    torneo_id: Optional[int] = None
    torneo_nombre: Optional[str] = None
    logros_nuevos: list[LogroNuevo] = []


def _build_torneo_map(session: Session) -> dict:
    """Returns {partida_id: (torneo_id, torneo_nombre)} for all linked enfrentamientos."""
    enfs = session.exec(
        select(TorneoEnfrentamiento).where(TorneoEnfrentamiento.partida_id.isnot(None))
    ).all()
    result = {}
    for enf in enfs:
        torneo = session.get(Torneo, enf.torneo_id)
        if torneo:
            result[enf.partida_id] = (torneo.id, torneo.nombre)
    return result


def _build_resumen(
    session: Session,
    partida: Partida,
    numero: Optional[int] = None,
    torneo_info: Optional[tuple] = None,
) -> PartidaResumen:
    pjs = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida.id)
        .order_by(PartidaJugador.orden)
    ).all()
    eq1 = [p.jugador_id for p in pjs if p.equipo == 1]
    eq2 = [p.jugador_id for p in pjs if p.equipo == 2]
    if numero is None:
        numero = session.exec(
            select(func.count(Partida.id)).where(Partida.id <= partida.id)
        ).one()
    return PartidaResumen(
        id=partida.id,
        numero=numero,
        modalidad=partida.modalidad,
        fecha=partida.fecha,
        fecha_fin=partida.fecha_fin,
        estado=partida.estado,
        ganador_equipo=partida.ganador_equipo,
        equipo1_grupo=partida.equipo1_grupo,
        equipo2_grupo=partida.equipo2_grupo,
        equipo1_nombre=partida.equipo1_nombre,
        equipo2_nombre=partida.equipo2_nombre,
        siguiente_jugador_id=partida.siguiente_jugador_id,
        bola_en_mano=partida.bola_en_mano,
        equipo1_jugadores=eq1,
        equipo2_jugadores=eq2,
        torneo_id=torneo_info[0] if torneo_info else None,
        torneo_nombre=torneo_info[1] if torneo_info else None,
    )


class SugerenciaJugador(BaseModel):
    id: int
    nombre: str
    color: Optional[str] = None


class Sugerencia(BaseModel):
    equipo1: list[SugerenciaJugador]
    equipo2: list[SugerenciaJugador]
    enfrentamientos: int   # partidas en este formato donde estos equipos específicos se enfrentaron
    partidas_juntos: int   # total partidas en este formato donde estos jugadores coincidieron


@router.get("/sugerencias", response_model=list[Sugerencia])
def sugerencias_partidas(
    jugadores_por_equipo: int = 1,
    modalidad: str = "bola8",
    session: Session = Depends(get_session),
):
    """Devuelve matchups sugeridos basados en enfrentamientos históricos del mismo formato y modalidad."""
    jugadores = session.exec(
        select(Jugador).where(Jugador.activo == True).order_by(Jugador.nombre)  # noqa: E712
    ).all()
    if len(jugadores) < jugadores_por_equipo * 2:
        return []

    # Contadores separados por formato — solo se cuentan partidas de la modalidad solicitada
    enf_1v1: dict = defaultdict(lambda: defaultdict(int))
    enf_2v2: dict = defaultdict(int)
    juntos_2v2: dict = defaultdict(int)

    partidas = session.exec(select(Partida).where(Partida.modalidad == modalidad)).all()
    for partida in partidas:
        pjs = session.exec(
            select(PartidaJugador).where(PartidaJugador.partida_id == partida.id)
        ).all()
        eq1 = [p.jugador_id for p in pjs if p.equipo == 1]
        eq2 = [p.jugador_id for p in pjs if p.equipo == 2]

        if len(eq1) == 1 and len(eq2) == 1:
            a, b = eq1[0], eq2[0]
            enf_1v1[a][b] += 1
            enf_1v1[b][a] += 1
        elif len(eq1) == 2 and len(eq2) == 2:
            key = tuple(sorted([tuple(sorted(eq1)), tuple(sorted(eq2))]))
            enf_2v2[key] += 1
            juntos_2v2[frozenset(eq1 + eq2)] += 1

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
            enf = enf_1v1[a][b]
            candidatos.append((enf, enf, [a], [b]))  # partidas_juntos == enfrentamientos en 1v1
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
                key_2v2 = tuple(sorted([t1s, t2s]))
                enf = enf_2v2.get(key_2v2, 0)
                juntos = juntos_2v2.get(frozenset(list(t1s) + list(t2s)), 0)
                candidatos.append((enf, juntos, list(t1s), list(t2s)))

    candidatos.sort(key=lambda x: (x[0], x[1]))

    result = []
    for enf, juntos, t1_ids, t2_ids in candidatos[:6]:
        result.append(Sugerencia(
            equipo1=[SugerenciaJugador(id=i, nombre=jug_map[i].nombre, color=jug_map[i].color) for i in t1_ids],
            equipo2=[SugerenciaJugador(id=i, nombre=jug_map[i].nombre, color=jug_map[i].color) for i in t2_ids],
            enfrentamientos=enf,
            partidas_juntos=juntos,
        ))
    return result


@router.get("/sugerencia-saque")
def sugerencia_saque(jugadores: str, session: Session = Depends(get_session)):
    """Dado un conjunto de jugadores, devuelve quién sacó en la última partida finalizada con esa combinación exacta."""
    ids = {int(x) for x in jugadores.split(",") if x.strip()}
    if not ids:
        return {"ultimo_saque_id": None}

    # Partidas que contienen AL MENOS uno de esos jugadores
    pjs = session.exec(
        select(PartidaJugador).where(PartidaJugador.jugador_id.in_(list(ids)))
    ).all()

    # Agrupar por partida_id y verificar coincidencia exacta de jugadores
    from collections import defaultdict
    partida_players: dict[int, set] = defaultdict(set)
    for pj in pjs:
        partida_players[pj.partida_id].add(pj.jugador_id)

    matching = [pid for pid, player_set in partida_players.items() if player_set == ids]
    if not matching:
        return {"ultimo_saque_id": None}

    # Última partida finalizada de esa combinación
    partidas = [session.get(Partida, pid) for pid in matching]
    finished = [p for p in partidas if p and p.estado == "finalizada"]
    if not finished:
        return {"ultimo_saque_id": None}

    latest = max(finished, key=lambda p: p.fecha)

    # Turno número 1 = quien sacó
    turno1 = session.exec(
        select(Turno).where(Turno.partida_id == latest.id, Turno.numero == 1)
    ).first()

    return {"ultimo_saque_id": turno1.jugador_id if turno1 else None}


@router.get("", response_model=list[PartidaResumen])
def listar_partidas(session: Session = Depends(get_session)):
    partidas = session.exec(select(Partida).order_by(Partida.fecha.desc())).all()
    ids_ordenados = session.exec(select(Partida.id).order_by(Partida.id)).all()
    numero_map = {pid: i + 1 for i, pid in enumerate(ids_ordenados)}
    torneo_map = _build_torneo_map(session)
    return [_build_resumen(session, p, numero_map[p.id], torneo_map.get(p.id)) for p in partidas]


@router.post("", response_model=PartidaResumen, status_code=201)
def crear_partida(datos: PartidaCreate, session: Session = Depends(get_session)):
    if datos.modalidad not in ("bola8", "bola9"):
        raise HTTPException(status_code=400, detail="Modalidad inválida")

    if not datos.equipo1.jugador_ids or not datos.equipo2.jugador_ids:
        raise HTTPException(status_code=400, detail="Cada equipo necesita al menos un jugador")

    todos_ids = datos.equipo1.jugador_ids + datos.equipo2.jugador_ids
    if len(todos_ids) != len(set(todos_ids)):
        raise HTTPException(status_code=400, detail="Un jugador no puede estar en ambos equipos")

    nombres_map: dict[int, str] = {}
    for jid in todos_ids:
        jugador = session.get(Jugador, jid)
        if not jugador:
            raise HTTPException(status_code=404, detail=f"Jugador {jid} no encontrado")
        nombres_map[jid] = jugador.nombre

    # Snapshot de logros ANTES de crear la partida (detecta primera_partida, rodaje, …)
    antes_map = snapshot_logros(todos_ids, session)

    partida = Partida(
        modalidad=datos.modalidad,
        equipo1_nombre=datos.equipo1_nombre or None,
        equipo2_nombre=datos.equipo2_nombre or None,
    )
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

    resumen = _build_resumen(session, partida)
    resumen.logros_nuevos = calcular_logros_nuevos(antes_map, nombres_map, session)
    return resumen


@router.get("/{partida_id}", response_model=PartidaResumen)
def obtener_partida(partida_id: int, session: Session = Depends(get_session)):
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    torneo_map = _build_torneo_map(session)
    return _build_resumen(session, partida, torneo_info=torneo_map.get(partida_id))


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
    enfs = session.exec(select(TorneoEnfrentamiento).where(TorneoEnfrentamiento.partida_id == partida_id)).all()
    for enf in enfs:
        torneo = session.get(Torneo, enf.torneo_id)
        if torneo and torneo.estado == "finalizado":
            raise HTTPException(
                status_code=409,
                detail="No se puede eliminar una partida de un torneo finalizado. Elimina el torneo si quieres borrar sus resultados."
            )
    for t in session.exec(select(Turno).where(Turno.partida_id == partida_id)).all():
        session.delete(t)
    for pj in session.exec(select(PartidaJugador).where(PartidaJugador.partida_id == partida_id)).all():
        session.delete(pj)
    for enf in enfs:
        enf.partida_id = None
        session.add(enf)
    session.delete(partida)
    session.commit()
