# Stats Backlog — Billar

Inventario exhaustivo de estadísticas analizables con los datos actuales + sugerencias de integración.  
Ninguna requiere cambio de modelo de datos (todo calculable desde tablas existentes).

**Leyenda de estado:** ✅ implementada · 🔵 pendiente · ⚠️ parcial  
**Leyenda de ubicación sugerida:** `Estadisticas` · `Jugadores` · `Partida` · `Sesión` · `Torneo`

---

## A — Jugador · Rendimiento

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Partidas jugadas (total / bola8 / bola9) | ✅ | Jugadores, Estadisticas | — |
| Partidas ganadas (total / bola8 / bola9) | ✅ | Jugadores, Estadisticas | — |
| Win rate % | ✅ | Jugadores, Estadisticas | — |
| Win rate tendencia (últimas N) | ⚠️ | Jugadores | hardcoded últimas 5 |
| Win rate por sesión | 🔵 | Estadisticas · Sesión | muy útil para ver picos |
| Win rate mensual (evolución) | 🔵 | Estadisticas (gráfica línea) | actualmente solo conteo mensual |
| Racha actual (+ ganadora / − perdedora) | ✅ | Jugadores, Estadisticas tabla | — |
| Racha ganadora histórica (best ever) | ✅ | Jugadores, Estadisticas records | — |
| Racha perdedora histórica | 🔵 | Jugadores | simétrico a racha_mejor |
| Win rate cuando rompe vs cuando no rompe | 🔵 | Jugadores (drill-down) | cruzar turno.numero==1 con ganador_equipo |
| Win rate como equipo 1 vs equipo 2 | 🔵 | Jugadores (drill-down) | PartidaJugador.equipo |

---

## B — Jugador · Bolas

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Bolas metidas total (excl. blanca) | ✅ | Jugadores, Estadisticas | — |
| Bolas por turno (promedio) | ✅ | Jugadores, Estadisticas | — |
| Bolas por partida (promedio) | ✅ | Jugadores, Estadisticas | — |
| Bolas por turno tendencia (últimas N) | ⚠️ | Jugadores | parcial (hardcoded 5) |
| Máximo bolas en un turno (récord) | ✅ | Jugadores, Estadisticas records | — |
| Histograma bolas/turno (0/1/2/3/4+) | 🔵 | Jugadores (drill-down), Estadisticas | mini barchart — muy visual |
| Bolas lisas metidas | 🔵 | Jugadores (drill-down) | filtrar bolas_metidas 1-7 |
| Bolas rayadas metidas | 🔵 | Jugadores (drill-down) | filtrar bolas_metidas 9-15 |
| Bolas metidas con bola en mano | ✅ | Jugadores | — |
| Bolas/turno con bola en mano vs sin | 🔵 | Jugadores (drill-down) | eficiencia posicional |
| % turnos con ≥1 bola (tasa anotación) | 🔵 | Jugadores, Estadisticas | turnos_repite / total_turnos |
| Evolución bolas/turno por mes/sesión | 🔵 | Estadisticas (gráfica línea) | progresión de skill |

---

## C — Jugador · Break (turno nº1)

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Total breaks ejecutados | ⚠️ | Jugadores | calculado internamente, no mostrado |
| Media bolas en break | ✅ | Estadisticas | — |
| % breaks con ≥1 bola | ✅ | Estadisticas | — |
| Máximo bolas en un break (récord) | 🔵 | Estadisticas records, Jugadores | max de break_bolas[] |
| Win rate cuando mete en break vs no mete | 🔵 | Jugadores (drill-down) | cruce valioso |
| % breaks que asignan grupo inmediato (bola8) | 🔵 | Jugadores (drill-down bola8) | breakbolas all-same-type |

---

## D — Jugador · Turnos

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Total turnos jugados | 🔵 | Jugadores | len(turnos) |
| Promedio turnos por partida | 🔵 | Jugadores | turnos / partidas |
| % turnos que repiten | 🔵 | Jugadores | tasa de continuidad |
| Turnos con bola en mano recibida | ✅ | Jugadores | — |
| Promedio turnos hasta victoria | 🔵 | Jugadores (drill-down) | longitud de partidas ganadas |
| Turnos por partida ganada vs perdida | 🔵 | Jugadores (drill-down) | partidas cortas = victoria? |

---

## E — Jugador · Faltas

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Total faltas | 🔵 | Jugadores | suma directa |
| Faltas por partida | ✅ | Estadisticas tabla | — |
| Faltas por turno | 🔵 | Jugadores | f/t = disciplina táctica |
| Falta más frecuente (bola8 / bola9) | ✅ | Jugadores | — |
| Distribución por tipo de falta (%) | 🔵 | Jugadores (drill-down) | mini donut o lista |
| Faltas leves vs graves (%) | 🔵 | Jugadores | bola_en_mano vs pierde_partida |
| Veces que perdió por bola 8 ilegal | 🔵 | Jugadores (curiosidades) | falta.nombre == "Bola 8 ilegal" + pierde |
| Veces que perdió por tres faltas consecutivas | 🔵 | Jugadores (curiosidades) | ídem |
| Tasa falta con/sin bola en mano | 🔵 | Jugadores (drill-down) | presión bajo bola en mano? |
| Evolución faltas/partida por mes | 🔵 | Estadisticas | disciplina con el tiempo |

---

## F — Jugador · Duración y grupos

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Duración media de partida | ✅ | Estadisticas | — |
| Duración media ganando vs perdiendo | 🔵 | Jugadores (drill-down) | si pierde rápido vs arrastra |
| % partidas como Lisas vs Rayadas (bola8) | 🔵 | Jugadores (drill-down bola8) | equipo1_grupo/equipo2_grupo |
| Win rate como Lisas vs Rayadas | 🔵 | Jugadores (drill-down bola8) | preferencia táctica real |
| Bolas/turno como Lisas vs Rayadas | 🔵 | Jugadores (drill-down bola8) | afecta la dificultad |

---

## G — H2H (cara a cara)

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Partidas entre A y B | ✅ | Jugadores (sección H2H) | — |
| Victorias A / B | ✅ | Jugadores (sección H2H) | — |
| Win rate A vs B | ✅ | Jugadores (sección H2H) | — |
| Racha actual A contra B | 🔵 | Jugadores (H2H expandido) | últimas N entre ellos |
| Bolas/turno A en partidas contra B | 🔵 | Jugadores (H2H expandido) | rinde más/menos contra X |
| Duración media A vs B | 🔵 | Jugadores (H2H expandido) | — |
| H2H en torneos vs H2H libre | 🔵 | Jugadores (H2H) | TorneoEnfrentamiento.partida_id |

---

## H — Por Partida

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Duración total | ✅ | Partida (display) | — |
| Número de turnos | 🔵 | Partida (historial) | len(turnos) |
| Bolas metidas por equipo | 🔵 | Partida (ResultadoBanner) | post-fin |
| Faltas por equipo | 🔵 | Partida (ResultadoBanner) | post-fin |
| Cómo terminó (8 válida / 8 ilegal / 3 faltas) | 🔵 | Partida, Inicio (PartidaCard) | último turno → falta |
| Turno número en el que se terminó | 🔵 | Partida (curiosidades) | last turno.numero |
| Bolas en break y quién rompió | 🔵 | Partida (historial) | turno.numero==1 |
| Bola en mano recibida (cuántas veces) | 🔵 | Partida | count turnos.bola_en_mano |

---

## I — Por Sesión (gap <4h)

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Partidas en sesión / duración total | ✅ | Inicio (SesionHeader) | — |
| Victorias por jugador en sesión | ✅ | Inicio (MarcadorNoche) | — |
| Bolas metidas por jugador en sesión | 🔵 | Inicio (MarcadorNoche expandido) | sumar turnos del período |
| Faltas por jugador en sesión | 🔵 | Inicio (MarcadorNoche expandido) | — |
| Mejor bolas/turno en sesión | 🔵 | Inicio (MarcadorNoche) | MVP táctico |
| Comparación rendimiento sesión vs histórico | 🔵 | Inicio (widget) | "Hoy: 0.52 B/T vs media 0.43" |
| Evolución win rate inter-sesiones | 🔵 | Estadisticas (gráfica línea) | eje x = sesiones, no meses |

---

## J — Global

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Total partidas / finalizadas / en curso | ✅ | Estadisticas (resumen) | — |
| Split bola8 vs bola9 (%) | ✅ | Estadisticas | — |
| Total bolas / faltas | ✅ | Estadisticas | — |
| Faltas más frecuentes ranking | ✅ | Estadisticas | — |
| Duración media global | ✅ | Estadisticas | — |
| Partida más rápida / más lenta | ✅ | Estadisticas (records) | — |
| Récord bolas en un turno (global) | ✅ | Estadisticas (records) | — |
| Partidas por mes (volumen) | 🔵 | Estadisticas (gráfica barras) | actualmente solo barras sin actividad |
| Promedio turnos por partida global | 🔵 | Estadisticas (resumen) | — |
| Partida con más turnos (récord) | 🔵 | Estadisticas (records) | la más épica |
| Partida con más bolas totales (récord) | 🔵 | Estadisticas (records) | la más productiva |

---

## K — Torneos

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Torneos jugados / ganados por jugador | ✅ | Jugadores (sección torneos) | — |
| Posición final por torneo | ✅ | Jugadores | — |
| Posición media histórica | 🔵 | Jugadores | avg de posiciones |
| Bolas metidas por torneo | 🔵 | TorneoDetalle | sumar turnos de partidas del torneo |
| Win rate torneo vs partidas libres | 🔵 | Jugadores | presión del torneo importa? |
| Progresión posición entre torneos | 🔵 | Jugadores (gráfica) | mejora con el tiempo? |
| Duración del torneo (fecha_fin - fecha) | 🔵 | TorneoDetalle | — |

---

## L — Micro-turno (granularidad máxima)

| Estadística | Estado | Ubicación sugerida | Notas |
|---|---|---|---|
| Histograma bolas/turno (0/1/2/3/4+) | 🔵 | Jugadores (drill-down), Estadisticas | la más informativa de skill |
| Break vs turno normal comparativa | 🔵 | Estadisticas (sección break) | 2 barras lado a lado |
| Efecto bola en mano (bolas/turno) | 🔵 | Jugadores (drill-down) | bola_en_mano=T vs F |
| Turnos consecutivos sin falta (racha limpia) | 🔵 | Jugadores | max de secuencias sin falta |
| es_respot (bola9): frecuencia y resultado | 🔵 | Jugadores (drill-down bola9) | — |

---

## Sugerencias de integración por vista

### Estadisticas.jsx (escritorio)
**Prioridad alta:**
- Histograma bolas/turno por jugador (reemplaza barras horizontales simples)
- Evolución win rate por sesión (eje x = sesiones cronológicas)
- Win rate cuando rompe vs cuando no
- Partida con más turnos / más bolas (2 records nuevos)
- Faltas/partida por jugador en la tabla comparativa (ya hay F/P)

**Prioridad media:**
- Actividad mensual mejorada (barras apiladas ganadas/perdidas, no solo conteo)
- Heatmap de faltas por jugador × tipo de falta

### Jugadores.jsx (per-player drill-down)
**Prioridad alta:**
- Histograma bolas/turno (mini, 5 barras)
- Win rate Lisas vs Rayadas (bola8)
- Racha perdedora histórica
- % turnos que repiten

**Prioridad media:**
- Duración ganando vs perdiendo
- Falta que más le cuesta (con % y desglose)
- Comparación vs media global ("B/T: 0.52 · media 0.43 · +21%")

### Inicio.jsx (sesión / tiempo real)
**Prioridad alta:**
- Bolas metidas en sesión (expandir MarcadorNoche)
- Comparación sesión actual vs histórico de cada jugador

### Partida.jsx (ResultadoBanner)
**Prioridad media:**
- Cómo terminó (8 válida / 8 ilegal / 3 faltas)
- Bolas por equipo en esa partida

---

## Resumen de volumen

| Estado | Cantidad aproximada |
|---|---|
| ✅ Implementadas | 28 |
| ⚠️ Parcialmente implementadas | 5 |
| 🔵 Calculables pendientes | 72 |
| **Total** | **~105** |

Todas las `🔵` son calculables sin ALTER TABLE — solo lógica sobre las tablas existentes.
