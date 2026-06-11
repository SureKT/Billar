"""
Rotación del siguiente jugador en partidas con equipos de 2+ jugadores.

Los demás tests son 1v1 (rival de un solo jugador), así que la rotación
circular dentro del equipo rival (logic._siguiente_jugador, ramas de 2+
jugadores) no estaba cubierta. Aquí se construye un 2v2 y se verifica que
el turno alterna de equipo y rota al siguiente del rival según quién jugó
por última vez en ese equipo.
"""
from sqlmodel import Session

from app.models import Jugador, Partida, PartidaJugador
from tests.conftest import crear_turno_contextual, get_jugador


def _crear_partida_2v2(session: Session):
    """equipo1 = [A, B], equipo2 = [C, D] por orden. A saca primero."""
    a = get_jugador(session, "J1")
    b = get_jugador(session, "J2")
    c = Jugador(nombre="J3")
    d = Jugador(nombre="J4")
    session.add(c)
    session.add(d)
    session.commit()
    session.refresh(c)
    session.refresh(d)

    partida = Partida(modalidad="bola8", siguiente_jugador_id=a.id)
    session.add(partida)
    session.flush()
    # orden intercalado A(0) C(1) B(2) D(3) — refleja el alta real por turnos
    session.add(PartidaJugador(partida_id=partida.id, jugador_id=a.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=partida.id, jugador_id=c.id, equipo=2, orden=1))
    session.add(PartidaJugador(partida_id=partida.id, jugador_id=b.id, equipo=1, orden=2))
    session.add(PartidaJugador(partida_id=partida.id, jugador_id=d.id, equipo=2, orden=3))
    session.commit()
    session.refresh(partida)
    return partida, a, b, c, d


def test_rotacion_2v2_alterna_equipo_y_rota_dentro_del_rival(session: Session):
    partida, a, b, c, d = _crear_partida_2v2(session)

    # Turno 1: A no mete nada → pasa al rival. Sin turnos rivales previos → primero (C).
    crear_turno_contextual(session, partida, a, [], numero=1)
    assert partida.siguiente_jugador_id == c.id

    # Turno 2: C no mete → pasa a equipo1. Último de equipo1 fue A (idx 0) → rota a B.
    crear_turno_contextual(session, partida, c, [], numero=2)
    assert partida.siguiente_jugador_id == b.id

    # Turno 3: B no mete → pasa a equipo2. Último rival fue C (idx 0) → rota a D.
    crear_turno_contextual(session, partida, b, [], numero=3)
    assert partida.siguiente_jugador_id == d.id

    # Turno 4: D no mete → pasa a equipo1. Último fue B (idx 1) → rota circular a A.
    crear_turno_contextual(session, partida, d, [], numero=4)
    assert partida.siguiente_jugador_id == a.id


def test_rotacion_2v2_repite_no_cambia_jugador(session: Session):
    """Si el jugador mete bola propia repite turno: el siguiente sigue siendo él."""
    partida, a, b, c, d = _crear_partida_2v2(session)

    # Turno 1 (break): A mete una lisa. En break no asigna grupo, pero mete bola
    # numerada propia → repite. El siguiente jugador sigue siendo A.
    crear_turno_contextual(session, partida, a, [3], numero=1)
    assert partida.siguiente_jugador_id == a.id
