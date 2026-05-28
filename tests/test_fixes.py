"""
Tests de regresión para los fixes de lógica/robustez:

  #1 Replay se detiene en el primer turno que finaliza la partida.
  #2 Replay preserva la fecha_fin original (no la pisa con now()).
  #3 _tres_faltas_consecutivas solo cuenta turnos hasta el actual (replay correcto).
  #5 crear_partida rechaza equipos vacíos.
  #7 Auto-detección de scratch también en editar e insertar turno.
"""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_session, FALTAS
from app.logic import _tres_faltas_consecutivas
from app.models import Jugador, Bola, Falta, Partida, PartidaJugador, Turno  # noqa: F401
from tests.conftest import crear_partida, make_turno, session_fixture  # noqa: F401


# ---------------------------------------------------------------------------
# Cliente HTTP con BD en memoria (mismo patrón que test_api.py)
# ---------------------------------------------------------------------------

@pytest.fixture(name="client")
def client_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Bola(numero=0, tipo="blanca"))
        for n in range(1, 8):
            session.add(Bola(numero=n, tipo="lisa"))
        session.add(Bola(numero=8, tipo="ocho"))
        for n in range(9, 16):
            session.add(Bola(numero=n, tipo="rayada"))
        for f in FALTAS:
            session.add(Falta(nombre=f["nombre"], penalizacion=f["penalizacion"]))
        session.add(Jugador(nombre="Alice"))
        session.add(Jugador(nombre="Bob"))
        session.commit()

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _ids(client):
    jugadores = client.get("/api/jugadores").json()
    a = next(j for j in jugadores if j["nombre"] == "Alice")
    b = next(j for j in jugadores if j["nombre"] == "Bob")
    return a["id"], b["id"]


def _crear(client, modalidad="bola8"):
    a, b = _ids(client)
    r = client.post("/api/partidas", json={
        "modalidad": modalidad,
        "equipo1": {"jugador_ids": [a]},
        "equipo2": {"jugador_ids": [b]},
    })
    assert r.status_code == 201
    return r.json()


def _turno(client, pid, jid, bolas, falta_id=None):
    return client.post(f"/api/partidas/{pid}/turnos", json={
        "jugador_id": jid, "bolas_metidas": bolas,
        "falta_id": falta_id, "bola_en_mano": False,
    })


def _turnos(client, pid):
    return client.get(f"/api/partidas/{pid}/turnos").json()


def _scratch_id(client):
    faltas = client.get("/api/faltas").json()
    return next(f["id"] for f in faltas if f["nombre"] == "Blanca dentro (Scratch)")


# ---------------------------------------------------------------------------
# #5 — crear_partida rechaza equipos vacíos
# ---------------------------------------------------------------------------

class TestEquiposVacios:

    def test_equipo1_vacio_400(self, client):
        _, bob = _ids(client)
        r = client.post("/api/partidas", json={
            "modalidad": "bola8",
            "equipo1": {"jugador_ids": []},
            "equipo2": {"jugador_ids": [bob]},
        })
        assert r.status_code == 400

    def test_equipo2_vacio_400(self, client):
        alice, _ = _ids(client)
        r = client.post("/api/partidas", json={
            "modalidad": "bola8",
            "equipo1": {"jugador_ids": [alice]},
            "equipo2": {"jugador_ids": []},
        })
        assert r.status_code == 400

    def test_ambos_vacios_400(self, client):
        r = client.post("/api/partidas", json={
            "modalidad": "bola8",
            "equipo1": {"jugador_ids": []},
            "equipo2": {"jugador_ids": []},
        })
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# #1 — Replay se detiene en el turno que finaliza
# ---------------------------------------------------------------------------

class TestReplayStopAtFinalize:

    def test_editar_que_finaliza_antes_no_es_pisado(self, client):
        """
        Secuencia: t1 alice [], t2 bob [], t3 alice [8] (alice pierde → ganador 2).
        Editar t2 → bob [8]: bob pierde en t2 → ganador 1.
        El replay debe PARAR en t2; el t3 [8] no debe re-pisar el ganador.
        """
        p = _crear(client, "bola8")
        alice, bob = _ids(client)
        _turno(client, p["id"], alice, [])    # t1 → siguiente bob
        _turno(client, p["id"], bob, [])       # t2 → siguiente alice
        _turno(client, p["id"], alice, [8])    # t3 → alice pierde, ganador 2
        assert client.get(f"/api/partidas/{p['id']}").json()["ganador_equipo"] == 2

        t2 = next(t for t in _turnos(client, p["id"]) if t["numero"] == 2)
        r = client.post(f"/api/partidas/{p['id']}/turnos/{t2['id']}/editar", json={
            "bolas_metidas": [8], "falta_id": None,
        })
        assert r.status_code == 200

        partida = client.get(f"/api/partidas/{p['id']}").json()
        assert partida["estado"] == "finalizada"
        assert partida["ganador_equipo"] == 1   # bob perdió en t2, no se pisó con t3

    def test_insertar_turno_ganador_en_medio(self, client):
        """
        Insertar un turno que finaliza la partida entre dos existentes:
        los turnos posteriores no deben sobrescribir el resultado.
        """
        p = _crear(client, "bola8")
        alice, bob = _ids(client)
        _turno(client, p["id"], alice, [])    # t1 → bob
        _turno(client, p["id"], bob, [])       # t2 → alice
        # Insertar tras t1: bob mete la 8 (sin grupos) → bob pierde → ganador 1
        r = client.post(f"/api/partidas/{p['id']}/turnos/insertar", json={
            "despues_de_numero": 1, "jugador_id": bob, "bolas_metidas": [8],
            "falta_id": None, "bola_en_mano": False,
        })
        assert r.status_code == 200

        partida = client.get(f"/api/partidas/{p['id']}").json()
        assert partida["estado"] == "finalizada"
        assert partida["ganador_equipo"] == 1


# ---------------------------------------------------------------------------
# #2 — Replay preserva fecha_fin original
# ---------------------------------------------------------------------------

class TestFechaFinPreservada:

    def test_editar_no_pisa_fecha_fin(self, client):
        p = _crear(client, "bola8")
        alice, _ = _ids(client)
        # Partida ganada por alice (todas lisas + 8)
        _turno(client, p["id"], alice, [1])                 # break con bola → repite alice
        _turno(client, p["id"], alice, [2])                 # asigna lisas
        _turno(client, p["id"], alice, [3, 4, 5, 6, 7])     # resto lisas
        _turno(client, p["id"], alice, [8])                 # gana
        assert client.get(f"/api/partidas/{p['id']}").json()["estado"] == "finalizada"

        # Fijar una fecha_fin conocida en el pasado
        fecha_fin = "2020-06-15T12:00:00"
        r = client.patch(f"/api/partidas/{p['id']}/tiempos", json={"fecha_fin": fecha_fin})
        assert r.status_code == 200

        # Editar el primer turno (mismo contenido) fuerza un replay completo
        t1 = next(t for t in _turnos(client, p["id"]) if t["numero"] == 1)
        r = client.post(f"/api/partidas/{p['id']}/turnos/{t1['id']}/editar", json={
            "bolas_metidas": [1], "falta_id": None,
        })
        assert r.status_code == 200

        partida = client.get(f"/api/partidas/{p['id']}").json()
        assert partida["estado"] == "finalizada"
        # fecha_fin NO debe haberse reescrito a now()
        assert partida["fecha_fin"].startswith("2020-06-15")

    def test_deshacer_y_rehacer_no_corrompe_si_sigue_en_curso(self, client):
        """Si tras el replay la partida sigue en curso, fecha_fin debe ser None."""
        p = _crear(client, "bola8")
        alice, bob = _ids(client)
        _turno(client, p["id"], alice, [])    # break
        _turno(client, p["id"], bob, [])
        # Deshacer último → sigue en curso
        client.delete(f"/api/partidas/{p['id']}/turnos/ultimo")
        partida = client.get(f"/api/partidas/{p['id']}").json()
        assert partida["estado"] == "en_curso"
        assert partida["fecha_fin"] is None


# ---------------------------------------------------------------------------
# #7 — Auto-scratch en editar e insertar
# ---------------------------------------------------------------------------

class TestAutoScratchEditarInsertar:

    def test_editar_a_blanca_detecta_scratch(self, client):
        p = _crear(client, "bola8")
        alice, bob = _ids(client)
        _turno(client, p["id"], alice, [])    # break → bob
        _turno(client, p["id"], bob, [1])      # bob mete lisa (asigna)
        # Editar el turno de bob a meter la blanca → debe auto-detectar scratch
        t2 = next(t for t in _turnos(client, p["id"]) if t["numero"] == 2)
        r = client.post(f"/api/partidas/{p['id']}/turnos/{t2['id']}/editar", json={
            "bolas_metidas": [0], "falta_id": None,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["falta_id"] == _scratch_id(client)
        assert data["bola_en_mano_siguiente"] is True

    def test_insertar_con_blanca_detecta_scratch(self, client):
        p = _crear(client, "bola8")
        alice, bob = _ids(client)
        _turno(client, p["id"], alice, [])    # t1 break
        # Insertar tras t1 un turno de bob con la blanca → scratch auto
        r = client.post(f"/api/partidas/{p['id']}/turnos/insertar", json={
            "despues_de_numero": 1, "jugador_id": bob, "bolas_metidas": [0],
            "falta_id": None, "bola_en_mano": False,
        })
        assert r.status_code == 200
        turnos = r.json()
        insertado = next(t for t in turnos if t["numero"] == 2)
        assert insertado["falta_id"] == _scratch_id(client)


# ---------------------------------------------------------------------------
# #3 — _tres_faltas_consecutivas respeta hasta_numero (unit test directo)
# ---------------------------------------------------------------------------

class TestTresFaltasHastaNumero:

    def test_solo_cuenta_turnos_hasta_actual(self, session):
        """
        Turnos de j1: limpio(1), limpio(2), falta(3), falta(4), falta(5).
        - hasta_numero=4 → solo 2 faltas consecutivas → False
        - hasta_numero=5 → 3 faltas consecutivas (3,4,5) → True
        """
        partida, j1, j2 = crear_partida(session, "bola8")
        falta = "Blanca dentro (Scratch)"
        make_turno(session, partida, j1, [1], 1)
        make_turno(session, partida, j1, [2], 2)
        make_turno(session, partida, j1, [0], 3, falta)
        make_turno(session, partida, j1, [0], 4, falta)
        make_turno(session, partida, j1, [0], 5, falta)
        session.commit()

        assert _tres_faltas_consecutivas(session, partida.id, 1, hasta_numero=4) is False
        assert _tres_faltas_consecutivas(session, partida.id, 1, hasta_numero=5) is True

    def test_sin_hasta_numero_usa_todos(self, session):
        partida, j1, j2 = crear_partida(session, "bola8")
        falta = "Blanca dentro (Scratch)"
        make_turno(session, partida, j1, [0], 1, falta)
        make_turno(session, partida, j1, [0], 2, falta)
        make_turno(session, partida, j1, [0], 3, falta)
        session.commit()
        assert _tres_faltas_consecutivas(session, partida.id, 1) is True
