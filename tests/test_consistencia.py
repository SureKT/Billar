"""
Tests de la métrica de consistencia (función pura, sin DB).

Entrada: una tupla (turnos, bolas) por partida finalizada del jugador.
"""
import pytest

from app.consistencia import MIN_PARTIDAS, MIN_TURNOS_POR_PARTIDA, calcular_consistencia


def test_rendimiento_constante_da_cv_cero():
    resultado = calcular_consistencia([(4, 2)] * MIN_PARTIDAS)

    assert resultado.cv == 0.0
    assert resultado.media == pytest.approx(0.5)
    assert resultado.desviacion == 0.0
    assert resultado.partidas == MIN_PARTIDAS
    assert resultado.motivo is None


def test_serie_conocida_da_cv_exacto():
    # bolas/turno alternando 0.5 y 1.0 → media 0.75, desviación poblacional 0.25
    partidas = [(4, 2), (4, 4)] * 4

    resultado = calcular_consistencia(partidas)

    assert resultado.media == pytest.approx(0.75)
    assert resultado.desviacion == pytest.approx(0.25)
    assert resultado.cv == pytest.approx(1 / 3)


def test_descarta_partidas_con_pocos_turnos():
    pocas = [(MIN_TURNOS_POR_PARTIDA - 1, 2)] * 5
    validas = [(MIN_TURNOS_POR_PARTIDA, 3)] * MIN_PARTIDAS

    resultado = calcular_consistencia(pocas + validas)

    assert resultado.partidas == MIN_PARTIDAS
    assert resultado.cv == 0.0  # las descartadas (1.0 b/t) no alteran la media 1.0


def test_menos_del_minimo_no_clasifica_pero_informa_media():
    resultado = calcular_consistencia([(4, 2)] * (MIN_PARTIDAS - 1))

    assert resultado.cv is None
    assert resultado.desviacion is None
    assert resultado.partidas == MIN_PARTIDAS - 1
    assert resultado.media == pytest.approx(0.5)
    assert resultado.motivo is not None


def test_media_cero_no_divide_por_cero():
    resultado = calcular_consistencia([(5, 0)] * MIN_PARTIDAS)

    assert resultado.cv is None
    assert resultado.media == 0.0
    assert resultado.motivo is not None


def test_sin_partidas():
    resultado = calcular_consistencia([])

    assert resultado.partidas == 0
    assert resultado.media is None
    assert resultado.cv is None
    assert resultado.motivo is not None


def test_mayor_variacion_da_mayor_cv():
    estable = calcular_consistencia([(4, 2), (4, 3)] * 4)
    irregular = calcular_consistencia([(4, 0), (4, 5)] * 4)

    assert estable.cv < irregular.cv
