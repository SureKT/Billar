"""
Tests para app/logic_logros.py
"""
from datetime import datetime, timedelta
import pytest
from sqlmodel import Session

from app.logic_logros import calcular_logros, CATALOGO
from app.models import Partida, PartidaJugador, Turno
from tests.conftest import get_jugador


def _get_logro(logros, logro_id):
    return next(l for l in logros if l.id == logro_id)


def _add_victoria(session: Session, j1_id: int, j2_id: int, modalidad="bola8") -> Partida:
    """Crea una partida finalizada donde j1 gana."""
    p = Partida(
        modalidad=modalidad,
        estado="finalizada",
        ganador_equipo=1,
        fecha=datetime.now(),
        fecha_fin=datetime.now() + timedelta(minutes=10),
    )
    session.add(p)
    session.flush()
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j1_id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j2_id, equipo=2, orden=1))
    session.commit()
    return p


def _add_derrota(session: Session, j1_id: int, j2_id: int, modalidad="bola8") -> Partida:
    """Crea una partida finalizada donde j1 pierde."""
    p = Partida(
        modalidad=modalidad,
        estado="finalizada",
        ganador_equipo=2,
        fecha=datetime.now(),
        fecha_fin=datetime.now() + timedelta(minutes=10),
    )
    session.add(p)
    session.flush()
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j1_id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j2_id, equipo=2, orden=1))
    session.commit()
    return p


def test_catalogo_tiene_25_logros():
    assert len(CATALOGO) == 25


def test_sin_partidas_todo_bloqueado(session):
    j1 = get_jugador(session, "J1")
    logros = calcular_logros(j1.id, session)
    assert len(logros) == 25
    assert all(not l.desbloqueado for l in logros)


def test_primera_partida(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    _add_victoria(session, j1.id, j2.id)
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "primera_partida").desbloqueado


def test_primera_victoria(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    _add_victoria(session, j1.id, j2.id)
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "primera_victoria").desbloqueado


def test_primera_victoria_no_derrota(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    _add_derrota(session, j1.id, j2.id)
    logros = calcular_logros(j1.id, session)
    assert not _get_logro(logros, "primera_victoria").desbloqueado


def test_rodaje_niveles(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    for _ in range(10):
        _add_victoria(session, j1.id, j2.id)
    logros = calcular_logros(j1.id, session)
    rodaje = _get_logro(logros, "rodaje")
    assert rodaje.desbloqueado
    assert rodaje.nivel_actual == "bronce"
    assert "bronce" in rodaje.niveles_desbloqueados
    assert "plata" not in rodaje.niveles_desbloqueados


def test_crack_niveles(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    for _ in range(25):
        _add_victoria(session, j1.id, j2.id)
    logros = calcular_logros(j1.id, session)
    crack = _get_logro(logros, "crack")
    assert crack.nivel_actual == "plata"
    assert "bronce" in crack.niveles_desbloqueados
    assert "plata" in crack.niveles_desbloqueados
    assert "oro" not in crack.niveles_desbloqueados


def test_en_racha_tres_victorias(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    for _ in range(3):
        _add_victoria(session, j1.id, j2.id)
    logros = calcular_logros(j1.id, session)
    racha = _get_logro(logros, "en_racha")
    assert racha.desbloqueado
    assert racha.nivel_actual == "bronce"


def test_en_racha_resetea_con_derrota(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    base = datetime.now()
    p1 = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=1,
        fecha=base, fecha_fin=base + timedelta(minutes=10),
    )
    session.add(p1)
    session.flush()
    session.add(PartidaJugador(partida_id=p1.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p1.id, jugador_id=j2.id, equipo=2, orden=1))

    p2 = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=1,
        fecha=base + timedelta(minutes=11), fecha_fin=base + timedelta(minutes=21),
    )
    session.add(p2)
    session.flush()
    session.add(PartidaJugador(partida_id=p2.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p2.id, jugador_id=j2.id, equipo=2, orden=1))

    p3 = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=2,
        fecha=base + timedelta(minutes=22), fecha_fin=base + timedelta(minutes=32),
    )
    session.add(p3)
    session.flush()
    session.add(PartidaJugador(partida_id=p3.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p3.id, jugador_id=j2.id, equipo=2, orden=1))

    p4 = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=1,
        fecha=base + timedelta(minutes=33), fecha_fin=base + timedelta(minutes=43),
    )
    session.add(p4)
    session.flush()
    session.add(PartidaJugador(partida_id=p4.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p4.id, jugador_id=j2.id, equipo=2, orden=1))

    session.commit()
    logros = calcular_logros(j1.id, session)
    racha = _get_logro(logros, "en_racha")
    assert not racha.desbloqueado  # max racha = 2, threshold bronce = 3


def test_relampago(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    p = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=1,
        fecha=datetime.now(),
        fecha_fin=datetime.now() + timedelta(minutes=4),
    )
    session.add(p)
    session.flush()
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j2.id, equipo=2, orden=1))
    session.commit()
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "relampago").desbloqueado


def test_polivalente(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    _add_victoria(session, j1.id, j2.id, modalidad="bola8")
    logros = calcular_logros(j1.id, session)
    assert not _get_logro(logros, "polivalente").desbloqueado
    _add_victoria(session, j1.id, j2.id, modalidad="bola9")
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "polivalente").desbloqueado


def test_verdugo(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    for _ in range(3):
        _add_victoria(session, j1.id, j2.id)
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "verdugo").desbloqueado


def test_verdugo_no_con_derrota_intermedia(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    base = datetime.now()
    for i, ganador in enumerate([1, 1, 2, 1]):
        p = Partida(
            modalidad="bola8", estado="finalizada", ganador_equipo=ganador,
            fecha=base + timedelta(minutes=i * 11),
            fecha_fin=base + timedelta(minutes=i * 11 + 10),
        )
        session.add(p)
        session.flush()
        session.add(PartidaJugador(partida_id=p.id, jugador_id=j1.id, equipo=1, orden=0))
        session.add(PartidaJugador(partida_id=p.id, jugador_id=j2.id, equipo=2, orden=1))
    session.commit()
    logros = calcular_logros(j1.id, session)
    assert not _get_logro(logros, "verdugo").desbloqueado


def test_revancha(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    base = datetime.now()
    p1 = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=2,
        fecha=base, fecha_fin=base + timedelta(minutes=10),
    )
    session.add(p1)
    session.flush()
    session.add(PartidaJugador(partida_id=p1.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p1.id, jugador_id=j2.id, equipo=2, orden=1))

    p2 = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=1,
        fecha=base + timedelta(minutes=11), fecha_fin=base + timedelta(minutes=21),
    )
    session.add(p2)
    session.flush()
    session.add(PartidaJugador(partida_id=p2.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p2.id, jugador_id=j2.id, equipo=2, orden=1))

    session.commit()
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "revancha").desbloqueado


def test_sesion_perfecta(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    hoy = datetime.now().replace(hour=12, minute=0, second=0)
    for i in range(3):
        p = Partida(
            modalidad="bola8", estado="finalizada", ganador_equipo=1,
            fecha=hoy + timedelta(hours=i),
            fecha_fin=hoy + timedelta(hours=i, minutes=10),
        )
        session.add(p)
        session.flush()
        session.add(PartidaJugador(partida_id=p.id, jugador_id=j1.id, equipo=1, orden=0))
        session.add(PartidaJugador(partida_id=p.id, jugador_id=j2.id, equipo=2, orden=1))
    session.commit()
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "sesion_perfecta").desbloqueado


def test_noctambulo(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    p = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=1,
        fecha=datetime.now().replace(hour=1, minute=0),
        fecha_fin=datetime.now().replace(hour=1, minute=30),
    )
    session.add(p)
    session.flush()
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j2.id, equipo=2, orden=1))
    session.commit()
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "noctambulo").desbloqueado


def test_barrida(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    p = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=1,
        equipo1_grupo="lisas", equipo2_grupo="rayadas",
        fecha=datetime.now(),
        fecha_fin=datetime.now() + timedelta(minutes=10),
    )
    session.add(p)
    session.flush()
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j2.id, equipo=2, orden=1))
    # J1 mete sus bolas y la 8, J2 no mete ninguna rayada
    t1 = Turno(partida_id=p.id, jugador_id=j1.id, numero=1, repite=True)
    t1.bolas_metidas = [1, 2, 3, 4, 5, 6, 7, 8]
    session.add(t1)
    session.commit()
    logros = calcular_logros(j1.id, session)
    assert _get_logro(logros, "barrida").desbloqueado


def test_barrida_no_si_rival_metio(session):
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    p = Partida(
        modalidad="bola8", estado="finalizada", ganador_equipo=1,
        equipo1_grupo="lisas", equipo2_grupo="rayadas",
        fecha=datetime.now(),
        fecha_fin=datetime.now() + timedelta(minutes=10),
    )
    session.add(p)
    session.flush()
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p.id, jugador_id=j2.id, equipo=2, orden=1))
    t2 = Turno(partida_id=p.id, jugador_id=j2.id, numero=2, repite=True)
    t2.bolas_metidas = [9]  # rival metió una rayada
    session.add(t2)
    session.commit()
    logros = calcular_logros(j1.id, session)
    assert not _get_logro(logros, "barrida").desbloqueado
