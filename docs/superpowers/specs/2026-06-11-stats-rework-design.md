# Rework de Estadísticas — jerarquía de 3 niveles sin duplicación

**Fecha:** 2026-06-11
**Estado:** aprobado por Gerard

## Problema

La pantalla de Stats exige leer mucho texto para saber qué se está viendo y repite
la misma información: 5 gráficas de barras horizontales idénticas (bolas por jugador,
eficiencia, duración media, break %, bolas por partida) más la tabla Ranking pintan
6 veces la misma matriz jugador×métrica. Sin jerarquía visual: todas las cards tienen
el mismo peso y el título pequeño arriba obliga a leer antes de entender.

## Referencias analizadas

- **FotMob / Sofascore** (apps deportivas): líder de cada categoría con número grande
  y foto; la lista completa solo al expandir. Leaderboard central como vista principal.
- **Guías de dashboard** (DataCamp, Setproduct, Pencil & Paper): hero number primero y
  etiqueta después; jerarquía de 3 niveles (status → comparación → detalle); gráfica
  solo cuando la pregunta es temporal o de distribución, nunca "por variedad".

La pregunta que la pantalla debe responder en 3 segundos (decidido): **"¿quién va ganando?"**

## Diseño — 4 bloques en 3 niveles

### Nivel 1 · Podio + KPIs (status)

- **Podio**: jugadores activos con ≥2 partidas en el filtro activo, ordenados por win
  rate. Card por jugador: win rate como hero number (grande), medalla 🥇🥈🥉 por posición,
  nombre, racha actual inline (▲N/▼N). El 1º destacado con borde y fondo de acento
  (mismo tamaño de card que el resto — la jerarquía la da el color, no el layout).
- **KPIs globales**: los 8 tiles actuales (partidas, finalizadas, en curso, jugadores,
  bola8/9, duración media, faltas) se degradan a **una línea compacta** de texto/mini-chips
  bajo el podio. Contexto, no protagonista.

### Nivel 2 · Leaderboard + Récords (comparación)

- **Leaderboard**: la `TablaComparativa` existente promovida de "Ranking" (última sección)
  a pieza central. Única fuente jugador×métrica. Mejora nueva: la mejor celda de cada
  columna destacada (color/peso). Conserva orden por columnas, columna sticky y scroll
  horizontal móvil.
- **Récords**: las `RecordCard` actuales en formato compacto (grid denso o fila con
  scroll horizontal). Se añade una card "Falta más típica" (la falta más frecuente
  global) para no perder ese dato al eliminar la sección Faltas.

### Nivel 3 · Tendencias (temporal)

- **Evolución win rate** (LineChart) y **Victorias por sesión** (SesionesChart),
  lado a lado en desktop, apiladas en móvil. Únicas gráficas que sobreviven — son
  las únicas genuinamente temporales.

### Eliminado

- Las 5 gráficas de barras horizontales (absorbidas por la leaderboard).
- Sección "Faltas más frecuentes" (columna F/P en leaderboard + card en Récords).
- Gráfica "Partidas por mes" (2 meses de datos, aporta poco).
- **Nav de secciones del header** (Resumen/Actividad/…): la página queda en ~2
  pantallas de scroll, no necesita índice. El header sticky conserva título, botón TV
  y filtros modalidad/periodo en una sola fila.

## Comportamiento

- Filtros modalidad (todas/bola8/bola9) y periodo (siempre/sesión/7d/30d) siguen
  aplicando a TODO (podio, leaderboard, récords, tendencias), con estado en la URL
  como ahora.
- Estados vacíos: sin partidas en el filtro → mensaje vacío actual. Podio oculta
  jugadores con <2 partidas; si ninguno cumple, el podio no se renderiza.
- Móvil: podio como fila horizontal scrolleable; mismos bloques en el mismo orden.

## Implementación — restricciones

- Reutilizar componentes existentes: `TablaComparativa`, `RecordCard`, `LineChart`,
  `SesionesChart`, `StatTile`/chips. El podio es el único componente nuevo.
- Sin librerías nuevas. Patrón de estilos inline actual.
- `Estadisticas.jsx` (~40 KB) ya es grande: extraer el podio a
  `components/stats/Podio.jsx` y, si el diff lo pide, mover `TablaComparativa` a su
  propio fichero. No refactorizar más allá de lo que toca esta pantalla.
- Breakpoint y zoom: los existentes (1024px, ancho efectivo ~1280 a 1920px).

## Verificación

- Visual en server a 1920/1280 (desktop) y 390 (móvil), con datos reales.
- Filtros: cambiar modalidad/periodo actualiza podio + leaderboard + tendencias.
- `npm run build` limpio y suite pytest verde (sin cambios backend esperados).
