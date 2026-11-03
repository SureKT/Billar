"""
Métrica de consistencia de un jugador.

Consistencia = coeficiente de variación (CV = desviación típica poblacional / media)
de las bolas por turno partida a partida. Menor CV = más consistente.

Función pura: recibe números, no toca la DB. Es la primera pieza de la futura capa de
servicios; los adaptadores (MCP hoy, quizá REST mañana) solo le pasan los datos.

Por qué así (detalle en docs/superpowers/specs/2026-11-03-mcp-server-mvp-design.md):
- Por partida y no por sesión: hay muchas más partidas que noches por jugador.
- CV y no desviación absoluta: normaliza por nivel; quien mete más no sale
  "irregular" solo por tener más margen para variar.
- Partidas con menos de MIN_TURNOS_POR_PARTIDA turnos se descartan: dan 0.0 o 1.0 y
  disparan la varianza sin informar.
"""
import statistics
from dataclasses import dataclass

MIN_TURNOS_POR_PARTIDA = 3
MIN_PARTIDAS = 8

DEFINICION = (
    "Coeficiente de variación (desviación típica / media) de las bolas por turno de cada "
    f"partida finalizada con al menos {MIN_TURNOS_POR_PARTIDA} turnos del jugador. "
    f"Requiere al menos {MIN_PARTIDAS} partidas válidas. Menor = más consistente. "
    "No ve la dificultad del tiro y mide variación entre partidas, no dentro de una noche."
)


@dataclass(frozen=True)
class Consistencia:
    partidas: int                 # partidas válidas usadas
    media: float | None           # media de bolas/turno; None sin partidas
    desviacion: float | None      # None si no se puede clasificar
    cv: float | None              # None si no se puede clasificar
    motivo: str | None = None     # por qué no se clasifica; None si cv es válido


def calcular_consistencia(partidas: list[tuple[int, int]]) -> Consistencia:
    """`partidas`: una tupla (turnos, bolas sin blanca) por partida finalizada."""
    valores = [bolas / turnos for turnos, bolas in partidas if turnos >= MIN_TURNOS_POR_PARTIDA]
    n = len(valores)

    if n == 0:
        return Consistencia(0, None, None, None, "sin partidas válidas")

    media = statistics.fmean(valores)
    if n < MIN_PARTIDAS:
        return Consistencia(n, media, None, None, f"menos de {MIN_PARTIDAS} partidas válidas")
    if media == 0:
        return Consistencia(n, media, None, None, "media de 0 bolas por turno")

    desviacion = statistics.pstdev(valores)
    return Consistencia(n, media, desviacion, desviacion / media)
