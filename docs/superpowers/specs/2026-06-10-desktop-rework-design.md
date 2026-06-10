# Rework desktop — sidebar + anchos máximos por página

**Fecha:** 2026-06-10
**Estado:** aprobado por Gerard (dirección B: dos paneles contextuales + sidebar fijo)

## Problema

El contenedor salta de 480px (móvil) a 1400px (desktop ≥1024px), pero la mayoría
de páginas conservan su layout móvil de columna única. Los componentes se estiran
para llenar 1400px y la app se ve "estirada". Solo Inicio, Estadísticas,
NuevaPartida y Partida tienen lógica desktop parcial, y aun así con defectos
(ej.: el historial de Partida usa `1fr` y se infla a ~850px).

## Decisiones de diseño

1. **Dirección B — dos paneles contextuales.** Cada página define columna
   principal + panel secundario en desktop. Se recolocan componentes existentes;
   no se rediseñan internamente. Coherencia móvil/desktop intacta.
2. **Sidebar lateral fijo en desktop** (≥1024px), ~200px: logo arriba, secciones
   (Partidas, Nueva, Stats, Torneos, Jugadores, Logros, Reglas), TV abajo.
   En móvil se mantiene el nav horizontal actual sin cambios.
3. **Ancho máximo de contenido por página.** Regla anti-estiramiento central:
   ninguna página hereda 1400px por defecto. El espacio sobrante muere en
   márgenes (contenido centrado), nunca estirando componentes.

## Shell global

- `Nav.jsx` renderiza dos variantes según `useMediaQuery('(min-width: 1024px)')`:
  - Móvil: nav horizontal sticky actual (intacto, incluida compactación al scroll).
  - Desktop: sidebar fijo a la izquierda, altura completa. El `<main>` ocupa el
    resto (`margin-left` o layout flex en `App.jsx`).
- El contenedor global pierde el `max-width: 1400px` como techo único; cada
  página fija el suyo mediante un wrapper.

## Tratamiento por página

| Página | Ancho máx | Layout desktop |
|---|---|---|
| Partida | ~1000px | Columna acción `minmax(440px, 540px)` (equipos + formulario) + historial **capped ~400px** (hoy `1fr`). Conjunto centrado. |
| Inicio | ~1100px | Lista de partidas (filas densas actuales) + panel derecho fijo con marcador de la noche / resumen de sesión siempre visibles. |
| Jugadores | ~1100px | Cards actuales en grid de 2-3 columnas (card ~340px). Sección "Nombres de equipo" igual, a ancho completo del contenido. |
| Logros | ~1100px | Grid de cards 2-3 columnas, mismas cards. |
| Reglas | ~960px | Índice sticky a la izquierda (secciones: break, grupos, faltas…) + texto a ~720px. |
| NuevaPartida | ~900px | Modalidad arriba, equipo 1 y equipo 2 en dos columnas, CTA crear abajo. |
| Estadísticas | sin cambios | Ya tiene dashboard desktop propio; solo hereda sidebar. |
| Torneos / TorneoDetalle | sin cambios | Solo heredan sidebar y un ancho máximo razonable (~1100px) sin rediseño. |
| TV | sin cambios | Pantalla completa, fuera del shell. |

## Implementación — restricciones

- Sin librerías nuevas. CSS grid/flex inline (patrón actual) + `useMediaQuery`
  existente.
- Componentes (`BolasEquipo`, `FormularioTurno`, `HistorialTurnos`, cards de
  jugador/logro, filas de Inicio) **no cambian internamente** — solo su
  disposición/contención.
- Breakpoint único: 1024px (el ya usado en `index.css` y `useMediaQuery`).
- Móvil: cero regresiones. Todo cambio desktop va detrás del media query.

## Casos límite

- Anchos intermedios (1024-1200px): los grids de cards usan
  `repeat(auto-fill, minmax(320px, 1fr))` para degradar de 3 a 2 columnas.
- Inicio sin sesión activa hoy: el panel derecho muestra el resumen de la última
  sesión; si no hay datos, se oculta y la lista ocupa el ancho completo.
- Reglas en 1024px justos: si no cabe índice + 720px, el índice colapsa a
  enlaces horizontales sobre el texto.

## Verificación

- Revisión visual manual en 1024px, 1280px y 1920px por página.
- Móvil (≤480px) inalterado: comparación visual antes/después.
- `npm run build` sin errores.
