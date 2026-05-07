"""
Tests de lógica de partida — modalidad Bola 9.

Reglas verificadas:
  - Ganar: meter la 9 sin la blanca (también en el break = Golden Break)
  - 9 + blanca: respot de la 9, bola en mano para el rival (NO es derrota)
  - Repetir turno: meter cualquier bola 1-8 sin falta
  - La bola 8 es una bola normal (meterla = repite, no tiene efecto especial)
  - Falta → bola en mano para el rival
  - Tres faltas consecutivas del equipo → pierde
"""
import pytest
from app.logic import evaluar_turno
from tests.conftest import (
    crear_partida, crear_turno_contextual, make_turno, session_fixture,
)


# ---------------------------------------------------------------------------
# Break (turno número 1)
# ---------------------------------------------------------------------------

class TestBola9Break:

    def test_break_vacio_pasa_turno(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        t = make_turno(session, partida, j1, [], numero=1)
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is False
        assert res["siguiente_jugador_id"] == j2.id
        assert res["partida_finalizada"] is False

    def test_break_metiendo_bola_1_8_repite(self, session):
        """Cualquier bola 1-8 en el break → repite."""
        partida, j1, j2 = crear_partida(session, "bola9")
        t = make_turno(session, partida, j1, [3], numero=1)
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is True
        assert res["siguiente_jugador_id"] == j1.id
        assert res["partida_finalizada"] is False

    def test_break_metiendo_bola_8_repite(self, session):
        """La bola 8 en bola9 es normal: meterla en el break = repite."""
        partida, j1, j2 = crear_partida(session, "bola9")
        t = make_turno(session, partida, j1, [8], numero=1)
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is True
        assert res["partida_finalizada"] is False

    def test_golden_break_9_solo(self, session):
        """Meter la 9 en el break sin blanca = Golden Break = victoria."""
        partida, j1, j2 = crear_partida(session, "bola9")
        t = make_turno(session, partida, j1, [9], numero=1)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is True
        assert res["ganador_equipo"] == 1

    def test_golden_break_9_con_otras_bolas(self, session):
        """Golden Break funciona aunque entren otras bolas junto a la 9."""
        partida, j1, j2 = crear_partida(session, "bola9")
        t = make_turno(session, partida, j1, [1, 4, 9], numero=1)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is True
        assert res["ganador_equipo"] == 1

    def test_break_falta_bola_en_mano(self, session):
        """Falta en el break → bola en mano para el rival."""
        partida, j1, j2 = crear_partida(session, "bola9")
        t = make_turno(session, partida, j1, [0], numero=1,
                       falta_nombre="Blanca dentro (Scratch)")
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is False
        assert res["siguiente_jugador_id"] == j2.id
        assert res["bola_en_mano_siguiente"] is True
        assert res["partida_finalizada"] is False


# ---------------------------------------------------------------------------
# Turno normal (post-break)
# ---------------------------------------------------------------------------

class TestBola9TurnoNormal:

    def test_mete_bola_1_8_repite(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [5], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is True

    def test_bola_8_es_normal_repite(self, session):
        """La bola 8 en bola9 es una bola normal: meterla = repite."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [8], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is True
        assert res["partida_finalizada"] is False

    def test_mete_varias_1_8_repite(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [3, 6, 8], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is True

    def test_sin_bolas_pasa_turno(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is False
        assert res["siguiente_jugador_id"] == j2.id

    def test_victoria_metiendo_9(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [9], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is True
        assert res["ganador_equipo"] == 1

    def test_victoria_9_con_otras_bolas(self, session):
        """Meter la 9 junto a otras bolas = victoria igualmente."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [4, 6, 9], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is True
        assert res["ganador_equipo"] == 1

    def test_falta_normal_bola_en_mano(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [0], numero=2,
                       falta_nombre="Blanca dentro (Scratch)")
        res = evaluar_turno(session, partida, t)

        assert res["repite"] is False
        assert res["bola_en_mano_siguiente"] is True
        assert res["siguiente_jugador_id"] == j2.id
        assert res["partida_finalizada"] is False

    def test_rival_puede_ganar_tambien(self, session):
        """J2 también puede ganar metiendo la 9."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j2, [9], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is True
        assert res["ganador_equipo"] == 2


# ---------------------------------------------------------------------------
# Respot de la 9 (9 + blanca simultáneas)
# ---------------------------------------------------------------------------

class TestBola9Respot:

    def test_9_blanca_respot_no_victoria(self, session):
        """9 + blanca = respot, NO victoria. Partida continúa."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [9, 0], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is False
        assert res["bola_en_mano_siguiente"] is True
        assert res["siguiente_jugador_id"] == j2.id

    def test_respot_quita_9_de_bolas_metidas(self, session):
        """La 9 se elimina de bolas_metidas del turno (vuelve a la mesa)."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [9, 0], numero=2)
        evaluar_turno(session, partida, t)

        assert 9 not in t.bolas_metidas

    def test_respot_con_otras_bolas_estas_si_cuentan(self, session):
        """9+0+otras → la 9 se respotea pero las otras bolas sí cuentan."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [3, 9, 0], numero=2)
        evaluar_turno(session, partida, t)

        assert 9 not in t.bolas_metidas
        assert 3 in t.bolas_metidas  # el 3 cuenta
        assert 0 in t.bolas_metidas  # el 0 (falta) también

    def test_respot_pone_bola_en_mano(self, session):
        """El respot siempre da bola en mano al rival."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [], numero=1)

        t = make_turno(session, partida, j1, [9, 0], numero=2)
        res = evaluar_turno(session, partida, t)

        assert res["bola_en_mano_siguiente"] is True
        assert partida.bola_en_mano is True


# ---------------------------------------------------------------------------
# Tres faltas consecutivas del equipo
# ---------------------------------------------------------------------------

class TestBola9TresFaltas:
    FALTA = "Blanca dentro (Scratch)"

    def test_tres_faltas_pierde(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [0], numero=1, falta_nombre=self.FALTA)
        crear_turno_contextual(session, partida, j1, [0], numero=2, falta_nombre=self.FALTA)

        t = make_turno(session, partida, j1, [0], numero=3, falta_nombre=self.FALTA)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is True
        assert res["ganador_equipo"] == 2

    def test_respot_con_tres_faltas_pierde(self, session):
        """Si 9+0 es la tercera falta consecutiva → pierde (no es respot)."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [0], numero=1, falta_nombre=self.FALTA)
        crear_turno_contextual(session, partida, j1, [0], numero=2, falta_nombre=self.FALTA)

        # Tercera: 9+0 → normalmente respot, pero hay 3 faltas → pierde
        t = make_turno(session, partida, j1, [9, 0], numero=3)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is True
        assert res["ganador_equipo"] == 2

    def test_turno_limpio_resetea_contador(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [0], numero=1, falta_nombre=self.FALTA)
        crear_turno_contextual(session, partida, j1, [0], numero=2, falta_nombre=self.FALTA)
        crear_turno_contextual(session, partida, j1, [3],  numero=3)  # limpio

        t = make_turno(session, partida, j1, [0], numero=4, falta_nombre=self.FALTA)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is False

    def test_faltas_por_equipo_no_global(self, session):
        """Las faltas de j2 no suman al contador de faltas de j1."""
        partida, j1, j2 = crear_partida(session, "bola9")
        crear_turno_contextual(session, partida, j1, [0], numero=1, falta_nombre=self.FALTA)
        crear_turno_contextual(session, partida, j1, [0], numero=2, falta_nombre=self.FALTA)
        crear_turno_contextual(session, partida, j2, [0], numero=3, falta_nombre=self.FALTA)
        crear_turno_contextual(session, partida, j2, [0], numero=4, falta_nombre=self.FALTA)

        t = make_turno(session, partida, j1, [0], numero=5, falta_nombre=self.FALTA)
        res = evaluar_turno(session, partida, t)

        assert res["partida_finalizada"] is True
        assert res["ganador_equipo"] == 2
