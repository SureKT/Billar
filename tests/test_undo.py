"""
Tests del mecanismo de deshacer (undo).

Replica la misma lógica que usa el endpoint DELETE /turnos/ultimo:
  1. Eliminar el último turno
  2. Resetear la partida al estado inicial
  3. Replay de todos los turnos restantes con evaluar_turno

Casos críticos:
  - Undo tras Golden Break → partida vuelve a en_curso
  - Undo tras asignación de grupos → grupos = None
  - Undo tras respot de la 9 → la 9 vuelve a la mesa
  - Undo tras victoria por la 9 → partida vuelve a en_curso
  - Undo preserva estado intermedio correcto (replay fiel)
"""
import pytest
from sqlmodel import Session, select

from app.models import Turno, Partida, PartidaJugador
from app.logic import evaluar_turno
from tests.conftest import (
    crear_partida, crear_turno_contextual, make_turno, session_fixture,
)


# ---------------------------------------------------------------------------
# Helper: replica la lógica del endpoint undo
# ---------------------------------------------------------------------------

def undo_ultimo(session: Session, partida: Partida) -> None:
    """Elimina el último turno y recalcula el estado por replay completo."""
    turnos = session.exec(
        select(Turno)
        .where(Turno.partida_id == partida.id)
        .order_by(Turno.numero)
    ).all()

    assert turnos, "No hay turnos que deshacer"

    session.delete(turnos[-1])
    session.flush()
    turnos_restantes = turnos[:-1]

    primer_jugador = session.exec(
        select(PartidaJugador)
        .where(PartidaJugador.partida_id == partida.id)
        .order_by(PartidaJugador.orden)
    ).first()

    partida.estado = "en_curso"
    partida.ganador_equipo = None
    partida.equipo1_grupo = None
    partida.equipo2_grupo = None
    partida.siguiente_jugador_id = primer_jugador.jugador_id if primer_jugador else None
    partida.bola_en_mano = False

    for t in turnos_restantes:
        evaluar_turno(session, partida, t)

    session.add(partida)
    session.commit()
    session.refresh(partida)


def _commit_turno(session, partida, jugador, bolas, numero, falta_nombre=None):
    """Crea, evalúa y hace commit de un turno (shortcut para los tests de undo)."""
    crear_turno_contextual(session, partida, jugador, bolas, numero, falta_nombre)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestUndoBola8:

    def test_undo_golden_break_restaura_estado(self, session):
        """Deshacer un Golden Break → partida vuelve a en_curso, j1 vuelve a sacar."""
        partida, j1, j2 = crear_partida(session, "bola8")
        _commit_turno(session, partida, j1, [8], numero=1)
        assert partida.estado == "finalizada"
        assert partida.ganador_equipo == 1

        undo_ultimo(session, partida)

        assert partida.estado == "en_curso"
        assert partida.ganador_equipo is None
        assert partida.siguiente_jugador_id == j1.id  # j1 vuelve a sacar

    def test_undo_asignacion_grupos_los_resetea(self, session):
        """Deshacer el turno que asignó grupos → grupos vuelven a None."""
        partida, j1, j2 = crear_partida(session, "bola8")
        _commit_turno(session, partida, j1, [], numero=1)          # break vacío
        _commit_turno(session, partida, j1, [1], numero=2)         # asigna grupos
        assert partida.equipo1_grupo == "lisas"

        undo_ultimo(session, partida)  # deshace el turno 2

        assert partida.equipo1_grupo is None
        assert partida.equipo2_grupo is None

    def test_undo_multiple_turnos_restaura_grupo_correcto(self, session):
        """Deshacer turno posterior mantiene los grupos del estado anterior."""
        partida, j1, j2 = crear_partida(session, "bola8")
        _commit_turno(session, partida, j1, [], numero=1)          # break vacío
        _commit_turno(session, partida, j1, [1], numero=2)         # lisas → grupos
        _commit_turno(session, partida, j2, [9], numero=3)         # j2 mete rayada

        undo_ultimo(session, partida)  # deshace turno 3

        # El replay de turn 1 y 2 debe restaurar los grupos
        assert partida.equipo1_grupo == "lisas"
        assert partida.equipo2_grupo == "rayadas"
        # Tras el turno 2 (j1 mete propia), j1 repitió → sigue j1
        assert partida.siguiente_jugador_id == j1.id

    def test_undo_victoria_restaura_juego(self, session):
        """Deshacer la victoria por bola 8 → partida vuelve a en_curso."""
        partida, j1, j2 = crear_partida(session, "bola8")
        partida.equipo1_grupo = "lisas"
        partida.equipo2_grupo = "rayadas"
        session.add(partida)
        session.commit()
        session.refresh(partida)

        # Simular que j1 metió todas sus lisas
        _commit_turno(session, partida, j1, [1, 2, 3, 4, 5, 6, 7], numero=2)
        # j1 mete la 8 → gana
        _commit_turno(session, partida, j1, [8], numero=3)
        assert partida.estado == "finalizada"

        undo_ultimo(session, partida)

        assert partida.estado == "en_curso"
        assert partida.ganador_equipo is None

    def test_undo_tres_faltas_restaura_juego(self, session):
        """Deshacer la tercera falta consecutiva → partida vuelve a en_curso."""
        partida, j1, j2 = crear_partida(session, "bola8")
        falta = "Blanca dentro (Scratch)"
        _commit_turno(session, partida, j1, [0], numero=1, falta_nombre=falta)
        _commit_turno(session, partida, j1, [0], numero=2, falta_nombre=falta)
        _commit_turno(session, partida, j1, [0], numero=3, falta_nombre=falta)
        assert partida.estado == "finalizada"

        undo_ultimo(session, partida)

        assert partida.estado == "en_curso"
        assert partida.ganador_equipo is None


class TestUndoBola9:

    def test_undo_golden_break_restaura(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        _commit_turno(session, partida, j1, [9], numero=1)
        assert partida.estado == "finalizada"

        undo_ultimo(session, partida)

        assert partida.estado == "en_curso"
        assert partida.ganador_equipo is None
        assert partida.siguiente_jugador_id == j1.id

    def test_undo_victoria_9(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        _commit_turno(session, partida, j1, [], numero=1)
        _commit_turno(session, partida, j2, [9], numero=2)
        assert partida.estado == "finalizada"
        assert partida.ganador_equipo == 2

        undo_ultimo(session, partida)

        assert partida.estado == "en_curso"
        assert partida.ganador_equipo is None

    def test_undo_respot_quita_el_turno(self, session):
        """Deshacer el turno de respot → la 9 ya no fue metida en ningún turno."""
        partida, j1, j2 = crear_partida(session, "bola9")
        _commit_turno(session, partida, j1, [], numero=1)
        _commit_turno(session, partida, j2, [9, 0], numero=2)  # respot

        undo_ultimo(session, partida)

        # No debe quedar ningún turno con la 9
        turnos = session.exec(
            select(Turno).where(Turno.partida_id == partida.id)
        ).all()
        metidas = {b for t in turnos for b in t.bolas_metidas}
        assert 9 not in metidas  # la 9 está en mesa

    def test_undo_preserva_bola_en_mano_si_corresponde(self, session):
        """Deshacer turno posterior a falta restaura estado sin bola_en_mano."""
        partida, j1, j2 = crear_partida(session, "bola9")
        _commit_turno(session, partida, j1, [], numero=1)
        # j2 hace falta → j1 tendrá bola en mano
        _commit_turno(session, partida, j2, [0], numero=2,
                      falta_nombre="Blanca dentro (Scratch)")
        assert partida.bola_en_mano is True

        # j1 juega con bola en mano, mete una bola
        _commit_turno(session, partida, j1, [3], numero=3)
        assert partida.bola_en_mano is False

        # Deshacer el turno 3
        undo_ultimo(session, partida)

        # Vuelve al estado tras turno 2: j1 tenía bola en mano
        assert partida.bola_en_mano is True

    def test_undo_tres_faltas_bola9(self, session):
        partida, j1, j2 = crear_partida(session, "bola9")
        falta = "Blanca dentro (Scratch)"
        _commit_turno(session, partida, j1, [0], numero=1, falta_nombre=falta)
        _commit_turno(session, partida, j1, [0], numero=2, falta_nombre=falta)
        _commit_turno(session, partida, j1, [0], numero=3, falta_nombre=falta)
        assert partida.estado == "finalizada"

        undo_ultimo(session, partida)

        assert partida.estado == "en_curso"
