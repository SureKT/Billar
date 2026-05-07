"""
Fixtures y helpers compartidos por todos los tests.
"""
import pytest
from sqlmodel import SQLModel, Session, create_engine, select

# Importar todos los modelos para que SQLModel registre las tablas
from app.models import Jugador, Bola, Falta, Partida, PartidaJugador, Turno  # noqa: F401
from app.database import FALTAS


# ---------------------------------------------------------------------------
# Fixture de sesión con BD en memoria
# ---------------------------------------------------------------------------

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        echo=False,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        _seed(session)
        yield session


def _seed(session: Session) -> None:
    """Poblar datos base: bolas, faltas y dos jugadores de prueba."""
    session.add(Bola(numero=0, tipo="blanca"))
    for n in range(1, 8):
        session.add(Bola(numero=n, tipo="lisa"))
    session.add(Bola(numero=8, tipo="ocho"))
    for n in range(9, 16):
        session.add(Bola(numero=n, tipo="rayada"))

    for f in FALTAS:
        session.add(Falta(nombre=f["nombre"], penalizacion=f["penalizacion"]))

    session.add(Jugador(nombre="J1"))
    session.add(Jugador(nombre="J2"))
    session.commit()


# ---------------------------------------------------------------------------
# Helpers reutilizables
# ---------------------------------------------------------------------------

def get_jugador(session: Session, nombre: str) -> Jugador:
    return session.exec(select(Jugador).where(Jugador.nombre == nombre)).first()


def get_falta(session: Session, nombre: str) -> Falta | None:
    return session.exec(select(Falta).where(Falta.nombre == nombre)).first()


def crear_partida(
    session: Session,
    modalidad: str = "bola8",
) -> tuple[Partida, Jugador, Jugador]:
    """Crea una partida con J1 (equipo 1) y J2 (equipo 2). J1 saca primero."""
    j1 = get_jugador(session, "J1")
    j2 = get_jugador(session, "J2")
    partida = Partida(modalidad=modalidad, siguiente_jugador_id=j1.id)
    session.add(partida)
    session.flush()
    session.add(PartidaJugador(partida_id=partida.id, jugador_id=j1.id, equipo=1, orden=0))
    session.add(PartidaJugador(partida_id=partida.id, jugador_id=j2.id, equipo=2, orden=1))
    session.commit()
    session.refresh(partida)
    return partida, j1, j2


def crear_turno_contextual(
    session: Session,
    partida: Partida,
    jugador: Jugador,
    bolas: list[int],
    numero: int,
    falta_nombre: str | None = None,
) -> None:
    """
    Crea, evalúa y hace commit de un turno ya resuelto.
    Úsalo para construir el estado previo al turno que vas a testear.
    """
    from app.logic import evaluar_turno
    falta_id = _resolve_falta(session, falta_nombre)
    t = Turno(
        partida_id=partida.id,
        jugador_id=jugador.id,
        falta_id=falta_id,
        numero=numero,
        repite=False,
        bola_en_mano=False,
    )
    t.bolas_metidas = bolas
    session.add(t)
    session.flush()
    evaluar_turno(session, partida, t)
    session.add(partida)
    session.commit()
    session.refresh(partida)


def make_turno(
    session: Session,
    partida: Partida,
    jugador: Jugador,
    bolas: list[int],
    numero: int,
    falta_nombre: str | None = None,
) -> Turno:
    """
    Crea y hace flush de un turno, listo para pasarle a evaluar_turno.
    NO llama a evaluar_turno ni hace commit — el test lo hace.
    """
    falta_id = _resolve_falta(session, falta_nombre)
    t = Turno(
        partida_id=partida.id,
        jugador_id=jugador.id,
        falta_id=falta_id,
        numero=numero,
        repite=False,
        bola_en_mano=False,
    )
    t.bolas_metidas = bolas
    session.add(t)
    session.flush()
    return t


def _resolve_falta(session: Session, nombre: str | None) -> int | None:
    if nombre is None:
        return None
    f = get_falta(session, nombre)
    return f.id if f else None
