"""
Tests de las métricas nuevas de JugadorStats (_calcular_stats):
  break_bolas_media, break_con_bola_pct, bolas_por_partida,
  max_bolas_turno, faltas_por_partida.
"""
from app.routers.jugadores import _calcular_stats
from tests.conftest import crear_partida, crear_turno_contextual, get_jugador


def test_stats_jugador_sin_turnos(session):
    """Jugador sin turnos → todas las métricas nuevas en 0."""
    j1 = get_jugador(session, "J1")
    stats = _calcular_stats(session, j1)
    assert stats.break_bolas_media == 0.0
    assert stats.break_con_bola_pct == 0.0
    assert stats.bolas_por_partida == 0.0
    assert stats.max_bolas_turno == 0
    assert stats.faltas_por_partida == 0.0


def test_stats_break_con_bola(session):
    """Break (numero==1) con 2 bolas → media=2.0, pct=100.0, max_bolas_turno=2."""
    partida, j1, j2 = crear_partida(session, "bola8")
    crear_turno_contextual(session, partida, j1, [1, 3], 1)  # break con 2 lisas
    stats = _calcular_stats(session, j1)
    assert stats.break_bolas_media == 2.0
    assert stats.break_con_bola_pct == 100.0
    assert stats.max_bolas_turno == 2


def test_stats_break_sin_bola(session):
    """Break sin meter bolas → media=0.0, pct=0.0 (pero sí hubo break)."""
    partida, j1, j2 = crear_partida(session, "bola8")
    crear_turno_contextual(session, partida, j1, [], 1)  # break vacío
    stats = _calcular_stats(session, j1)
    assert stats.break_bolas_media == 0.0
    assert stats.break_con_bola_pct == 0.0
    assert stats.max_bolas_turno == 0


def test_stats_faltas_por_partida(session):
    """Una falta en una sola partida jugada → faltas_por_partida = 1.0."""
    partida, j1, j2 = crear_partida(session, "bola8")
    crear_turno_contextual(session, partida, j1, [], 1, "Falta de banda")
    stats = _calcular_stats(session, j1)
    assert stats.faltas_por_partida == 1.0


def test_stats_max_bolas_seguidas_bola8(session):
    """Visita de J1: break+lisa, asigna lisas, 2 lisas, falla → racha = 1+1+2 = 4."""
    partida, j1, j2 = crear_partida(session, "bola8")
    crear_turno_contextual(session, partida, j1, [1], 1)     # break con lisa → repite
    crear_turno_contextual(session, partida, j1, [3], 2)     # asigna lisas → repite
    crear_turno_contextual(session, partida, j1, [2, 4], 3)  # 2 lisas propias → repite
    crear_turno_contextual(session, partida, j1, [], 4)      # falla → cierra la visita
    stats = _calcular_stats(session, j1)
    assert stats.max_bolas_seguidas == 4


def test_stats_max_bolas_seguidas_bola9(session):
    """Bola 9 sin grupos: cuentan bolas 1-8 seguidas hasta fallar → 1+2 = 3."""
    partida, j1, j2 = crear_partida(session, "bola9")
    crear_turno_contextual(session, partida, j1, [1], 1)     # repite (1-8)
    crear_turno_contextual(session, partida, j1, [2, 3], 2)  # repite
    crear_turno_contextual(session, partida, j1, [], 3)      # falla → cierra
    stats = _calcular_stats(session, j1)
    assert stats.max_bolas_seguidas == 3


def test_stats_max_bolas_seguidas_resetea_entre_visitas(session):
    """Dos visitas separadas por una fallida: el máximo es la mayor, no la suma."""
    partida, j1, j2 = crear_partida(session, "bola8")
    crear_turno_contextual(session, partida, j1, [1], 1)     # break lisa → repite
    crear_turno_contextual(session, partida, j1, [3], 2)     # asigna lisas → repite
    crear_turno_contextual(session, partida, j1, [], 3)      # falla → cierra visita (racha 2)
    crear_turno_contextual(session, partida, j2, [], 4)      # turno rival, falla
    crear_turno_contextual(session, partida, j1, [5], 5)     # nueva visita: 1 lisa
    crear_turno_contextual(session, partida, j1, [], 6)      # falla → cierra visita (racha 1)
    stats = _calcular_stats(session, j1)
    assert stats.max_bolas_seguidas == 2


def test_stats_filtro_desde_excluye_antiguas(session):
    """desde= posterior a la partida vieja → solo cuenta la nueva."""
    from datetime import datetime
    vieja, j1, j2 = crear_partida(session, "bola8")
    vieja.fecha = datetime(2026, 1, 10, 20, 0)
    crear_turno_contextual(session, vieja, j1, [1, 2], 1)

    nueva, _, _ = crear_partida(session, "bola8")
    nueva.fecha = datetime(2026, 6, 1, 20, 0)
    crear_turno_contextual(session, nueva, j1, [3], 1)
    session.commit()

    stats = _calcular_stats(session, j1, desde=datetime(2026, 5, 1))
    assert stats.partidas_jugadas == 1
    assert stats.bolas_metidas == 1


def test_stats_filtro_hasta_excluye_nuevas(session):
    """hasta= anterior a la partida nueva → solo cuenta la vieja."""
    from datetime import datetime
    vieja, j1, j2 = crear_partida(session, "bola8")
    vieja.fecha = datetime(2026, 1, 10, 20, 0)
    crear_turno_contextual(session, vieja, j1, [1, 2], 1)

    nueva, _, _ = crear_partida(session, "bola8")
    nueva.fecha = datetime(2026, 6, 1, 20, 0)
    crear_turno_contextual(session, nueva, j1, [3], 1)
    session.commit()

    stats = _calcular_stats(session, j1, hasta=datetime(2026, 5, 1))
    assert stats.partidas_jugadas == 1
    assert stats.bolas_metidas == 2


def test_stats_filtro_temporal_y_modalidad(session):
    """desde + modalidad se combinan: bola9 reciente no cuenta para bola8."""
    from datetime import datetime
    p8, j1, j2 = crear_partida(session, "bola8")
    p8.fecha = datetime(2026, 1, 10, 20, 0)
    crear_turno_contextual(session, p8, j1, [1], 1)

    p9, _, _ = crear_partida(session, "bola9")
    p9.fecha = datetime(2026, 6, 1, 20, 0)
    crear_turno_contextual(session, p9, j1, [1], 1)
    session.commit()

    stats = _calcular_stats(session, j1, modalidad="bola8", desde=datetime(2026, 5, 1))
    assert stats.partidas_jugadas == 0
    assert stats.bolas_metidas == 0


def test_stats_endpoint_acepta_desde_hasta():
    """El endpoint /api/jugadores/stats acepta desde/hasta ISO y filtra."""
    from datetime import datetime
    from fastapi.testclient import TestClient
    from sqlmodel import SQLModel, Session, create_engine
    from sqlalchemy.pool import StaticPool
    from app.main import app
    from app.database import get_session, FALTAS
    from app.models import Jugador, Falta, Turno, Partida, PartidaJugador

    # StaticPool: el thread de TestClient comparte la misma BD en memoria
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        for f in FALTAS:
            s.add(Falta(nombre=f["nombre"], penalizacion=f["penalizacion"]))
        j1 = Jugador(nombre="J1")
        s.add(j1)
        s.add(Jugador(nombre="J2"))
        s.commit()
        s.refresh(j1)
        partida = Partida(modalidad="bola8", fecha=datetime(2026, 1, 10, 20, 0))
        s.add(partida)
        s.flush()
        s.add(PartidaJugador(partida_id=partida.id, jugador_id=j1.id, equipo=1, orden=0))
        t = Turno(partida_id=partida.id, jugador_id=j1.id, numero=1)
        t.bolas_metidas = [1, 2]
        s.add(t)
        s.commit()

    def override_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override_session
    try:
        client = TestClient(app)
        r = client.get("/api/jugadores/stats?desde=2026-05-01T00:00:00")
        assert r.status_code == 200
        j1_stats = next(x for x in r.json() if x["nombre"] == "J1")
        assert j1_stats["partidas_jugadas"] == 0

        r = client.get("/api/jugadores/stats?desde=2026-01-01T00:00:00&hasta=2026-02-01T00:00:00")
        j1_stats = next(x for x in r.json() if x["nombre"] == "J1")
        assert j1_stats["partidas_jugadas"] == 1
        assert j1_stats["bolas_metidas"] == 2
    finally:
        app.dependency_overrides.clear()


def test_stats_bolas_por_partida_finalizada(session):
    """
    Partida finalizada: j1 mete todas las lisas + la 8 → gana.
    bolas_por_partida = bolas_metidas / 1 partida finalizada.
    """
    partida, j1, j2 = crear_partida(session, "bola8")
    crear_turno_contextual(session, partida, j1, [1], 1)              # break, repite
    crear_turno_contextual(session, partida, j1, [2], 2)              # asigna lisas
    crear_turno_contextual(session, partida, j1, [3, 4, 5, 6, 7], 3)  # resto lisas
    crear_turno_contextual(session, partida, j1, [8], 4)              # mete la 8 → gana
    assert partida.estado == "finalizada"
    stats = _calcular_stats(session, j1)
    # 8 bolas metidas (1..8 sin la blanca) en 1 partida finalizada
    assert stats.bolas_por_partida == round(stats.bolas_metidas / 1, 2)
    assert stats.bolas_metidas == 8
