"""
Lógica de negocio: evaluación de turno, asignación de grupos, fin de partida.
"""
from sqlmodel import Session, select
from app.models import Partida, Turno, Falta, PartidaJugador


def _jugadores_equipo(session: Session, partida_id: int, equipo: int) -> list[int]:
    rows = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida_id, PartidaJugador.equipo == equipo)
        .order_by(PartidaJugador.orden)
    ).all()
    return [r.jugador_id for r in rows]


def _equipo_de_jugador(session: Session, partida_id: int, jugador_id: int) -> int:
    row = session.exec(
        select(PartidaJugador).where(
            PartidaJugador.partida_id == partida_id,
            PartidaJugador.jugador_id == jugador_id,
        )
    ).first()
    return row.equipo if row else 1


def _bolas_pendientes_equipo(session: Session, partida: Partida, equipo: int) -> list[int]:
    grupo = partida.equipo1_grupo if equipo == 1 else partida.equipo2_grupo
    if grupo is None:
        return []
    grupo_bolas = set(range(1, 8)) if grupo == "lisas" else set(range(9, 16))
    turnos = session.exec(select(Turno).where(Turno.partida_id == partida.id)).all()
    metidas: set[int] = set()
    for t in turnos:
        metidas.update(t.bolas_metidas)
    return list(grupo_bolas - metidas)


def _tres_faltas_consecutivas(session: Session, partida_id: int, equipo: int) -> bool:
    jugadores = _jugadores_equipo(session, partida_id, equipo)
    if not jugadores:
        return False
    turnos = session.exec(
        select(Turno)
        .where(Turno.partida_id == partida_id, Turno.jugador_id.in_(jugadores))
        .order_by(Turno.numero.desc())
    ).all()
    if len(turnos) < 3:
        return False
    return all(t.falta_id is not None for t in turnos[:3])


def _siguiente_jugador_circular(session: Session, partida: Partida, jugador_actual_id: int) -> int:
    todos = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida.id)
        .order_by(PartidaJugador.orden)
    ).all()
    ids = [r.jugador_id for r in todos]
    if not ids:
        return jugador_actual_id
    idx = ids.index(jugador_actual_id) if jugador_actual_id in ids else 0
    return ids[(idx + 1) % len(ids)]


def _get_falta_id(session: Session, nombre: str) -> int | None:
    f = session.exec(select(Falta).where(Falta.nombre == nombre)).first()
    return f.id if f else None


def _mete_bola_propia(bolas: list[int], grupo: str | None) -> bool:
    """True si al menos una bola metida pertenece al grupo propio (o a cualquier grupo si aún no hay)."""
    if not grupo:
        return any(1 <= b <= 7 or 9 <= b <= 15 for b in bolas)
    if grupo == "lisas":
        return any(1 <= b <= 7 for b in bolas)
    if grupo == "rayadas":
        return any(9 <= b <= 15 for b in bolas)
    return False


def evaluar_turno(session: Session, partida: Partida, turno: Turno) -> dict:
    """
    Aplica la lógica de negocio tras registrar un turno.
    Modifica `partida` y `turno` en memoria. No hace commit — el caller lo hace.
    """
    resultado = {
        "grupos_asignados": False,
        "partida_finalizada": False,
        "ganador_equipo": None,
        "repite": False,
        "siguiente_jugador_id": None,
        "bola_en_mano_siguiente": False,
    }

    bolas = turno.bolas_metidas
    equipo_actual = _equipo_de_jugador(session, partida.id, turno.jugador_id)
    equipo_rival = 2 if equipo_actual == 1 else 1

    # --- Falta (incluye Blanca dentro auto-asignada antes de llamar a esta función) ---
    if turno.falta_id is not None:
        falta = session.get(Falta, turno.falta_id)
        penalizacion = falta.penalizacion if falta else "ninguna"

        if penalizacion == "pierde_partida":
            partida.estado = "finalizada"
            partida.ganador_equipo = equipo_rival
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_rival
            return resultado

        turno.repite = False
        sig = _siguiente_jugador_circular(session, partida, turno.jugador_id)
        resultado["siguiente_jugador_id"] = sig
        resultado["bola_en_mano_siguiente"] = (penalizacion == "bola_en_mano")
        partida.siguiente_jugador_id = sig
        partida.bola_en_mano = resultado["bola_en_mano_siguiente"]

        # Tres faltas consecutivas
        if _tres_faltas_consecutivas(session, partida.id, equipo_actual):
            turno.falta_id = _get_falta_id(session, "Tres faltas consecutivas") or turno.falta_id
            partida.estado = "finalizada"
            partida.ganador_equipo = equipo_rival
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_rival

        return resultado

    # --- Sin falta ---

    # Break (turno numero == 1)
    if turno.numero == 1:
        if 8 in bolas:
            partida.estado = "finalizada"
            partida.ganador_equipo = equipo_rival
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_rival
            return resultado
        turno.repite = _mete_bola_propia(bolas, None)
        resultado["repite"] = turno.repite
        resultado["siguiente_jugador_id"] = (
            turno.jugador_id if turno.repite
            else _siguiente_jugador_circular(session, partida, turno.jugador_id)
        )
        partida.siguiente_jugador_id = resultado["siguiente_jugador_id"]
        partida.bola_en_mano = False
        return resultado

    # Bola 8 metida (sin blanca — si hay blanca lo maneja el router antes)
    if 8 in bolas:
        pendientes = _bolas_pendientes_equipo(session, partida, equipo_actual)
        if pendientes:
            turno.falta_id = _get_falta_id(session, "Bola 8 ilegal")
            partida.estado = "finalizada"
            partida.ganador_equipo = equipo_rival
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_rival
        else:
            partida.estado = "finalizada"
            partida.ganador_equipo = equipo_actual
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_actual
        return resultado

    # Asignación de grupos (post-break, sin grupos, sin falta, sin 8 ni blanca)
    grupo_recien_asignado = None
    if (
        partida.equipo1_grupo is None
        and len(bolas) > 0
        and turno.numero > 1
    ):
        tipos = set()
        for b in bolas:
            if 1 <= b <= 7:
                tipos.add("lisas")
            elif 9 <= b <= 15:
                tipos.add("rayadas")

        if len(tipos) == 1:
            grupo_actual = tipos.pop()
            grupo_rival = "rayadas" if grupo_actual == "lisas" else "lisas"
            if equipo_actual == 1:
                partida.equipo1_grupo = grupo_actual
                partida.equipo2_grupo = grupo_rival
            else:
                partida.equipo2_grupo = grupo_actual
                partida.equipo1_grupo = grupo_rival
            grupo_recien_asignado = grupo_actual
            resultado["grupos_asignados"] = True

    # Grupo propio tras posible asignación
    grupo_propio = (
        grupo_recien_asignado
        if grupo_recien_asignado
        else (partida.equipo1_grupo if equipo_actual == 1 else partida.equipo2_grupo)
    )

    # Repite solo si metió bola de su propio grupo
    turno.repite = _mete_bola_propia(bolas, grupo_propio)
    resultado["repite"] = turno.repite
    resultado["siguiente_jugador_id"] = (
        turno.jugador_id if turno.repite
        else _siguiente_jugador_circular(session, partida, turno.jugador_id)
    )
    partida.siguiente_jugador_id = resultado["siguiente_jugador_id"]
    partida.bola_en_mano = False

    return resultado
