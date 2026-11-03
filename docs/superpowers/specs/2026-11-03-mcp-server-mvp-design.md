# Servidor MCP de Billar — MVP

Fecha: 2026-11-03 · Estado: borrador pendiente de aprobación

## Por qué

Gerard tiene procesos abiertos (eXperience IT, Raona) donde MCP, skills y tools son requisito.
Necesita un servidor MCP propio, funcionando y defendible en entrevista, en 1-3 días. Billar es
el banco de pruebas: datos sin sensibilidad, SQL rica y una pregunta real que la app no
responde hoy: **"¿quién es el jugador más consistente y quién el más inconsistente?"**.

La refactorización a capa de servicios (ports & adapters) **no** entra aquí; va después
(Fase 3 del plan de desarrollo).

## Objetivos

- 3 tools de solo lectura, expuestas por stdio, usables desde Claude Code.
- Métrica de consistencia determinista, definida en el servidor y testeada. Claude la
  interpreta; no la inventa cada vez.
- Tests con el cliente MCP en memoria del SDK (sin subprocesos ni red).
- README con 3 decisiones argumentadas: tool vs resource, solo lectura, stdio.

## No-objetivos

- Capa de servicios, tools de escritura, HTTP/OAuth, resources o prompts MCP.
- Cambios en la API REST o el frontend.
- GIF de demo: lo graba Gerard cuando funcione (fuera del código).

## Anti-objetivos

- Que el servidor MCP pueda modificar la DB canónica del server, aunque sea por error.
- Tools "de tabla" (`ejecutar_sql`, `listar_turnos`) que obliguen a Claude a calcular.
- Que las cifras del MCP difieran de las de la app para la misma pregunta.

## Diseño

### Ubicación y arranque

- `app/mcp_server.py`: servidor con `FastMCP` del SDK oficial (`mcp` en `requirements.txt`).
  Arranque: `python -m app.mcp_server` (stdio).
- Factoría `crear_servidor(engine) -> FastMCP`: los tests inyectan un engine en memoria; el
  `__main__` crea el engine de solo lectura (abajo).
- `app/consistencia.py`: la métrica como **función pura** sobre listas de números, sin
  SQLModel. Es la primera pieza de lo que luego será la capa de servicios.
- El ranking y las stats de jugador reutilizan `_calcular_stats` de
  `app/routers/jugadores.py` tal cual. Importar una función privada de un router es deuda
  consciente: se documenta en el README y desaparece al extraer servicios. Ventaja inmediata:
  mismas cifras que la app.

### Solo lectura, en dos capas

1. Ninguna tool escribe (diseño de la superficie).
2. El engine del MCP abre SQLite en modo `ro` por URI
   (`sqlite:///file:{ruta}?mode=ro&uri=true`) y **no** llama a `init_db()` (no crea tablas,
   no migra, no siembra). Si una tool intentase escribir, SQLite lo rechaza.

### Tools

Todas aceptan `modalidad: "bola8" | "bola9" | None` (None = ambas). Jugadores inactivos
excluidos. Los jugadores se identifican por **nombre** (sin distinguir mayúsculas), porque
es lo que el usuario escribe; si no existe, error MCP (`isError`) con la lista de nombres
válidos para que Claude se corrija solo.

| Tool | Entrada | Salida (estructurada) |
|---|---|---|
| `ranking_jugadores` | `criterio`: `win_rate` \| `bolas_por_turno` \| `partidas_ganadas`; `modalidad`; `min_partidas` (def. 5) | lista ordenada: posición, nombre, valor, partidas jugadas; jugadores bajo el mínimo aparte |
| `stats_jugador` | `nombre`; `modalidad` | subconjunto de `JugadorStats` útil para conversar: partidas, win rate, bolas/turno, bolas/partida, rachas (actual, mejor, peor), break, faltas/partida, falta más frecuente, histograma bolas/turno |
| `consistencia_jugadores` | `modalidad` | por jugador: CV, media y desviación de bolas/turno, nº de partidas usadas; ordenado de más a menos consistente; jugadores con datos insuficientes aparte. Incluye la definición de la métrica en texto |

Las descripciones de cada tool (lo que lee el modelo) dicen qué responde, cuándo usarla y
qué significan los números — son parte del diseño, no relleno.

### Métrica de consistencia (propuesta, pendiente de validar)

**Consistencia = coeficiente de variación (CV) de las bolas por turno partida a partida.**

1. Por cada partida finalizada del jugador con **≥ 3 turnos suyos**: `bolas_por_turno =
   bolas metidas (sin blanca) / turnos`.
2. `CV = desviación típica poblacional / media` de esos valores.
3. Menor CV = más consistente. Se requieren **≥ 8 partidas válidas**; si no, "datos
   insuficientes" (sin CV).
4. Media 0 → sin CV (no se divide por cero).

Por qué así:

- **Partida y no sesión:** con los datos reales (86 partidas, 17 sesiones) cada jugador tiene
  23-30 partidas pero solo 3-9 sesiones con volumen; un CV sobre 6 puntos es ruido.
- **CV y no desviación absoluta:** normaliza por nivel. Sin eso, quien mete más tiene más
  margen para variar y sale "irregular" por ser bueno.
- **Bolas por turno y no win rate:** el win rate depende del rival y del compañero; las
  bolas por turno son lo más propio del jugador que guarda la app.
- **≥ 3 turnos:** una partida de 1-2 turnos da 0.0 o 1.0 y dispara la varianza sin decir nada.

Limitaciones conocidas (van en la respuesta de la tool y en el README): el CV penaliza algo
más a medias bajas; no ve la dificultad del tiro; mide variación entre partidas, no dentro de
una noche.

Con datos reales hoy (bolas/turno; jugadores activos):

| Jugador | Partidas válidas | Media | CV |
|---|---|---|---|
| Gerard | 30 | 0.56 | 0.27 |
| Pau | 24 | 0.35 | 0.29 |
| Stasik | 26 | 0.48 | 0.34 |
| Patri | 23 | 0.34 | 0.42 |
| Rita | 7 | 0.38 | insuficiente |

(Cálculo exploratorio previo; los números exactos los dará la tool.)

### Conexión con Claude Code

- Producción (DB canónica en el server): `.mcp.json` del proyecto con
  `ssh hub docker exec -i billar-billar-1 python -m app.mcp_server`. Requiere reconstruir la
  imagen con `mcp` instalado. Sin puertos nuevos, sin OAuth: el canal lo protegen SSH y
  Tailscale.
- Desarrollo local: mismo módulo contra el `billar.db` local (`DATABASE_URL`).
- El servidor no escribe nada en stdout salvo el protocolo (logs a stderr).

### Tests (`tests/test_mcp_server.py`, `tests/test_consistencia.py`)

- Métrica pura: casos a mano (valores constantes → CV 0; serie conocida → CV exacto; media 0;
  < 8 partidas; filtro de ≥ 3 turnos).
- Servidor vía cliente MCP en memoria del SDK sobre la DB de test de `conftest.py`:
  `list_tools` devuelve las 3 con sus esquemas; cada tool con datos sembrados; jugador
  inexistente → `isError` con nombres válidos; filtro de modalidad; prueba de que el engine
  `ro` rechaza una escritura.

### README

Sección "Servidor MCP" en `README.md`: qué hace, cómo conectarlo, y las 3 decisiones:

1. **Tool vs resource:** las preguntas son parametrizadas y calculadas (filtros, ranking);
   un resource es contenido direccionable que elige la app cliente, no el modelo. Las tools
   las invoca el modelo cuando las necesita.
2. **Solo lectura:** reduce el radio de impacto de un prompt injection o de un error del
   modelo a cero escrituras; se garantiza en la superficie y en la conexión (`mode=ro`).
   Escritura con confirmación humana queda como siguiente paso.
3. **stdio:** un solo usuario, red privada; SSH + Tailscale ya autentican y cifran. HTTP
   obligaría a exponer un puerto y montar OAuth sin ganar nada aquí.

## Decisiones tomadas por mí (revisables)

- Nombres de jugador en vez de IDs; error con lista de válidos.
- `_calcular_stats` reutilizada tal cual (deuda documentada).
- Umbrales: ≥ 3 turnos por partida, ≥ 8 partidas, `min_partidas = 5` en el ranking.
- `stats_jugador` devuelve un subconjunto curado, no las 30 claves de `JugadorStats`.

## Lo que queda al implementador

Forma exacta de los modelos de salida, textos de las descripciones, cómo encapsular el cliente
en memoria en una fixture, versión mínima del paquete `mcp`.
