# Estadísticas Mejoradas — Design Spec

## Goal

Añadir 5 nuevas métricas por jugador y reemplazar el ranking actual de `/estadisticas` por una tabla comparativa ordenable con scroll horizontal.

## Architecture

Sin migración de BD. Todo se calcula en `_calcular_stats()` sobre turnos ya existentes. El frontend añade un componente `TablaComparativa` que reemplaza `FilaRanking` en `Estadisticas.jsx`.

**Tech Stack:** FastAPI / SQLModel (backend), React (frontend), `useSessionState` para persistir sort.

---

## Sección 1: Nuevas métricas backend

### Campos nuevos en `JugadorStats`

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `break_bolas_media` | `float` | `0.0` | Media de bolas metidas en turnos `numero==1` |
| `break_con_bola_pct` | `float` | `0.0` | % de breaks donde el jugador metió ≥1 bola |
| `bolas_por_partida` | `float` | `0.0` | Total bolas / partidas finalizadas con participación |
| `max_bolas_turno` | `int` | `0` | Máximo de bolas metidas en un único turno |
| `faltas_por_partida` | `float` | `0.0` | Total faltas / partidas jugadas |

### Cálculo en `_calcular_stats()`

Se añaden contadores en el loop de turnos existente. Un único pase sobre `turnos`:

```python
# turno.numero es 1-based; numero==1 es el break
breaks = [t for t in turnos if t.numero == 1]
break_bolas = [sum(1 for b in t.bolas_metidas if b != 0) for t in breaks]
break_bolas_media = round(sum(break_bolas) / len(break_bolas), 2) if break_bolas else 0.0
break_con_bola_pct = round(sum(1 for b in break_bolas if b > 0) / len(break_bolas) * 100, 1) if break_bolas else 0.0

max_bolas_turno = max(
    (sum(1 for b in t.bolas_metidas if b != 0) for t in turnos),
    default=0
)

total_faltas_jugador = sum(1 for t in turnos if t.falta_id)
faltas_por_partida = round(total_faltas_jugador / partidas_jugadas, 2) if partidas_jugadas else 0.0

# partidas finalizadas donde el jugador participó (para bolas_por_partida)
partidas_fin_count = sum(
    1 for pid in partida_ids
    if (p := session.get(Partida, pid)) and p.ganador_equipo
)
bolas_por_partida = round(bolas_metidas / partidas_fin_count, 2) if partidas_fin_count else 0.0
```

---

## Sección 2: Tabla comparativa frontend

### Componente `TablaComparativa`

Reemplaza el bloque `FilaRanking`-based en `Estadisticas.jsx`. Archivo: `frontend/src/pages/Estadisticas.jsx` (componente inline o extraído a `frontend/src/components/TablaComparativa.jsx` si supera ~120 líneas).

### Columnas

Dos grupos: **siempre visibles** (sin scroll) y **métricas nuevas** (requieren scroll derecho).

| Key | Cabecera | Valor | Grupo |
|---|---|---|---|
| `nombre` | Jugador | nombre + dot color + medalla | sticky left |
| `pj` | PJ | `partidas_jugadas` | siempre visible |
| `winrate` | Win% | barra mini + porcentaje | siempre visible |
| `bolas` | Bolas | `bolas_metidas` | siempre visible |
| `racha` | Racha | `racha_actual` (▲3 / ▼2 / —) | siempre visible |
| `bpt` | B/T | `bolas_por_turno` | métricas nuevas |
| `bpp` | B/P | `bolas_por_partida` | métricas nuevas |
| `break` | Break% | `break_con_bola_pct` | métricas nuevas |
| `fpp` | F/P | `faltas_por_partida` | métricas nuevas |

Las columnas del grupo "métricas nuevas" llevan fondo `rgba(255,255,255,.015)` para señalar visualmente que son secundarias/scrollables.

### Interacción

- Tap en cabecera (height 42px mínimo) → ordena por esa columna; segundo tap → invierte dirección
- Columna activa: color accent en cabecera
- Sort por defecto: `winrate` descendente
- Sort key + dirección persisten: `useSessionState('stats_tabla_sort', 'winrate')` y `useSessionState('stats_tabla_dir', 'desc')`
- Fila pos 1: fondo dorado sutil `rgba(250,204,21,.04)`
- Pos 1–3: emoji medalla (🥇🥈🥉), resto: número

### Layout mobile (390px)

```
┌─────────────┬────┬──────────┬───────┬───────║░B/T░║░B/P░║░Brk%░║░F/P░║
│ Jugador     │ PJ │  Win%    │ Bolas │ Racha ║     métricas nuevas      ║
│ (sticky)    │    │ ▓▓▓▓░ % │       │       ║   (scroll derecho →)     ║
├─────────────┼────┼──────────┼───────┼───────╫──────╫──────╫───────╫─────╢
│ 🥇 Gerard  │ 24 │ ████ 71% │  187  │  ▲3   ║ 0.82 ║  7.8 ║  68%  ║ 0.9 ║
│ 🥈 Marcos  │ 22 │ ███░ 59% │  163  │  ▼1   ║ 0.74 ║  7.1 ║  55%  ║ 1.3 ║
└─────────────┴────┴──────────┴───────┴───────╨──────╨──────╨───────╨─────╜
```

**Affordances de scroll:**
- Sombra gradiente en borde derecho del contenedor (`linear-gradient(to left, rgba(26,29,39,.9), transparent)`)
- Label "Desliza para más →" en cabecera de sección
- Scrollbar oculta (`scrollbar-width: none`) — scroll nativo touch

`Win%` reutiliza lógica de `BarraWin` existente. Columna `Jugador` usa `position: sticky; left: 0; box-shadow: 1px 0 0 var(--border)`.

### Leyenda

Pie de tabla con abreviaturas: `PJ partidas jugadas · B/T bolas/turno · B/P bolas/partida · Break% breaks con bola · F/P faltas/partida`

### Win% colores

- ≥60% → `#4ade80` (verde)
- 40–59% → `#fbbf24` (amarillo)
- <40% → `#f87171` (rojo)

---

## Sección 3: Testing

### Backend

```python
# tests/test_jugadores.py

def test_stats_jugador_sin_breaks(session):
    """Jugador sin turnos devuelve métricas nuevas en 0."""
    jugador = crear_jugador(session, "Test")
    stats = _calcular_stats(session, jugador)
    assert stats.break_bolas_media == 0.0
    assert stats.break_con_bola_pct == 0.0
    assert stats.bolas_por_partida == 0.0
    assert stats.max_bolas_turno == 0
    assert stats.faltas_por_partida == 0.0

def test_stats_break_con_bola(session):
    """Break con 2 bolas metidas → break_bolas_media=2.0, break_con_bola_pct=100.0."""
    # crear partida + turno numero=1 con bolas [1, 3]
    ...
    assert stats.break_bolas_media == 2.0
    assert stats.break_con_bola_pct == 100.0
```

### Frontend

Verificación manual: ordenar por cada columna, comprobar que el sort key persiste al navegar a otra página y volver.

---

## Archivos afectados

| Archivo | Acción |
|---|---|
| `app/routers/jugadores.py` | Modificar: añadir 5 campos a `JugadorStats` y cálculo en `_calcular_stats()` |
| `frontend/src/pages/Estadisticas.jsx` | Modificar: reemplazar bloque ranking por `TablaComparativa` |
| `tests/test_jugadores.py` | Modificar/crear: tests para nuevas métricas |

---

## Fuera de scope

- Gráfico de evolución de las nuevas métricas en el tiempo
- Exportación de datos
- Comparativa H2H en la tabla (ya existe en `Jugadores.jsx`)
- Métrica de tiempo entre partidas
