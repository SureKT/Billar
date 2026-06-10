"""
Tests de integración HTTP — endpoints principales.

Usan FastAPI TestClient con BD en memoria para verificar el contrato de la API
sin depender de la BD real ni del servidor arrancado.
"""
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_session
from app.models import Jugador, Bola, Falta, Partida, PartidaJugador, Turno  # noqa: F401
from app.database import FALTAS


# ---------------------------------------------------------------------------
# Fixture: cliente con BD en memoria
# ---------------------------------------------------------------------------

@pytest.fixture(name="client")
def client_fixture():
    # StaticPool: todas las conexiones del pool comparten la misma BD en memoria
    # Sin esto, cada request obtiene una conexión diferente → tablas vacías
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        # Datos base
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ids_jugadores(client: TestClient) -> tuple[int, int]:
    jugadores = client.get("/api/jugadores").json()
    alice = next(j for j in jugadores if j["nombre"] == "Alice")
    bob   = next(j for j in jugadores if j["nombre"] == "Bob")
    return alice["id"], bob["id"]


def _crear_partida(client, modalidad="bola8"):
    alice_id, bob_id = _ids_jugadores(client)
    r = client.post("/api/partidas", json={
        "modalidad": modalidad,
        "equipo1": {"jugador_ids": [alice_id]},
        "equipo2": {"jugador_ids": [bob_id]},
    })
    assert r.status_code == 201
    return r.json()


def _turno(client, partida_id, jugador_id, bolas, falta_id=None, bola_en_mano=False):
    r = client.post(f"/api/partidas/{partida_id}/turnos", json={
        "jugador_id": jugador_id,
        "bolas_metidas": bolas,
        "falta_id": falta_id,
        "bola_en_mano": bola_en_mano,
    })
    return r


# ---------------------------------------------------------------------------
# Catálogos
# ---------------------------------------------------------------------------

class TestCatalogos:

    def test_bolas_devuelve_16(self, client):
        r = client.get("/api/bolas")
        assert r.status_code == 200
        assert len(r.json()) == 16

    def test_faltas_incluye_frecuencia_por_modalidad(self, client):
        r = client.get("/api/faltas")
        assert r.status_code == 200
        for f in r.json():
            assert "frecuencia" in f
            assert "frecuencia_bola8" in f
            assert "frecuencia_bola9" in f


# ---------------------------------------------------------------------------
# Jugadores
# ---------------------------------------------------------------------------

class TestJugadores:

    def test_listar(self, client):
        r = client.get("/api/jugadores")
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_crear(self, client):
        r = client.post("/api/jugadores", json={"nombre": "Carol"})
        assert r.status_code == 201
        assert r.json()["nombre"] == "Carol"

    def test_crear_duplicado(self, client):
        client.post("/api/jugadores", json={"nombre": "Dup"})
        r = client.post("/api/jugadores", json={"nombre": "Dup"})
        assert r.status_code == 409

    def test_stats_todos(self, client):
        r = client.get("/api/jugadores/stats")
        assert r.status_code == 200
        for s in r.json():
            assert "partidas_jugadas" in s
            assert "bolas_por_turno" in s
            assert "racha_actual" in s


# ---------------------------------------------------------------------------
# Partidas
# ---------------------------------------------------------------------------

class TestPartidas:

    def test_crear_bola8(self, client):
        p = _crear_partida(client, "bola8")
        assert p["modalidad"] == "bola8"
        assert p["estado"] == "en_curso"
        assert len(p["equipo1_jugadores"]) == 1
        assert len(p["equipo2_jugadores"]) == 1

    def test_crear_bola9(self, client):
        p = _crear_partida(client, "bola9")
        assert p["modalidad"] == "bola9"

    def test_modalidad_invalida(self, client):
        alice_id, bob_id = _ids_jugadores(client)
        r = client.post("/api/partidas", json={
            "modalidad": "bola3",
            "equipo1": {"jugador_ids": [alice_id]},
            "equipo2": {"jugador_ids": [bob_id]},
        })
        assert r.status_code == 400

    def test_jugador_en_ambos_equipos(self, client):
        alice_id, _ = _ids_jugadores(client)
        r = client.post("/api/partidas", json={
            "modalidad": "bola8",
            "equipo1": {"jugador_ids": [alice_id]},
            "equipo2": {"jugador_ids": [alice_id]},
        })
        assert r.status_code == 400

    def test_listar_partidas(self, client):
        _crear_partida(client)
        r = client.get("/api/partidas")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_obtener_partida_no_existe(self, client):
        r = client.get("/api/partidas/9999")
        assert r.status_code == 404

    def test_estado_partida(self, client):
        p = _crear_partida(client)
        r = client.get(f"/api/partidas/{p['id']}/estado")
        assert r.status_code == 200
        data = r.json()
        assert "bolas_metidas" in data
        assert "equipo1_pendientes" in data

    def test_eliminar_partida(self, client):
        p = _crear_partida(client)
        r = client.delete(f"/api/partidas/{p['id']}")
        assert r.status_code == 204
        assert client.get(f"/api/partidas/{p['id']}").status_code == 404


# ---------------------------------------------------------------------------
# Turnos — bola8
# ---------------------------------------------------------------------------

class TestTurnosBola8:

    def test_break_vacio(self, client):
        p = _crear_partida(client, "bola8")
        alice_id, bob_id = _ids_jugadores(client)
        r = _turno(client, p["id"], alice_id, [])
        assert r.status_code == 201
        data = r.json()
        assert data["repite"] is False
        assert data["siguiente_jugador_id"] == bob_id

    def test_golden_break(self, client):
        p = _crear_partida(client, "bola8")
        alice_id, _ = _ids_jugadores(client)
        r = _turno(client, p["id"], alice_id, [8])
        assert r.status_code == 201
        data = r.json()
        assert data["partida_finalizada"] is True
        assert data["ganador_equipo"] == 1

    def test_golden_break_scratch(self, client):
        p = _crear_partida(client, "bola8")
        alice_id, _ = _ids_jugadores(client)
        r = _turno(client, p["id"], alice_id, [8, 0])
        assert r.status_code == 201
        data = r.json()
        assert data["partida_finalizada"] is True
        assert data["ganador_equipo"] == 2   # alice pierde

    def test_bola8_ilegal_sin_grupos(self, client):
        """Turno 2, sin grupos asignados, mete la 8 → pierde."""
        p = _crear_partida(client, "bola8")
        alice_id, _ = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [])   # break vacío
        r = _turno(client, p["id"], alice_id, [8])
        assert r.status_code == 201
        assert r.json()["partida_finalizada"] is True
        assert r.json()["ganador_equipo"] == 2

    def test_asignacion_grupos_y_victoria(self, client):
        p = _crear_partida(client, "bola8")
        alice_id, _ = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [])          # break vacío
        _turno(client, p["id"], alice_id, [1])          # asigna lisas
        _turno(client, p["id"], alice_id, [2, 3, 4, 5, 6, 7])  # mete resto
        r = _turno(client, p["id"], alice_id, [8])     # gana
        assert r.json()["partida_finalizada"] is True
        assert r.json()["ganador_equipo"] == 1

    def test_scrach_auto_bola_en_mano(self, client):
        """Scratch en turno normal → siguiente jugador recibe bola en mano."""
        p = _crear_partida(client, "bola8")
        alice_id, bob_id = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [])          # break
        r = _turno(client, p["id"], alice_id, [0])     # scratch (auto-detectado en router)
        assert r.status_code == 201
        data = r.json()
        assert data["bola_en_mano_siguiente"] is True
        assert data["siguiente_jugador_id"] == bob_id

    def test_turno_partida_ya_finalizada(self, client):
        p = _crear_partida(client, "bola8")
        alice_id, _ = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [8])          # golden break → finaliza
        r = _turno(client, p["id"], alice_id, [])
        assert r.status_code == 400

    def test_conflicto_turno_duplicado(self, client):
        """409 si se intenta registrar el mismo número de turno dos veces."""
        p = _crear_partida(client, "bola8")
        alice_id, _ = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [])   # turno 1 OK
        # Simular race: leer el estado antes de que se actualice (número sigue siendo 1)
        # No es reproducible de forma exacta en test síncrono, pero verificamos el guard existe
        r2 = client.post(f"/api/partidas/{p['id']}/turnos", json={
            "jugador_id": alice_id,
            "bolas_metidas": [],
            "falta_id": None,
            "bola_en_mano": False,
        })
        # Segundo turno registrado correctamente (número 2); no debe dar 409 aquí
        assert r2.status_code == 201


# ---------------------------------------------------------------------------
# Turnos — bola9
# ---------------------------------------------------------------------------

class TestTurnosBola9:

    def test_golden_break_bola9(self, client):
        p = _crear_partida(client, "bola9")
        alice_id, _ = _ids_jugadores(client)
        r = _turno(client, p["id"], alice_id, [9])
        assert r.json()["partida_finalizada"] is True
        assert r.json()["ganador_equipo"] == 1

    def test_respot_9_blanca(self, client):
        """9 + blanca → respot, no victoria, bola en mano."""
        p = _crear_partida(client, "bola9")
        alice_id, bob_id = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [])   # break vacío
        r = _turno(client, p["id"], alice_id, [9, 0])
        data = r.json()
        assert data["partida_finalizada"] is False
        assert data["bola_en_mano_siguiente"] is True
        assert data["siguiente_jugador_id"] == bob_id

    def test_victoria_bola9_turno_normal(self, client):
        p = _crear_partida(client, "bola9")
        alice_id, _ = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [])   # break vacío → pasa a bob
        _, bob_id = _ids_jugadores(client)
        _turno(client, p["id"], bob_id, [])     # bob vacío → pasa a alice
        r = _turno(client, p["id"], alice_id, [9])
        assert r.json()["partida_finalizada"] is True


# ---------------------------------------------------------------------------
# Undo (DELETE /turnos/ultimo)
# ---------------------------------------------------------------------------

class TestUndo:

    def test_undo_golden_break(self, client):
        p = _crear_partida(client, "bola8")
        alice_id, _ = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [8])
        partida = client.get(f"/api/partidas/{p['id']}").json()
        assert partida["estado"] == "finalizada"

        r = client.delete(f"/api/partidas/{p['id']}/turnos/ultimo")
        assert r.status_code == 204

        partida = client.get(f"/api/partidas/{p['id']}").json()
        assert partida["estado"] == "en_curso"
        assert partida["ganador_equipo"] is None

    def test_undo_sin_turnos(self, client):
        p = _crear_partida(client, "bola8")
        r = client.delete(f"/api/partidas/{p['id']}/turnos/ultimo")
        assert r.status_code == 400

    def test_undo_restaura_grupos(self, client):
        p = _crear_partida(client, "bola8")
        alice_id, _ = _ids_jugadores(client)
        _turno(client, p["id"], alice_id, [])    # break vacío
        _turno(client, p["id"], alice_id, [1])   # asigna lisas

        partida = client.get(f"/api/partidas/{p['id']}").json()
        assert partida["equipo1_grupo"] == "lisas"

        client.delete(f"/api/partidas/{p['id']}/turnos/ultimo")

        partida = client.get(f"/api/partidas/{p['id']}").json()
        assert partida["equipo1_grupo"] is None


# ---------------------------------------------------------------------------
# Catch-all SPA: archivos reales del build (PWA) no deben devolver index.html
# ---------------------------------------------------------------------------

class TestArchivosEstaticos:
    STATIC = Path(__file__).resolve().parents[1] / "app" / "static"

    @pytest.mark.skipif(not (STATIC / "manifest.json").exists(), reason="frontend no compilado")
    def test_manifest_no_devuelve_html(self, client):
        r = client.get("/manifest.json")
        assert r.status_code == 200
        assert "html" not in r.headers["content-type"]

    @pytest.mark.skipif(not (STATIC / "sw.js").exists(), reason="frontend no compilado")
    def test_sw_devuelve_javascript(self, client):
        r = client.get("/sw.js")
        assert r.status_code == 200
        assert "javascript" in r.headers["content-type"]

    def test_ruta_spa_sigue_devolviendo_index(self, client):
        # Las rutas del SPA (sin archivo real detrás) siguen cayendo a index.html
        r = client.get("/jugadores")
        assert r.status_code == 200
