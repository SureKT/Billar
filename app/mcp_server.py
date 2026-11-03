"""
Servidor MCP de Billar (solo lectura, transporte stdio).

Arranque: `python -m app.mcp_server`. Lee la DB indicada por DATABASE_URL (la misma
variable que la app) en modo solo lectura de SQLite.

Es un adaptador fino: el ranking y las stats reutilizan `_calcular_stats` del router de
jugadores, para que el MCP y la app den las mismas cifras. Importar una funciÃ³n privada de
un router es deuda consciente; desaparece al extraer la capa de servicios.
La consistencia vive en `app/consistencia.py` como funciÃ³n pura.

Nada debe escribir en stdout salvo el protocolo: stdout ES el canal MCP.
"""
import json
import os
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field
from sqlalchemy import Engine
from sqlalchemy.engine import make_url
from sqlmodel import Session, create_engine, select

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations

from app.consistencia import DEFINICION, calcular_consistencia
from app.models import Jugador, Partida, Turno
from app.routers.jugadores import JugadorStats, _calcular_stats

Modalidad = Literal["bola8", "bola9"]
Criterio = Literal["win_rate", "bolas_por_turno", "partidas_ganadas"]

SOLO_LECTURA = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
)

INSTRUCCIONES = (
    "EstadÃ­sticas de partidas de billar (bola 8 y bola 9) entre un grupo de amigos. "
    "Solo lectura. Las cifras ya vienen calculadas: interprÃ©talas, no las recalcules. "
    "Los jugadores se identifican por nombre. Solo se consideran jugadores activos."
)


# ---------------------------------------------------------------------------
# Modelos de salida (el SDK genera el outputSchema a partir de ellos)
# ---------------------------------------------------------------------------

class PosicionRanking(BaseModel):
    posicion: int
    nombre: str
    valor: float = Field(description="Valor del criterio (win_rate en %, bolas_por_turno o nÂº de victorias)")
    partidas_jugadas: int
    partidas_ganadas: int


class Ranking(BaseModel):
    criterio: Criterio
    modalidad: Optional[Modalidad]
    min_partidas: int
    ranking: list[PosicionRanking]
    por_debajo_del_minimo: list[str] = Field(description="Jugadores activos con menos de min_partidas")


class StatsJugador(BaseModel):
    nombre: str
    modalidad: Optional[Modalidad]
    partidas_jugadas: int
    partidas_ganadas: int
    win_rate_pct: float
    bolas_metidas: int = Field(description="Sin contar la blanca")
    bolas_por_turno: float
    bolas_por_turno_ultimas_5: Optional[float] = Field(description="Ãšltimas 5 partidas finalizadas; None si hay menos de 2")
    bolas_por_partida: float
    max_bolas_turno: int
    max_bolas_seguidas: int = Field(description="MÃ¡ximo de bolas propias en una visita a la mesa sin ceder el turno")
    racha_actual: int = Field(description="Positivo = victorias seguidas, negativo = derrotas seguidas")
    racha_mejor: int
    racha_peor: int
    break_bolas_media: float
    break_con_bola_pct: float
    faltas_por_partida: float
    falta_frecuente_bola8: Optional[str]
    falta_frecuente_bola9: Optional[str]
    histograma_bolas_turno: dict[str, int] = Field(description="NÂº de turnos con 0, 1, 2, 3 y 4+ bolas")
    duracion_promedio_min: Optional[float]


class ConsistenciaJugador(BaseModel):
    posicion: Optional[int] = Field(description="1 = mÃ¡s consistente; None si no clasifica")
    nombre: str
    partidas_validas: int
    media_bolas_turno: Optional[float]
    desviacion: Optional[float]
    cv: Optional[float] = Field(description="Coeficiente de variaciÃ³n; menor = mÃ¡s consistente")
    motivo: Optional[str] = Field(description="Por quÃ© no clasifica; None si clasifica")


class ResultadoConsistencia(BaseModel):
    definicion: str
    modalidad: Optional[Modalidad]
    clasificados: list[ConsistenciaJugador] = Field(description="De mÃ¡s a menos consistente")
    sin_clasificar: list[ConsistenciaJugador]


# ---------------------------------------------------------------------------
# Acceso a datos
# ---------------------------------------------------------------------------

def crear_engine_solo_lectura(ruta_db: str | Path) -> Engine:
    """Engine sobre SQLite en modo `ro`: cualquier escritura falla en la propia conexiÃ³n,
    y si el fichero no existe falla en vez de crear una DB vacÃ­a."""
    uri = f"{Path(ruta_db).resolve().as_uri()}?mode=ro"
    return create_engine(
        "sqlite://",
        creator=lambda: sqlite3.connect(uri, uri=True, check_same_thread=False),
    )


def _jugadores_activos(session: Session) -> list[Jugador]:
    return list(session.exec(
        select(Jugador).where(Jugador.activo == True).order_by(Jugador.nombre)  # noqa: E712
    ).all())


def _buscar_jugador(session: Session, nombre: str) -> Jugador:
    activos = _jugadores_activos(session)
    buscado = nombre.strip().casefold()
    for j in activos:
        if j.nombre.casefold() == buscado:
            return j
    validos = ", ".join(j.nombre for j in activos)
    raise ToolError(f"No hay ningÃºn jugador activo llamado '{nombre.strip()}'. Jugadores activos: {validos}")


def _win_rate_pct(s: JugadorStats) -> float:
    # Misma fÃ³rmula que el frontend: ganadas / jugadas
    return round(s.partidas_ganadas / s.partidas_jugadas * 100, 1) if s.partidas_jugadas else 0.0


def _turnos_y_bolas_por_partida(
    session: Session, modalidad: Optional[str]
) -> dict[int, list[tuple[int, int]]]:
    """jugador_id â†’ [(turnos, bolas sin blanca)] por partida finalizada."""
    q = (
        select(Turno.jugador_id, Turno.partida_id, Turno.bolas_metidas_json)
        .join(Partida, Partida.id == Turno.partida_id)
        .where(Partida.estado == "finalizada")
    )
    if modalidad:
        q = q.where(Partida.modalidad == modalidad)

    acumulado: dict[tuple[int, int], list[int]] = defaultdict(lambda: [0, 0])
    for jugador_id, partida_id, bolas_json in session.exec(q).all():
        bolas = json.loads(bolas_json or "[]")
        par = acumulado[(jugador_id, partida_id)]
        par[0] += 1
        par[1] += sum(1 for b in bolas if b != 0)

    por_jugador: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for (jugador_id, _), (turnos, bolas) in acumulado.items():
        por_jugador[jugador_id].append((turnos, bolas))
    return por_jugador


def _redondear(x: Optional[float]) -> Optional[float]:
    return round(x, 3) if x is not None else None


# ---------------------------------------------------------------------------
# Servidor
# ---------------------------------------------------------------------------

def crear_servidor(engine: Engine) -> MCPServer:
    """FactorÃ­a: los tests inyectan su engine; `main()` inyecta el de producciÃ³n."""
    mcp = MCPServer("billar", instructions=INSTRUCCIONES)

    @mcp.tool(annotations=SOLO_LECTURA)
    def ranking_jugadores(
        criterio: Criterio = "win_rate",
        modalidad: Optional[Modalidad] = None,
        min_partidas: int = Field(default=5, ge=0),
    ) -> Ranking:
        """ClasificaciÃ³n de los jugadores activos por un criterio.

        Usar para "Â¿quiÃ©n gana mÃ¡s?", "Â¿quiÃ©n es el mejor?", "Â¿quiÃ©n mete mÃ¡s bolas?".
        Criterios: win_rate (% de partidas ganadas), bolas_por_turno (media de bolas
        metidas por turno, sin blanca) y partidas_ganadas (nÂº de victorias).
        modalidad: bola8, bola9 o vacÃ­o para ambas. Los jugadores con menos de
        min_partidas no entran en el ranking y aparecen en por_debajo_del_minimo.
        """
        with Session(engine) as s:
            stats = [_calcular_stats(s, j, modalidad) for j in _jugadores_activos(s)]

        def valor(st: JugadorStats) -> float:
            if criterio == "win_rate":
                return _win_rate_pct(st)
            if criterio == "bolas_por_turno":
                return st.bolas_por_turno
            return st.partidas_ganadas

        entran = [st for st in stats if st.partidas_jugadas >= max(min_partidas, 1)]
        entran.sort(key=lambda st: (-valor(st), -st.partidas_jugadas, st.nombre))
        return Ranking(
            criterio=criterio,
            modalidad=modalidad,
            min_partidas=min_partidas,
            ranking=[
                PosicionRanking(
                    posicion=i,
                    nombre=st.nombre,
                    valor=valor(st),
                    partidas_jugadas=st.partidas_jugadas,
                    partidas_ganadas=st.partidas_ganadas,
                )
                for i, st in enumerate(entran, start=1)
            ],
            por_debajo_del_minimo=[st.nombre for st in stats if st not in entran],
        )

    @mcp.tool(annotations=SOLO_LECTURA)
    def stats_jugador(nombre: str, modalidad: Optional[Modalidad] = None) -> StatsJugador:
        """EstadÃ­sticas completas de un jugador activo, buscado por nombre (sin
        distinguir mayÃºsculas).

        Usar para preguntas sobre una persona concreta: victorias, bolas, rachas, break,
        faltas y su distribuciÃ³n de bolas por turno. modalidad: bola8, bola9 o vacÃ­o
        para ambas. Si el nombre no existe, el error lista los nombres vÃ¡lidos.
        """
        with Session(engine) as s:
            st = _calcular_stats(s, _buscar_jugador(s, nombre), modalidad)

        h = st.histograma_bolas_turno or [0] * 5
        return StatsJugador(
            nombre=st.nombre,
            modalidad=modalidad,
            partidas_jugadas=st.partidas_jugadas,
            partidas_ganadas=st.partidas_ganadas,
            win_rate_pct=_win_rate_pct(st),
            bolas_metidas=st.bolas_metidas,
            bolas_por_turno=st.bolas_por_turno,
            bolas_por_turno_ultimas_5=st.bolas_por_turno_reciente,
            bolas_por_partida=st.bolas_por_partida,
            max_bolas_turno=st.max_bolas_turno,
            max_bolas_seguidas=st.max_bolas_seguidas,
            racha_actual=st.racha_actual,
            racha_mejor=st.racha_mejor,
            racha_peor=st.racha_peor,
            break_bolas_media=st.break_bolas_media,
            break_con_bola_pct=st.break_con_bola_pct,
            faltas_por_partida=st.faltas_por_partida,
            falta_frecuente_bola8=st.falta_frecuente_bola8_nombre,
            falta_frecuente_bola9=st.falta_frecuente_bola9_nombre,
            histograma_bolas_turno=dict(zip(["0", "1", "2", "3", "4+"], h)),
            duracion_promedio_min=st.duracion_promedio_min,
        )

    @mcp.tool(annotations=SOLO_LECTURA)
    def consistencia_jugadores(modalidad: Optional[Modalidad] = None) -> ResultadoConsistencia:
        """QuiÃ©n es el jugador mÃ¡s consistente (regular) y quiÃ©n el mÃ¡s inconsistente.

        MÃ©trica: coeficiente de variaciÃ³n de las bolas por turno partida a partida
        (detalle exacto en el campo definicion). Menor cv = mÃ¡s consistente. Ordena de
        mÃ¡s a menos consistente; quien no tiene datos suficientes va a sin_clasificar
        con el motivo. Mide regularidad, no nivel: alguien puede ser muy consistente
        metiendo pocas bolas. modalidad: bola8, bola9 o vacÃ­o para ambas.
        """
        with Session(engine) as s:
            jugadores = _jugadores_activos(s)
            datos = _turnos_y_bolas_por_partida(s, modalidad)

        filas = []
        for j in jugadores:
            c = calcular_consistencia(datos.get(j.id, []))
            filas.append(ConsistenciaJugador(
                posicion=None,
                nombre=j.nombre,
                partidas_validas=c.partidas,
                media_bolas_turno=_redondear(c.media),
                desviacion=_redondear(c.desviacion),
                cv=_redondear(c.cv),
                motivo=c.motivo,
            ))

        clasificados = sorted((f for f in filas if f.cv is not None), key=lambda f: (f.cv, f.nombre))
        for i, f in enumerate(clasificados, start=1):
            f.posicion = i
        return ResultadoConsistencia(
            definicion=DEFINICION,
            modalidad=modalidad,
            clasificados=clasificados,
            sin_clasificar=[f for f in filas if f.cv is None],
        )

    return mcp


def main() -> None:
    url = os.getenv("DATABASE_URL", "sqlite:///./billar.db")
    ruta = make_url(url).database
    if not ruta or not Path(ruta).is_file():
        print(f"billar-mcp: no existe la base de datos '{ruta}' (DATABASE_URL={url})", file=sys.stderr)
        sys.exit(1)
    crear_servidor(crear_engine_solo_lectura(ruta)).run("stdio")


if __name__ == "__main__":
    main()
