from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from app.models import Partida, PartidaJugador, Turno, Jugador, Bola, Falta
from app.database import get_session
from app.logic import evaluar_turno

router = APIRouter(prefix="/api/partidas", tags=["turnos"])


class TurnoCreate(BaseModel):
    jugador_id: int
    bolas_metidas: list[int] = []  # números de bola (0-15)
    falta_id: Optional[int] = None
    bola_en_mano: bool = False


class TurnoResponse(BaseModel):
    id: int
    partida_id: int
    jugador_id: int
    falta_id: Optional[int]
    numero: int
    repite: bool
    bola_en_mano: bool
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

    session.add(turno)
    session.flush()

    resultado = evaluar_turno(session, partida, turno)

    session.add(partida)
    session.commit()
    session.refresh(turno)

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
    partida.equipo1_grupo = None
    partida.equipo2_grupo = None
    partida.siguiente_jugador_id = primer_jugador.jugador_id if primer_jugador else None
    partida.bola_en_mano = False

    # Replay de todos los turnos restantes
    for t in turnos_restantes:
        evaluar_turno(session, partida, t)

    session.add(partida)
    session.commit()
