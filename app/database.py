from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = "sqlite:///./billar.db"
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

FALTAS = [
    {"nombre": "Blanca dentro (Scratch)",       "penalizacion": "bola_en_mano"},
    {"nombre": "No toca objetivo legal",         "penalizacion": "bola_en_mano"},
    {"nombre": "Falta de banda",                 "penalizacion": "bola_en_mano"},
    {"nombre": "Bola fuera de mesa",             "penalizacion": "bola_en_mano"},
    {"nombre": "Bolas en movimiento",            "penalizacion": "bola_en_mano"},
    {"nombre": "Tocar bolas con cuerpo/taco",    "penalizacion": "bola_en_mano"},
    {"nombre": "Pie en el suelo",                "penalizacion": "bola_en_mano"},
    {"nombre": "Doble golpe",                    "penalizacion": "bola_en_mano"},
    {"nombre": "Bola 8 ilegal",                  "penalizacion": "pierde_partida"},
    {"nombre": "Tres faltas consecutivas",       "penalizacion": "pierde_partida"},
]


def init_db():
    SQLModel.metadata.create_all(engine)
    _migrate()
    _seed_datos_base()


def _migrate():
    """Migraciones incrementales para DBs existentes (ALTER TABLE idempotentes)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE partida ADD COLUMN fecha_fin DATETIME",
            "ALTER TABLE jugador ADD COLUMN color TEXT",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # columna ya existe — ignorar


def get_session():
    with Session(engine) as session:
        yield session


def _seed_datos_base():
    from sqlmodel import Session, select
    from app.models import Bola, Falta

    with Session(engine) as session:
        # Bolas
        if not session.exec(select(Bola)).first():
            bolas = [Bola(numero=0, tipo="blanca")]
            bolas += [Bola(numero=n, tipo="lisa") for n in range(1, 8)]
            bolas.append(Bola(numero=8, tipo="ocho"))
            bolas += [Bola(numero=n, tipo="rayada") for n in range(9, 16)]
            session.add_all(bolas)

        # Faltas: si el catálogo no coincide, lo reemplaza
        existentes = session.exec(select(Falta)).all()
        nombres_actuales = {f.nombre for f in existentes}
        nombres_esperados = {f["nombre"] for f in FALTAS}

        if nombres_actuales != nombres_esperados:
            for f in existentes:
                session.delete(f)
            session.flush()
            for f in FALTAS:
                session.add(Falta(nombre=f["nombre"], penalizacion=f["penalizacion"]))

        session.commit()
