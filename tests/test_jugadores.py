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
