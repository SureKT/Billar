from datetime import datetime, timezone
from itertools import combinations
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from app.models import Torneo, TorneoJugador, TorneoEnfrentamiento, Jugador, Partida, PartidaJugador, Turno  # noqa: F401 (Turno/PartidaJugador used in delete)
from app.database import get_session
from app.logic_logros import snapshot_logros, calcular_logros_nuevos

router = APIRouter(prefix="/api/torneos", tags=["torneos"])


class TorneoCreate(BaseModel):
    nombre: str
    modalidad: str = "bola8"
    jugador_ids: list[int]


class EnfrentamientoResumen(BaseModel):
    id: int
    jugador1_id: int
    jugador1_nombre: str
    jugador1_color: Optional[str] = None
    jugador2_id: int
    jugador2_nombre: str
    jugador2_color: Optional[str] = None
    partida_id: Optional[int] = None
    partida_estado: Optional[str] = None
    ganador_jugador_id: Optional[int] = None


class ClasificacionEntry(BaseModel):
    jugador_id: int
    nombre: str
    color: Optional[str] = None
    pj: int
    victorias: int
    derrotas: int
    puntos: int
    bolas: int


class TorneoResumen(BaseModel):
    id: int
    nombre: str
    modalidad: str
    estado: str
    fecha: datetime
    fecha_fin: Optional[datetime] = None
    jugadores: list[int]
    clasificacion: list[ClasificacionEntry]
    enfrentamientos: list[EnfrentamientoResumen]
    total: int
    jugados: int


def _build_clasificacion(session: Session, jugadores: list, enfrentamientos: list) -> list[ClasificacionEntry]:
    stats = {j.id: {"pj": 0, "victorias": 0, "derrotas": 0, "bolas": 0} for j in jugadores}

    for enf in enfrentamientos:
        if enf.partida_id is None:
            continue
        partida = session.get(Partida, enf.partida_id)
        if not partida or partida.estado != "finalizada" or not partida.ganador_equipo:
            continue

        if enf.jugador1_id not in stats or enf.jugador2_id not in stats:
            continue
        stats[enf.jugador1_id]["pj"] += 1
        stats[enf.jugador2_id]["pj"] += 1

        pjs = session.exec(select(PartidaJugador).where(PartidaJugador.partida_id == partida.id)).all()
        eq1_ids = [pj.jugador_id for pj in pjs if pj.equipo == 1]
        eq2_ids = [pj.jugador_id for pj in pjs if pj.equipo == 2]
        eq1 = eq1_ids[0] if eq1_ids else enf.jugador1_id
        eq2 = eq2_ids[0] if eq2_ids else enf.jugador2_id
        ganador_id = eq1 if partida.ganador_equipo == 1 else eq2
        perdedor_id = eq2 if partida.ganador_equipo == 1 else eq1
        stats[ganador_id]["victorias"] += 1
        stats[perdedor_id]["derrotas"] += 1

        turnos = session.exec(select(Turno).where(Turno.partida_id == enf.partida_id)).all()
        for t in turnos:
            if t.jugador_id in stats:
                stats[t.jugador_id]["bolas"] += len([b for b in t.bolas_metidas if b != 0])

    result = []
    for j in jugadores:
        s = stats[j.id]
        result.append(ClasificacionEntry(
            jugador_id=j.id,
            nombre=j.nombre,
            color=j.color,
            pj=s["pj"],
            victorias=s["victorias"],
            derrotas=s["derrotas"],
            puntos=s["victorias"] * 3,
            bolas=s["bolas"],
        ))

    result.sort(key=lambda x: (-x.puntos, -x.bolas, -x.victorias))
    return result


def _build_resumen(session: Session, torneo: Torneo) -> TorneoResumen:
    tjs = session.exec(select(TorneoJugador).where(TorneoJugador.torneo_id == torneo.id)).all()
    jugador_ids = [tj.jugador_id for tj in tjs]
    jugadores = [j for j in [session.get(Jugador, jid) for jid in jugador_ids] if j]
    jug_map = {j.id: j for j in jugadores}

    enfrentamientos = session.exec(
        select(TorneoEnfrentamiento).where(TorneoEnfrentamiento.torneo_id == torneo.id)
    ).all()

    clasificacion = _build_clasificacion(session, jugadores, enfrentamientos)

    enf_resumen = []
    for enf in enfrentamientos:
        j1 = jug_map.get(enf.jugador1_id)
        j2 = jug_map.get(enf.jugador2_id)
        partida_estado = None
        ganador_jugador_id = None
        if enf.partida_id:
            p = session.get(Partida, enf.partida_id)
            if p:
                partida_estado = p.estado
                if p.estado == "finalizada" and p.ganador_equipo:
                    pjs = session.exec(select(PartidaJugador).where(PartidaJugador.partida_id == p.id)).all()
                    eq1_ids = [pj.jugador_id for pj in pjs if pj.equipo == 1]
                    eq2_ids = [pj.jugador_id for pj in pjs if pj.equipo == 2]
                    eq1 = eq1_ids[0] if eq1_ids else enf.jugador1_id
                    eq2 = eq2_ids[0] if eq2_ids else enf.jugador2_id
                    ganador_jugador_id = eq1 if p.ganador_equipo == 1 else eq2
        enf_resumen.append(EnfrentamientoResumen(
            id=enf.id,
            jugador1_id=enf.jugador1_id,
            jugador1_nombre=j1.nombre if j1 else "?",
            jugador1_color=j1.color if j1 else None,
            jugador2_id=enf.jugador2_id,
            jugador2_nombre=j2.nombre if j2 else "?",
            jugador2_color=j2.color if j2 else None,
            partida_id=enf.partida_id,
            partida_estado=partida_estado,
            ganador_jugador_id=ganador_jugador_id,
        ))

    jugados = sum(1 for e in enf_resumen if e.partida_estado == "finalizada")
    return TorneoResumen(
        id=torneo.id,
        nombre=torneo.nombre,
        modalidad=torneo.modalidad,
        estado=torneo.estado,
        fecha=torneo.fecha,
        fecha_fin=torneo.fecha_fin,
        jugadores=jugador_ids,
        clasificacion=clasificacion,
        enfrentamientos=enf_resumen,
        total=len(enf_resumen),
        jugados=jugados,
    )


@router.get("", response_model=list[TorneoResumen])
def listar_torneos(session: Session = Depends(get_session)):
    torneos = session.exec(select(Torneo).order_by(Torneo.fecha.desc())).all()
    return [_build_resumen(session, t) for t in torneos]


@router.post("", response_model=TorneoResumen, status_code=201)
def crear_torneo(datos: TorneoCreate, session: Session = Depends(get_session)):
    if datos.modalidad not in ("bola8", "bola9"):
        raise HTTPException(status_code=400, detail="Modalidad inválida")
    if len(datos.jugador_ids) < 3:
        raise HTTPException(status_code=400, detail="Mínimo 3 jugadores")
    if len(datos.jugador_ids) != len(set(datos.jugador_ids)):
        raise HTTPException(status_code=400, detail="Jugadores duplicados")
    for jid in datos.jugador_ids:
        if not session.get(Jugador, jid):
            raise HTTPException(status_code=404, detail=f"Jugador {jid} no encontrado")

    torneo = Torneo(nombre=datos.nombre, modalidad=datos.modalidad)
    session.add(torneo)
    session.flush()

    for jid in datos.jugador_ids:
        session.add(TorneoJugador(torneo_id=torneo.id, jugador_id=jid))

    for j1_id, j2_id in combinations(datos.jugador_ids, 2):
        session.add(TorneoEnfrentamiento(torneo_id=torneo.id, jugador1_id=j1_id, jugador2_id=j2_id))

    session.commit()
    session.refresh(torneo)
    return _build_resumen(session, torneo)


@router.get("/{torneo_id}", response_model=TorneoResumen)
def obtener_torneo(torneo_id: int, session: Session = Depends(get_session)):
    torneo = session.get(Torneo, torneo_id)
    if not torneo:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    return _build_resumen(session, torneo)


class JugarEnfrentamientoBody(BaseModel):
    primer_jugador_id: Optional[int] = None


@router.post("/{torneo_id}/enfrentamientos/{enf_id}/jugar")
def jugar_enfrentamiento(
    torneo_id: int,
    enf_id: int,
    body: JugarEnfrentamientoBody = JugarEnfrentamientoBody(),
    session: Session = Depends(get_session),
):
    torneo = session.get(Torneo, torneo_id)
    if not torneo:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    enf = session.get(TorneoEnfrentamiento, enf_id)
    if not enf or enf.torneo_id != torneo_id:
        raise HTTPException(status_code=404, detail="Enfrentamiento no encontrado")
    if enf.partida_id is not None:
        raise HTTPException(status_code=400, detail="Ya tiene partida asociada")

    primer_id = body.primer_jugador_id
    if primer_id not in (enf.jugador1_id, enf.jugador2_id):
        primer_id = enf.jugador1_id

    # equipo 1 = quien empieza
    eq1_id = primer_id
    eq2_id = enf.jugador2_id if primer_id == enf.jugador1_id else enf.jugador1_id

    j1 = session.get(Jugador, eq1_id)
    j2 = session.get(Jugador, eq2_id)

    # Snapshot de logros ANTES de crear la partida (detecta primera_partida, rodaje, …)
    nombres_map = {eq1_id: j1.nombre if j1 else f"#{eq1_id}",
                   eq2_id: j2.nombre if j2 else f"#{eq2_id}"}
    antes_map = snapshot_logros([eq1_id, eq2_id], session)

    partida = Partida(
        modalidad=torneo.modalidad,
        equipo1_nombre=j1.nombre if j1 else None,
        equipo2_nombre=j2.nombre if j2 else None,
    )
    session.add(partida)
    session.flush()

    session.add(PartidaJugador(partida_id=partida.id, jugador_id=eq1_id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=partida.id, jugador_id=eq2_id, equipo=2, orden=1))
    partida.siguiente_jugador_id = eq1_id

    enf.partida_id = partida.id
    session.add(enf)
    session.commit()

    logros_nuevos = calcular_logros_nuevos(antes_map, nombres_map, session)
    return {"partida_id": partida.id, "logros_nuevos": [l.model_dump() for l in logros_nuevos]}


@router.patch("/{torneo_id}/finalizar", response_model=TorneoResumen)
def finalizar_torneo(torneo_id: int, session: Session = Depends(get_session)):
    torneo = session.get(Torneo, torneo_id)
    if not torneo:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    torneo.estado = "finalizado"
    torneo.fecha_fin = datetime.now(timezone.utc)
    session.add(torneo)
    session.commit()
    session.refresh(torneo)
    return _build_resumen(session, torneo)


class EliminarTorneoBody(BaseModel):
    eliminar_partidas: bool = False


@router.delete("/{torneo_id}", status_code=204)
def eliminar_torneo(
    torneo_id: int,
    body: EliminarTorneoBody = EliminarTorneoBody(),
    session: Session = Depends(get_session),
):
    torneo = session.get(Torneo, torneo_id)
    if not torneo:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    enfs = session.exec(select(TorneoEnfrentamiento).where(TorneoEnfrentamiento.torneo_id == torneo_id)).all()
    if body.eliminar_partidas:
        for enf in enfs:
            if enf.partida_id:
                for t in session.exec(select(Turno).where(Turno.partida_id == enf.partida_id)).all():
                    session.delete(t)
                for pj in session.exec(select(PartidaJugador).where(PartidaJugador.partida_id == enf.partida_id)).all():
                    session.delete(pj)
                p = session.get(Partida, enf.partida_id)
                if p:
                    session.delete(p)
    for enf in enfs:
        session.delete(enf)
    for tj in session.exec(select(TorneoJugador).where(TorneoJugador.torneo_id == torneo_id)).all():
        session.delete(tj)
    session.delete(torneo)
    session.commit()
