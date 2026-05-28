# Logros — Diseño

**Fecha:** 2026-05-22  
**Estado:** Aprobado  

---

## Resumen

Sistema de logros estilo Steam: catálogo global de 24 logros, desbloqueo por jugador calculado retroactivamente del historial existente. Sin nueva tabla de DB — pure computation on query.

---

## Catálogo completo (24 logros)

| # | Nombre | Condición | Niveles |
|---|--------|-----------|---------|
| 1 | Primera partida | Jugar 1 partida | — |
| 2 | Primera victoria | Ganar 1 partida | — |
| 3 | Primeras bolas | Meter 10 bolas en total | — |
| 4 | Rodaje | Partidas jugadas | 🥉×10 🥈×50 🥇×100 💎×250 |
| 5 | Crack | Victorias totales | 🥉×10 🥈×25 🥇×50 💎×100 |
| 6 | En racha | Victorias consecutivas (máxima racha) | 🥉×3 🥈×5 🥇×10 💎×15 |
| 7 | Artillero | Bolas metidas en total | 🥉×100 🥈×500 🥇×1000 💎×2500 |
| 8 | Limpio | Ganar una partida de Bola 8 sin ninguna falta | — |
| 9 | Golden Break | Ganar metiendo la 8 en el saque | — |
| 10 | Relámpago | Ganar en menos de 5 minutos | — |
| 11 | Tirador | Promedio ≥1.5 bolas/turno en una partida | — |
| 12 | Campeón | Ganar un torneo | — |
| 13 | Tricampeón | Ganar 3 torneos | — |
| 14 | Torpón | Perder por tres faltas consecutivas | — |
| 15 | Nervios | Perder metiendo la 8 antes de tiempo | — |
| 16 | Polivalente | Ganar ≥1 partida de Bola 8 Y ≥1 de Bola 9 | — |
| 17 | Verdugo | Ganar 3 veces seguidas contra el mismo rival | — |
| 18 | Maratoniano | Jugar una partida de más de 30 minutos | — |
| 19 | Intocable | 5 victorias acumuladas sin cometer ninguna falta | — |
| 20 | Noctámbulo | Partida registrada entre las 00:00 y las 02:00 | — |
| 21 | Madrugador | Partida registrada entre las 06:00 y las 09:00 | — |
| 22 | Barrida | Ganar sin que el rival meta ninguna bola de su grupo | — |
| 23 | Sesión perfecta | Ganar 3 partidas en el mismo día | — |
| 24 | Revancha | Ganar inmediatamente después de perder contra el mismo rival | — |
| 25 | Blue balls | Ambos equipos ya sin bolas de grupo y la 8 sin meterse en más de 3 turnos seguidos — ambos jugadores lo desbloquean | — |

**Logros con niveles:** Rodaje, Crack, En racha, Artillero (4 total).  
Para niveles, el jugador acumula todos los niveles alcanzados (bronce + plata si tiene ≥25 victorias).

---

## Arquitectura backend

### Nuevo archivo: `app/routers/logros.py`

Dos endpoints:

```
GET /api/logros/catalogo
```
Devuelve lista de todos los logros con metadata (id, nombre, descripcion, icono, niveles si aplica). Sin estado de jugador.

```
GET /api/logros/{jugador_id}
```
Devuelve el catálogo completo con `desbloqueado: bool` (y `nivel_actual: str | null` para los nivelados) calculado para ese jugador.

### Cómputo: `app/logic_logros.py`

Módulo separado de `logic.py` con una función principal:

```python
def calcular_logros(jugador_id: int, session: Session) -> list[LogroEstado]
```

Hace las queries necesarias de partidas, turnos y torneos del jugador y evalúa cada logro. Retroactivo: opera sobre todos los datos históricos del jugador.

**Datos disponibles para el cómputo:**
- `Partida.fecha` y `Partida.fecha_fin` → duración, hora del día
- `Partida.modalidad` → bola8 / bola9
- `Partida.ganador_equipo` + `PartidaJugador.equipo` → si ganó o perdió
- `Turno.bolas_metidas_json` → bolas metidas por turno
- `Turno.falta_id` + `faltas_ids_json` → faltas del turno
- `Turno.numero` → detectar break (numero=1)
- `TorneoJugador` + `TorneoEnfrentamiento` → torneos ganados

**Notas de cómputo por logro complejo:**

- **En racha**: recorrer partidas ordenadas por fecha, contar racha máxima de victorias consecutivas.
- **Verdugo**: para cada rival, recorrer partidas contra ese rival y buscar 3 victorias seguidas.
- **Revancha**: buscar en partidas contra cada rival si existe la secuencia derrota→victoria consecutiva.
- **Barrida**: para una partida ganada, verificar que en los turnos del rival no hay bolas de su grupo metidas. Requiere saber el grupo del rival (`Partida.equipo{X}_grupo`).
- **Tirador**: para cada partida ganada, calcular `sum(bolas_metidas por turno del jugador) / count(turnos del jugador)`.
- **Intocable**: contar victorias donde en ningún turno del jugador en esa partida hay `falta_id` o `faltas_ids_json` no vacío.
- **Golden Break**: buscar turnos con `numero=1` del jugador donde `8 in bolas_metidas` y la partida fue ganada por su equipo.
- **Nervios**: buscar partidas perdidas donde el último turno del jugador tiene `8 in bolas_metidas` y había bolas pendientes de su grupo (i.e., `pierde_partida` por bola8 ilegal — se puede detectar por la falta o por el estado de la partida).
- **Torpón**: buscar partidas perdidas donde la causa fue tres faltas consecutivas del equipo del jugador.

---

## Arquitectura frontend

### Nueva página: `frontend/src/pages/Logros.jsx`

Ruta: `/logros`

Layout:
- Header con título y subtítulo
- Selector de jugador (tabs o dropdown) — por defecto sin filtro (catálogo global)
- Con jugador seleccionado: muestra todos los logros, los desbloqueados destacados, los bloqueados en gris
- Para logros con niveles: muestra badges de nivel con estado (desbloqueado / bloqueado)

### Sección en `JugadorCard` (en `Jugadores.jsx`)

Dentro del panel expandido de cada jugador, añadir sección "Logros" al final.
- Solo muestra los logros **desbloqueados** del jugador
- Si tiene 0: mensaje "Sin logros aún"
- Para logros nivelados: muestra el nivel más alto alcanzado

### Navegación

Añadir "Logros" al menú de navegación principal junto a Estadísticas y Reglas.

---

## Modelos de respuesta

```python
class NivelLogro(BaseModel):
    nivel: str      # "bronce" | "plata" | "oro" | "platino"
    emoji: str      # "🥉" | "🥈" | "🥇" | "💎"
    umbral: int     # número requerido

class LogroCatalogo(BaseModel):
    id: str                      # slug, e.g. "primera_partida"
    nombre: str
    descripcion: str
    icono: str                   # emoji
    niveles: list[NivelLogro]    # vacío si no tiene niveles

class LogroEstado(LogroCatalogo):
    desbloqueado: bool
    nivel_actual: str | None     # solo para nivelados: nivel más alto alcanzado
    niveles_desbloqueados: list[str]  # ["bronce", "plata"] si tiene ≥25 victorias
```

---

## Consideraciones

- **Sin nueva tabla**: todo computation on-demand. Para la escala de uso (pocos jugadores, cientos de partidas) es suficiente.
- **Retroactivo**: funciona con datos históricos existentes sin migración.
- **Relámpago y Maratoniano**: requieren `Partida.fecha_fin` no nulo. Partidas sin `fecha_fin` (interrupted / old data) se excluyen de estos logros.
- **Barrida en Bola 9**: no aplica (no hay grupos). Solo para Bola 8.
- **Limpio**: solo para Bola 8 (en Bola 9 no hay concepto de "sin faltas" del mismo modo).
- **Golden Break**: solo para Bola 8.
- **Blue balls**: solo para Bola 8. Cómputo: reconstruir bolas pendientes por equipo turno a turno. Detectar el primer turno donde ambos equipos tienen 0 bolas de grupo pendientes. A partir de ahí, contar turnos consecutivos donde la 8 no está en `bolas_metidas` y la partida no termina. Si ≥3 → ambos jugadores de esa partida lo desbloquean.
