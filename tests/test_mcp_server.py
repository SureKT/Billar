"""
Tests del servidor MCP a través del cliente MCP en memoria del SDK.

Cada llamada pasa por el protocolo real (JSON-RPC sobre streams en memoria), no por
llamadas directas a funciones. La DB es un SQLite en fichero temporal: se siembra con un
engine de escritura y el servidor la abre con el mismo engine de solo lectura que en
producción.

Escenario sembrado:
- Ana y Bea juegan 8 partidas de bola8 (gana Ana) y 1 de bola9 (gana Bea), 4 turnos cada
  una por partida.
  - Ana mete 2 bolas por partida en bola8 (0.5 b/t constante) y 0 en bola9.
  - Bea alterna 0 y 4 bolas por partida en bola8 (0.0 / 1.0 b/t) y 4 en bola9.
- Carla está activa pero no ha jugado.
- Dani está inactivo.
"""
import anyio
import pytest
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, SQLModel, create_engine

from mcp import Client
from mcp.client._memory import InMemoryTransport

from app.database import FALTAS
from app.mcp_server import crear_engine_solo_lectura, crear_servidor
from app.models import Bola, Falta, Jugador, Partida, PartidaJugador, Turno

TOOLS = {"ranking_jugadores", "stats_jugador", "consistencia_jugadores"}


# ---------------------------------------------------------------------------
# Siembra
# ---------------------------------------------------------------------------

def _partida(session, ana, bea, modalidad, ganador_equipo, bolas_ana, bolas_bea):
    """Partida finalizada con 4 turnos de cada una. bolas_x = bolas por turno (lista de 4)."""
    p = Partida(modalidad=modalidad, estado="finalizada", ganador_equipo=ganador_equipo)
    session.add(p)
    session.flush()
    session.add(PartidaJugador(partida_id=p.id, jugador_id=ana.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=p.id, jugador_id=bea.id, equipo=2, orden=1))
    numero = 1
    for ba, bb in zip(bolas_ana, bolas_bea):
        for jugador, n in ((ana, ba), (bea, bb)):
            t = Turno(partida_id=p.id, jugador_id=jugador.id, numero=numero)
            t.bolas_metidas = n if isinstance(n, list) else list(range(1, n + 1))
            session.add(t)
            numero += 1


@pytest.fixture
def ruta_db(tmp_path):
    ruta = tmp_path / "billar_test.db"
    engine = create_engine(f"sqlite:///{ruta}")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        s.add_all([Bola(numero=n, tipo="lisa") for n in range(16)])
        s.add_all([Falta(**f) for f in FALTAS])
        ana, bea = Jugador(nombre="Ana"), Jugador(nombre="Bea")
        s.add_all([ana, bea, Jugador(nombre="Carla"), Jugador(nombre="Dani", activo=False)])
        s.flush()
        for i in range(8):
            _partida(s, ana, bea, "bola8", 1, [1, 1, 0, 0], [0, 0, 0, 0] if i % 2 == 0 else [1, 1, 1, 1])
        # La blanca (0) no cuenta como bola metida
        _partida(s, ana, bea, "bola9", 2, [[0], 0, 0, 0], [1, 1, 1, 1])
        s.commit()
    engine.dispose()
    return ruta


@pytest.fixture
def servidor(ruta_db):
    return crear_servidor(crear_engine_solo_lectura(ruta_db))


# ---------------------------------------------------------------------------
# Cliente MCP en memoria
# ---------------------------------------------------------------------------

def _con_cliente(servidor, accion):
    async def _run():
        async with Client(InMemoryTransport(servidor)) as cliente:
            return await accion(cliente)
    return anyio.run(_run)


def llamar(servidor, tool, args=None):
    return _con_cliente(servidor, lambda c: c.call_tool(tool, args or {}))


def datos(resultado):
    assert not resultado.is_error, resultado.content
    return resultado.structured_content


# ---------------------------------------------------------------------------
# Descubrimiento
# ---------------------------------------------------------------------------

def test_expone_las_tres_tools_de_solo_lectura(servidor):
    tools = _con_cliente(servidor, lambda c: c.list_tools()).tools

    assert {t.name for t in tools} == TOOLS
    for t in tools:
        assert t.description and len(t.description) > 40, t.name
        assert t.annotations.read_only_hint is True, t.name
        assert t.annotations.destructive_hint is False, t.name
        assert t.output_schema is not None, t.name


def test_modalidad_invalida_la_rechaza_el_esquema(servidor):
    r = llamar(servidor, "ranking_jugadores", {"modalidad": "snooker"})

    assert r.is_error


# ---------------------------------------------------------------------------
# ranking_jugadores
# ---------------------------------------------------------------------------

def test_ranking_por_win_rate_excluye_inactivos_y_separa_sin_minimo(servidor):
    d = datos(llamar(servidor, "ranking_jugadores", {"criterio": "win_rate"}))

    assert [(p["posicion"], p["nombre"]) for p in d["ranking"]] == [(1, "Ana"), (2, "Bea")]
    assert d["ranking"][0]["valor"] == pytest.approx(88.9)
    assert d["ranking"][0]["partidas_jugadas"] == 9
    assert d["por_debajo_del_minimo"] == ["Carla"]
    assert "Dani" not in str(d)


def test_ranking_por_bolas_por_turno_cambia_el_orden(servidor):
    d = datos(llamar(servidor, "ranking_jugadores", {"criterio": "bolas_por_turno"}))

    # Ana 16 bolas / 36 turnos; Bea 20 / 36
    assert [p["nombre"] for p in d["ranking"]] == ["Bea", "Ana"]
    assert d["ranking"][0]["valor"] == pytest.approx(0.56)


def test_ranking_filtra_por_modalidad(servidor):
    d = datos(llamar(servidor, "ranking_jugadores",
                     {"criterio": "partidas_ganadas", "modalidad": "bola9", "min_partidas": 1}))

    assert d["modalidad"] == "bola9"
    assert [(p["nombre"], p["valor"]) for p in d["ranking"]] == [("Bea", 1), ("Ana", 0)]


# ---------------------------------------------------------------------------
# stats_jugador
# ---------------------------------------------------------------------------

def test_stats_jugador_por_nombre_sin_distinguir_mayusculas(servidor):
    d = datos(llamar(servidor, "stats_jugador", {"nombre": "  ana "}))

    assert d["nombre"] == "Ana"
    assert d["partidas_jugadas"] == 9
    assert d["partidas_ganadas"] == 8
    assert d["bolas_metidas"] == 16  # la blanca del turno de bola9 no cuenta
    assert d["histograma_bolas_turno"] == {"0": 20, "1": 16, "2": 0, "3": 0, "4+": 0}


def test_stats_jugador_con_modalidad(servidor):
    d = datos(llamar(servidor, "stats_jugador", {"nombre": "Bea", "modalidad": "bola9"}))

    assert d["partidas_jugadas"] == 1
    assert d["win_rate_pct"] == 100.0


def test_stats_jugador_inexistente_devuelve_error_con_nombres_validos(servidor):
    r = llamar(servidor, "stats_jugador", {"nombre": "Nadie"})

    assert r.is_error
    texto = r.content[0].text
    assert "Nadie" in texto
    assert "Ana" in texto and "Bea" in texto and "Carla" in texto
    assert "Dani" not in texto


# ---------------------------------------------------------------------------
# consistencia_jugadores
# ---------------------------------------------------------------------------

def test_consistencia_en_bola8_valores_exactos(servidor):
    d = datos(llamar(servidor, "consistencia_jugadores", {"modalidad": "bola8"}))

    ana, bea = d["clasificados"]
    assert (ana["posicion"], ana["nombre"], ana["cv"]) == (1, "Ana", 0.0)
    assert ana["partidas_validas"] == 8
    assert (bea["posicion"], bea["nombre"]) == (2, "Bea")
    assert bea["media_bolas_turno"] == pytest.approx(0.5)
    assert bea["cv"] == pytest.approx(1.0)


def test_consistencia_global_ordena_y_explica_quien_no_clasifica(servidor):
    d = datos(llamar(servidor, "consistencia_jugadores"))

    assert [j["nombre"] for j in d["clasificados"]] == ["Ana", "Bea"]
    assert d["clasificados"][0]["cv"] < d["clasificados"][1]["cv"]
    assert [j["nombre"] for j in d["sin_clasificar"]] == ["Carla"]
    assert d["sin_clasificar"][0]["motivo"]
    assert "variación" in d["definicion"]


# ---------------------------------------------------------------------------
# Solo lectura a nivel de conexión
# ---------------------------------------------------------------------------

def test_engine_solo_lectura_rechaza_escrituras(ruta_db):
    engine = crear_engine_solo_lectura(ruta_db)

    with Session(engine) as s:
        s.add(Jugador(nombre="Intruso"))
        with pytest.raises(OperationalError, match="readonly"):
            s.commit()


def test_engine_solo_lectura_no_crea_db_si_no_existe(tmp_path):
    ruta = tmp_path / "no_existe.db"
    engine = crear_engine_solo_lectura(ruta)

    with pytest.raises(OperationalError):
        with engine.connect():
            pass
    assert not ruta.exists()
