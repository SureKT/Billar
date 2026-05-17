from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from app.models import Partida, PartidaJugador, Turno, Jugador, Bola, Falta
from app.database import get_session
from app.logic import evaluar_turno
from app import events

router = APIRouter(prefix="/api/partidas", tags=["turnos"])


class TurnoCreate(BaseModel):
    jugador_id: int
    bolas_metidas: list[int] = []  # números de bola (0-15)
    falta_id: Optional[int] = None
    falta_ids: list[int] = []      # todas las faltas del turno (para stats)
    bola_en_mano: bool = False


class TurnoResponse(BaseModel):
    id: int
    partida_id: int
    jugador_id: int
    falta_id: Optional[int]
    numero: int
    repite: bool
    bola_en_mano: bool
    es_respot: bool = False
    bolas_metidas: list[int]
    # Resultado de la evaluación
    grupos_asignados: bool = False
    partida_finalizada: bool = False
    ganador_equipo: Optional[int] = None
    siguiente_jugador_id: Optional[int] = None
    bola_en_mano_siguiente: bool = False


@router.get("/{partida_id}/turnos", response_model=list[TurnoResponse])
def listar_turnos(partida_id: int, session: Session = Depends(get_session)):
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    turnos = session.exec(
        select(Turno).where(Turno.partida_id == partida_id).order_by(Turno.numero)
    ).all()
    return [
        TurnoResponse(
            id=t.id,
            partida_id=t.partida_id,
            jugador_id=t.jugador_id,
            falta_id=t.falta_id,
            numero=t.numero,
            repite=t.repite,
            bola_en_mano=t.bola_en_mano,
            es_respot=t.es_respot,
            bolas_metidas=t.bolas_metidas,
        )
        for t in turnos
    ]


@router.post("/{partida_id}/turnos", response_model=TurnoResponse, status_code=201)
def registrar_turno(
    partida_id: int,
    datos: TurnoCreate,
    session: Session = Depends(get_session),
):
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    if partida.estado != "en_curso":
        raise HTTPException(status_code=400, detail="La partida ya ha finalizado")
    if not session.get(Jugador, datos.jugador_id):
        raise HTTPException(status_code=404, detail="Jugador no encontrado")

    # Validar bolas
    for b in datos.bolas_metidas:
        bola = session.get(Bola, b)
        if not bola:
            raise HTTPException(status_code=400, detail=f"Bola {b} no existe")

    # Número de turno
    ultimo = session.exec(
        select(Turno)
        .where(Turno.partida_id == partida_id)
        .order_by(Turno.numero.desc())
    ).first()
    numero = (ultimo.numero + 1) if ultimo else 1

    # Guardia de concurrencia: si ya existe ese número de turno, hay race condition
    if session.exec(select(Turno).where(
        Turno.partida_id == partida_id, Turno.numero == numero
    )).first():
        raise HTTPException(
            status_code=409,
            detail="Conflicto: otro turno fue registrado simultáneamente. Recarga la partida.",
        )

    # Auto-detección: blanca dentro
    # Se omite cuando:
    #  - Bola 8 entra también en Bola 8 (ese caso lo maneja la lógica de partida)
    #  - Bola 9 entra también en Bola 9 (respot de la 9 — lo maneja _evaluar_bola9)
    falta_id = datos.falta_id
    es_bola9 = partida.modalidad == "bola9"
    omitir_scratch = (
        (not es_bola9 and 8 in datos.bolas_metidas) or   # bola8: 8+blanca
        (es_bola9 and 9 in datos.bolas_metidas)           # bola9: 9+blanca → respot
    )
    if 0 in datos.bolas_metidas and not omitir_scratch:
        falta_blanca = session.exec(
            select(Falta).where(Falta.nombre == "Blanca dentro (Scratch)")
        ).first()
        if falta_blanca:
            falta_id = falta_blanca.id

    turno = Turno(
        partida_id=partida_id,
        jugador_id=datos.jugador_id,
        falta_id=falta_id,
        numero=numero,
        bola_en_mano=datos.bola_en_mano,
        repite=False,
    )
    turno.bolas_metidas = datos.bolas_metidas
    # Guardar todas las faltas del turno (falta_ids incluye las automáticas del frontend)
    # Si el frontend envía la lista completa la usamos; si no, derivamos de falta_id
    todas_faltas = list(dict.fromkeys(datos.falta_ids))  # dedup preservando orden
    if falta_id and falta_id not in todas_faltas:
        todas_faltas.insert(0, falta_id)
    turno.faltas_ids = todas_faltas

    session.add(turno)
    session.flush()

    resultado = evaluar_turno(session, partida, turno)

    session.add(partida)
    session.commit()
    session.refresh(turno)
    events.broadcast(partida_id)

    return TurnoResponse(
        id=turno.id,
        partida_id=turno.partida_id,
        jugador_id=turno.jugador_id,
        falta_id=turno.falta_id,
        numero=turno.numero,
        repite=turno.repite,
        bola_en_mano=turno.bola_en_mano,
        bolas_metidas=turno.bolas_metidas,
        grupos_asignados=resultado["grupos_asignados"],
        partida_finalizada=resultado["partida_finalizada"],
        ganador_equipo=resultado["ganador_equipo"],
        siguiente_jugador_id=resultado["siguiente_jugador_id"],
        bola_en_mano_siguiente=resultado["bola_en_mano_siguiente"],
    )


class TurnoInsertar(BaseModel):
    despues_de_numero: int   # 0 = antes del primer turno
    jugador_id: int
    bolas_metidas: list[int] = []
    falta_id: Optional[int] = None
    bola_en_mano: bool = False


@router.post("/{partida_id}/turnos/insertar", response_model=list[TurnoResponse])
def insertar_turno(
    partida_id: int,
    datos: TurnoInsertar,
    session: Session = Depends(get_session),
):
    """Inserta un turno entre dos existentes, renumera los posteriores y hace replay."""
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    if not session.get(Jugador, datos.jugador_id):
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    for b in datos.bolas_metidas:
        if not session.get(Bola, b):
            raise HTTPException(status_code=400, detail=f"Bola {b} no existe")

    # Renumerar todos los turnos con numero > despues_de_numero
    turnos_posteriores = session.exec(
        select(Turno)
        .where(Turno.partida_id == partida_id, Turno.numero > datos.despues_de_numero)
        .order_by(Turno.numero.desc())   # desc para evitar colisiones de unique constraint
    ).all()
    for t in turnos_posteriores:
        t.numero += 1
        session.add(t)
    session.flush()

    # Crear el nuevo turno
    nuevo = Turno(
        partida_id=partida_id,
        jugador_id=datos.jugador_id,
        falta_id=datos.falta_id,
        numero=datos.despues_de_numero + 1,
        bola_en_mano=datos.bola_en_mano,
        repite=False,
    )
    nuevo.bolas_metidas = datos.bolas_metidas
    nuevo.faltas_ids = [datos.falta_id] if datos.falta_id else []
    session.add(nuevo)
    session.flush()

    # Resetear partida y hacer replay completo
    primer_jugador = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida_id)
        .order_by(PartidaJugador.orden)
    ).first()

    partida.estado = "en_curso"
    partida.ganador_equipo = None
    partida.fecha_fin = None
    partida.equipo1_grupo = None
    partida.equipo2_grupo = None
    partida.siguiente_jugador_id = primer_jugador.jugador_id if primer_jugador else None
    partida.bola_en_mano = False

    todos_turnos = session.exec(
        select(Turno).where(Turno.partida_id == partida_id).order_by(Turno.numero)
    ).all()
    for t in todos_turnos:
        evaluar_turno(session, partida, t)

    session.add(partida)
    session.commit()
    events.broadcast(partida_id)

    # Devolver todos los turnos actualizados
    turnos_final = session.exec(
        select(Turno).where(Turno.partida_id == partida_id).order_by(Turno.numero)
    ).all()
    return [TurnoResponse(
        id=t.id, partida_id=t.partida_id, jugador_id=t.jugador_id,
        falta_id=t.falta_id, numero=t.numero, repite=t.repite,
        bola_en_mano=t.bola_en_mano, bolas_metidas=t.bolas_metidas,
    ) for t in turnos_final]


class TurnoEdit(BaseModel):
    bolas_metidas: list[int]
    falta_id: Optional[int] = None
    jugador_id: Optional[int] = None


@router.post("/{partida_id}/turnos/{turno_id}/editar", response_model=TurnoResponse)
def editar_turno(
    partida_id: int,
    turno_id: int,
    datos: TurnoEdit,
    session: Session = Depends(get_session),
):
    """Edita bolas y falta de un turno ya registrado y recalcula el estado completo por replay."""
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    turno = session.get(Turno, turno_id)
    if not turno or turno.partida_id != partida_id:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    # Validar bolas
    for b in datos.bolas_metidas:
        if not session.get(Bola, b):
            raise HTTPException(status_code=400, detail=f"Bola {b} no existe")

    # Aplicar los cambios al turno
    if datos.jugador_id is not None:
        turno.jugador_id = datos.jugador_id
    turno.bolas_metidas = datos.bolas_metidas
    turno.falta_id = datos.falta_id
    turno.faltas_ids = [datos.falta_id] if datos.falta_id else []

    # Obtener todos los turnos en orden
    todos_turnos = session.exec(
        select(Turno).where(Turno.partida_id == partida_id).order_by(Turno.numero)
    ).all()

    # Resetear partida al estado inicial
    primer_jugador = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida_id)
        .order_by(PartidaJugador.orden)
    ).first()

    partida.estado = "en_curso"
    partida.ganador_equipo = None
    partida.fecha_fin = None
    partida.equipo1_grupo = None
    partida.equipo2_grupo = None
    partida.siguiente_jugador_id = primer_jugador.jugador_id if primer_jugador else None
    partida.bola_en_mano = False

    # Replay completo con todos los turnos
    ultimo_resultado = {}
    for t in todos_turnos:
        ultimo_resultado = evaluar_turno(session, partida, t)

    session.add(partida)
    session.commit()
    session.refresh(turno)
    events.broadcast(partida_id)

    partida2 = session.get(Partida, partida_id)
    turno_resultado = {
        "grupos_asignados":       ultimo_resultado.get("grupos_asignados", False),
        "partida_finalizada":     partida2.estado == "finalizada",
        "ganador_equipo":         partida2.ganador_equipo,
        "siguiente_jugador_id":   partida2.siguiente_jugador_id,
        "bola_en_mano_siguiente": partida2.bola_en_mano,
    }

    return TurnoResponse(
        id=turno.id,
        partida_id=turno.partida_id,
        jugador_id=turno.jugador_id,
        falta_id=turno.falta_id,
        numero=turno.numero,
        repite=turno.repite,
        bola_en_mano=turno.bola_en_mano,
        bolas_metidas=turno.bolas_metidas,
        **turno_resultado,
    )


@router.post("/{partida_id}/turnos/{turno_id}/eliminar", status_code=204)
def eliminar_turno(
    partida_id: int,
    turno_id: int,
    session: Session = Depends(get_session),
):
    """Elimina un turno concreto, renumera los posteriores y recalcula por replay."""
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    turno = session.get(Turno, turno_id)
    if not turno or turno.partida_id != partida_id:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    numero_eliminado = turno.numero
    session.delete(turno)
    session.flush()

    # Renumerar turnos posteriores (asc para evitar colisiones de unique constraint)
    posteriores = session.exec(
        select(Turno)
        .where(Turno.partida_id == partida_id, Turno.numero > numero_eliminado)
        .order_by(Turno.numero.asc())
    ).all()
    for t in posteriores:
        t.numero -= 1
        session.add(t)
    session.flush()

    # Resetear y replay
    primer_jugador = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida_id)
        .order_by(PartidaJugador.orden)
    ).first()

    partida.estado = "en_curso"
    partida.ganador_equipo = None
    partida.fecha_fin = None
    partida.equipo1_grupo = None
    partida.equipo2_grupo = None
    partida.siguiente_jugador_id = primer_jugador.jugador_id if primer_jugador else None
    partida.bola_en_mano = False

    for t in session.exec(
        select(Turno).where(Turno.partida_id == partida_id).order_by(Turno.numero)
    ).all():
        evaluar_turno(session, partida, t)

    session.add(partida)
    session.commit()
    events.broadcast(partida_id)


@router.delete("/{partida_id}/turnos/ultimo", status_code=204)
def deshacer_ultimo_turno(partida_id: int, session: Session = Depends(get_session)):
    """Elimina el último turno y recalcula el estado completo de la partida por replay."""
    partida = session.get(Partida, partida_id)
    if not partida:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    turnos = session.exec(
        select(Turno).where(Turno.partida_id == partida_id).order_by(Turno.numero)
    ).all()

    if not turnos:
        raise HTTPException(status_code=400, detail="No hay turnos que deshacer")

    # Borrar el último
    session.delete(turnos[-1])
    session.flush()
    turnos_restantes = turnos[:-1]

    # Resetear partida al estado inicial
    primer_jugador = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida_id)
        .order_by(PartidaJugador.orden)
    ).first()

    partida.estado = "en_curso"
    partida.ganador_equipo = None
    partida.fecha_fin = None
    partida.equipo1_grupo = None
    partida.equipo2_grupo = None
    partida.siguiente_jugador_id = primer_jugador.jugador_id if primer_jugador else None
    partida.bola_en_mano = False

    # Replay de todos los turnos restantes
    for t in turnos_restantes:
        evaluar_turno(session, partida, t)

    session.add(partida)
    session.commit()
    events.broadcast(partida_id)
