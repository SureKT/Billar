# Spec — Dashboard desktop de Estadísticas

Fecha: 2026-06-10 · Estado: aprobado por delegación (el usuario delegó las decisiones de diseño)

## Objetivo

`/stats` deja de ser una columna móvil de 480px en pantallas grandes. En PC (siempre
disponible junto a la mesa de billar) muestra un dashboard denso y profesional con más
información y un filtro temporal. En móvil mantiene la versión actual, funcional y
compacta, ganando solo el filtro temporal.

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Estrategia | Responsive, misma ruta `/stats` | Un solo source of truth; sin duplicar navegación (opción A confirmada por el usuario) |
| Breakpoint | `1024px` | Por debajo: tablet/móvil usan layout actual |
| Ancho desktop | `#root` pasa a `1400px` solo en stats, vía clase `body.wide` | Otras páginas siguen a 480px — son flujos de móvil y no ganan nada ensanchándose |
| Navegación desktop | Sidebar in-page sticky (240px) con filtros + anclas de sección | Aspecto de software profesional sin reestructurar la nav global de la app |
| Contenido desktop | Grid multi-columna (`auto-fit, minmax(380px, 1fr)`) | Densidad funcional: el ancho se usa, no se desperdicia |
| Charts | Primitivas SVG propias en `components/stats/` | El bundle ya pesa 588KB; recharts añadiría ~100KB para 3 gráficas. Las barras actuales ya son custom y funcionan |
| Filtro temporal | Chips: Siempre · Última sesión · 7d · 30d | Cubre los casos reales (¿cómo fue la noche? ¿la semana? ¿el mes?) sin un date-picker que nadie usará en red doméstica |
| "Última sesión" | Mismo criterio que Inicio: partidas consecutivas con gap < 4h | Coherencia total — la sesión se define igual en toda la app |
| Backend | `desde`/`hasta` (ISO datetime) en `GET /api/jugadores/stats` | `_calcular_stats` ya filtra por modalidad; el filtro temporal entra en el mismo punto. Sin columnas nuevas |
| Faltas frecuentes con filtro temporal | Quedan globales con badge "histórico" | La frecuencia de faltas viene de `/faltas?jugadores=` sin noción de fecha; filtrarla requiere refactor backend que no compensa en v1 |

## Arquitectura

### Backend (1 cambio)

`GET /api/jugadores/stats?modalidad=&desde=&hasta=`

- `desde`/`hasta` opcionales, ISO 8601.
- En `_calcular_stats`: tras el filtro de modalidad, descarta `partida_ids` cuya
  `Partida.fecha` quede fuera del rango. Todo lo derivado (bolas, rachas, breaks,
  duraciones) hereda el filtro porque se computa sobre esos ids.
- Tests: rango que incluye/excluye partidas, combinación con modalidad, rango vacío.

### Frontend

**Nuevos módulos:**

- `hooks/useMediaQuery.js` — `useMediaQuery('(min-width: 1024px)')` con
  `matchMedia` + listener.
- `components/stats/LineChart.jsx` — SVG multi-serie (evolución win rate).
- `components/stats/BarrasMensuales.jsx` — SVG/divs, actividad por mes.
- `components/stats/MarcadorSesiones.jsx` — victorias por jugador en las últimas N sesiones.
- `utils/sesiones.js` — `agruparPorSesion` extraído de Inicio.jsx (se elimina la
  copia local; Inicio importa de aquí). Fuente única del criterio < 4h.

**Estadisticas.jsx:**

- `useMediaQuery` decide `desktop`.
- Desktop: `<div class="stats-desktop-grid">` con sidebar (filtros modalidad +
  tiempo, anclas: Resumen · Récords · Rendimiento · Actividad · Faltas · Ranking)
  y zona de contenido en grid. Las cards existentes se reutilizan tal cual —
  solo cambia su disposición.
- Móvil: stack actual + chips de tiempo junto a los de modalidad.
- `useEffect`: añade/quita `wide` en `document.body`.
- Filtro temporal: calcula `desde/hasta` (sesión → del primer al último timestamp
  de la sesión más reciente; 7d/30d → `now - N días`); lo pasa a `getAllStats`;
  filtra `partidas` client-side con el mismo rango para records/counts.

**index.css:**

```css
@media (min-width: 1024px) {
  body.wide #root { max-width: 1400px; }
}
```

**api/client.js:** `getAllStats(incluirInactivos, modalidad, desde, hasta)`.

### Gráficas nuevas (desktop, client-side desde `getPartidas`)

1. **Actividad por mes** — barras por mes (finalizadas), últimos 12 meses.
2. **Evolución win rate** — línea acumulada por jugador (partidas finalizadas en
   orden cronológico, win rate acumulado en cada punto). Top 6 jugadores por PJ.
3. **Marcador por sesión** — últimas 8 sesiones, victorias por jugador
   (reutiliza el cálculo del marcador de la noche).

`equipo1_jugadores`/`equipo2_jugadores` + `ganador_equipo` del listado de
partidas bastan — sin endpoints nuevos.

## Verificación

1. `pytest` (120 existentes + nuevos de desde/hasta).
2. `npm run build`.
3. Capturas Playwright a 1440×900 y 390×844 sobre uvicorn local con la DB real;
   iterar hasta que el desktop parezca un dashboard profesional y el móvil no
   haya cambiado salvo el chip de tiempo.

## Fuera de alcance (v1)

- Filtro temporal en frecuencia de faltas (requiere backend de faltas con fechas).
- Date-picker custom de rangos.
- Personalización de paneles (orden/visibilidad) — siguiente iteración si el
  dashboard base funciona.
- Tocar el acceso a TV (exclusión explícita del usuario).
