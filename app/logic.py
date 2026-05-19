"""
Lógica de negocio: evaluación de turno, asignación de grupos, fin de partida.
"""
from datetime import datetime
from sqlmodel import Session, select
from app.models import Partida, Turno, Falta, PartidaJugador


def _finalizar(partida: Partida, ganador: int) -> None:
    """Marca la partida como finalizada y registra la hora de fin (hora local)."""
    partida.estado = "finalizada"
    partida.ganador_equipo = ganador
    partida.fecha_fin = datetime.now()


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


def _siguiente_jugador(session: Session, partida: Partida, jugador_actual_id: int) -> int:
    """El turno pasa al equipo rival. Dentro del rival, rota al siguiente tras el último que jugó."""
    equipo_actual = _equipo_de_jugador(session, partida.id, jugador_actual_id)
    equipo_rival = 2 if equipo_actual == 1 else 1
    rival_ids = _jugadores_equipo(session, partida.id, equipo_rival)
    if not rival_ids:
        return jugador_actual_id
    if len(rival_ids) == 1:
        return rival_ids[0]
    ultimo_rival = session.exec(
        select(Turno)
        .where(Turno.partida_id == partida.id, Turno.jugador_id.in_(rival_ids))
        .order_by(Turno.numero.desc())
    ).first()
    if ultimo_rival is None:
        return rival_ids[0]
    idx = rival_ids.index(ultimo_rival.jugador_id) if ultimo_rival.jugador_id in rival_ids else -1
    return rival_ids[(idx + 1) % len(rival_ids)]


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


def _evaluar_falta_comun(session: Session, partida: Partida, turno: Turno, resultado: dict) -> dict | None:
    """
    Procesa una falta: penalización, siguiente jugador, tres faltas consecutivas.
    Retorna el dict resultado si la falta fue procesada (el caller debe hacer return),
    o None si no había falta.
    """
    if turno.falta_id is None:
        return None

    falta = session.get(Falta, turno.falta_id)
    penalizacion = falta.penalizacion if falta else "ninguna"
    equipo_actual = _equipo_de_jugador(session, partida.id, turno.jugador_id)
    equipo_rival = 2 if equipo_actual == 1 else 1

    if penalizacion == "pierde_partida":
        _finalizar(partida, equipo_rival)
        resultado["partida_finalizada"] = True
        resultado["ganador_equipo"] = equipo_rival
        return resultado

    turno.repite = False
    sig = _siguiente_jugador(session, partida, turno.jugador_id)
    resultado["siguiente_jugador_id"] = sig
    resultado["bola_en_mano_siguiente"] = (penalizacion == "bola_en_mano")
    partida.siguiente_jugador_id = sig
    partida.bola_en_mano = resultado["bola_en_mano_siguiente"]

    if _tres_faltas_consecutivas(session, partida.id, equipo_actual):
        turno.falta_id = _get_falta_id(session, "Tres faltas consecutivas") or turno.falta_id
        _finalizar(partida, equipo_rival)
        resultado["partida_finalizada"] = True
        resultado["ganador_equipo"] = equipo_rival

    return resultado


def _evaluar_bola8(session: Session, partida: Partida, turno: Turno) -> dict:
    """Lógica de Bola 8."""
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

    # --- Break con bola 8: se evalúa ANTES de las faltas ---
    if turno.numero == 1 and 8 in bolas:
        if 0 in bolas:
            _finalizar(partida, equipo_rival)
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_rival
        else:
            _finalizar(partida, equipo_actual)
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_actual
        return resultado

    # --- Post-break con bola 8: se evalúa ANTES de las faltas ---
    # Regla: meter la 8 cometiendo cualquier falta = pierde siempre,
    # incluso si no quedaban bolas pendientes.
    if turno.numero > 1 and 8 in bolas:
        tiene_falta = turno.falta_id is not None
        if 0 in bolas or tiene_falta:
            # 8 + blanca, o 8 + cualquier falta → pierde
            turno.falta_id = turno.falta_id or _get_falta_id(session, "Bola 8 ilegal")
            _finalizar(partida, equipo_rival)
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_rival
        else:
            # Sin falta ni blanca: gana o pierde según grupos y pendientes
            sin_grupos = partida.equipo1_grupo is None
            pendientes = [] if sin_grupos else _bolas_pendientes_equipo(session, partida, equipo_actual)
            if sin_grupos or pendientes:
                turno.falta_id = _get_falta_id(session, "Bola 8 ilegal")
                _finalizar(partida, equipo_rival)
                resultado["partida_finalizada"] = True
                resultado["ganador_equipo"] = equipo_rival
            else:
                _finalizar(partida, equipo_actual)
                resultado["partida_finalizada"] = True
                resultado["ganador_equipo"] = equipo_actual
        return resultado

    # --- Falta sin bola 8 ---
    res_falta = _evaluar_falta_comun(session, partida, turno, resultado)
    if res_falta is not None:
        return res_falta

    # --- Sin falta, sin bola 8 ---

    # Break sin la 8
    if turno.numero == 1:
        turno.repite = _mete_bola_propia(bolas, None)
        resultado["repite"] = turno.repite
        resultado["siguiente_jugador_id"] = (
            turno.jugador_id if turno.repite
            else _siguiente_jugador(session, partida, turno.jugador_id)
        )
        partida.siguiente_jugador_id = resultado["siguiente_jugador_id"]
        partida.bola_en_mano = False
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

    turno.repite = _mete_bola_propia(bolas, grupo_propio)
    resultado["repite"] = turno.repite
    resultado["siguiente_jugador_id"] = (
        turno.jugador_id if turno.repite
        else _siguiente_jugador(session, partida, turno.jugador_id)
    )
    partida.siguiente_jugador_id = resultado["siguiente_jugador_id"]
    partida.bola_en_mano = False

    return resultado


def _evaluar_bola9(session: Session, partida: Partida, turno: Turno) -> dict:
    """
    Lógica de Bola 9.
    - Ganar: meter la 9 sin la blanca (incluso en el break = Golden Break).
    - 9 + blanca simultáneas: respot de la 9, bola en mano para el rival.
    - Repetir turno: meter cualquier bola 1-8 sin falta.
    - Falta → bola en mano para el rival (no hay grupos).
    - Tres faltas consecutivas del equipo → pierde.
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

    # --- Caso especial: 9 + blanca simultáneas → respot de la 9, bola en mano ---
    # Se evalúa ANTES que la falta genérica para poder quitar la 9 de bolas_metidas.
    if 9 in bolas and 0 in bolas:
        turno.bolas_metidas = [b for b in bolas if b != 9]   # la 9 vuelve a la mesa
        turno.es_respot = True
        turno.falta_id = turno.falta_id or _get_falta_id(session, "Blanca dentro (Scratch)")
        turno.repite = False
        sig = _siguiente_jugador(session, partida, turno.jugador_id)
        resultado["siguiente_jugador_id"] = sig
        resultado["bola_en_mano_siguiente"] = True
        partida.siguiente_jugador_id = sig
        partida.bola_en_mano = True
        # Tres faltas consecutivas
        if _tres_faltas_consecutivas(session, partida.id, equipo_actual):
            turno.falta_id = _get_falta_id(session, "Tres faltas consecutivas") or turno.falta_id
            _finalizar(partida, equipo_rival)
            resultado["partida_finalizada"] = True
            resultado["ganador_equipo"] = equipo_rival
        return resultado

    # --- Falta (sin caso 9+blanca) ---
    res_falta = _evaluar_falta_comun(session, partida, turno, resultado)
    if res_falta is not None:
        return res_falta

    # --- Sin falta ---

    # Meter la 9 = victoria (Golden Break incluido: turno numero == 1 también)
    if 9 in bolas:
        _finalizar(partida, equipo_actual)
        resultado["partida_finalizada"] = True
        resultado["ganador_equipo"] = equipo_actual
        return resultado

    # Repite si metió alguna bola 1-8
    turno.repite = any(1 <= b <= 8 for b in bolas)
    resultado["repite"] = turno.repite
    resultado["siguiente_jugador_id"] = (
        turno.jugador_id if turno.repite
        else _siguiente_jugador(session, partida, turno.jugador_id)
    )
    partida.siguiente_jugador_id = resultado["siguiente_jugador_id"]
    partida.bola_en_mano = False

    return resultado


def evaluar_turno(session: Session, partida: Partida, turno: Turno) -> dict:
    """
    Aplica la lógica de negocio tras registrar un turno.
    Modifica `partida` y `turno` en memoria. No hace commit — el caller lo hace.
    """
    if partida.modalidad == "bola9":
        return _evaluar_bola9(session, partida, turno)
    return _evaluar_bola8(session, partida, turno)
