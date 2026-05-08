from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import UniqueConstraint
import json


class Jugador(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(index=True, unique=True)

    turnos: list["Turno"] = Relationship(back_populates="jugador")


class Bola(SQLModel, table=True):
    numero: int = Field(primary_key=True)  # 0-15
    tipo: str  # "lisa", "rayada", "blanca", "ocho"


# Tabla de enlace jugadores <-> partidas
class PartidaJugador(SQLModel, table=True):
    partida_id: Optional[int] = Field(default=None, foreign_key="partida.id", primary_key=True)
    jugador_id: Optional[int] = Field(default=None, foreign_key="jugador.id", primary_key=True)
    equipo: int  # 1 o 2
    orden: int   # posición en la lista circular


class Partida(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    modalidad: str = Field(default="bola8")  # "bola8" | "bola9"
    fecha: datetime = Field(default_factory=datetime.utcnow)
    fecha_fin: Optional[datetime] = Field(default=None)   # se rellena al finalizar
    estado: str = Field(default="en_curso")  # "en_curso" | "finalizada"
    ganador_equipo: Optional[int] = Field(default=None)  # 1 o 2

    # Grupos asignados (null hasta que se asignen)
    equipo1_grupo: Optional[str] = Field(default=None)  # "lisas" | "rayadas"
    equipo2_grupo: Optional[str] = Field(default=None)

    # Siguiente turno
    siguiente_jugador_id: Optional[int] = Field(default=None, foreign_key="jugador.id")
    bola_en_mano: bool = Field(default=False)

    turnos: list["Turno"] = Relationship(back_populates="partida")


class Falta(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(unique=True)
    penalizacion: str  # "bola_en_mano" | "pierde_partida" | "ninguna"

    turnos: list["Turno"] = Relationship(back_populates="falta")


class Turno(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("partida_id", "numero", name="uq_turno_partida_numero"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    partida_id: int = Field(foreign_key="partida.id")
    jugador_id: int = Field(foreign_key="jugador.id")
    falta_id: Optional[int] = Field(default=None, foreign_key="falta.id")
    numero: int             # orden dentro de la partida (1-based)
    repite: bool = Field(default=False)
    bola_en_mano: bool = Field(default=False)  # si este turno tenía bola en mano disponible
    bolas_metidas_json: str = Field(default="[]")  # JSON list de números de bola

    partida: Optional[Partida] = Relationship(back_populates="turnos")
    jugador: Optional[Jugador] = Relationship(back_populates="turnos")
    falta: Optional[Falta] = Relationship(back_populates="turnos")

    @property
    def bolas_metidas(self) -> list[int]:
        try:
            result = json.loads(self.bolas_metidas_json or "[]")
            return result if isinstance(result, list) else []
        except (json.JSONDecodeError, TypeError):
            return []

    @bolas_metidas.setter
    def bolas_metidas(self, value: list[int]):
        self.bolas_metidas_json = json.dumps(value if value is not None else [])
