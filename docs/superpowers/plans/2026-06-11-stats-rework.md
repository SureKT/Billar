# Rework de Estadísticas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestructurar la pantalla de Stats en jerarquía de 3 niveles (podio → leaderboard/récords → tendencias) eliminando las 5 gráficas duplicadas, la sección Faltas, "Partidas por mes" y la nav de secciones.

**Architecture:** Todo es frontend; cero cambios backend. Un componente nuevo (`Podio.jsx`) + edición quirúrgica de `Estadisticas.jsx` (bloques y renders) + mejora de `TablaComparativa` (líder por columna). Los datos ya existen en `rankingFiltrado`/`stats`.

**Tech Stack:** React + estilos inline (patrón del proyecto), helpers de `StatPrimitives` (`winrate`, `pct`, `colorJugador`).

**Spec:** `docs/superpowers/specs/2026-06-11-stats-rework-design.md`

**Estado actual relevante (líneas verificadas en `frontend/src/pages/Estadisticas.jsx`):**
- 93-103: `COLS` de TablaComparativa · 119-260: `TablaComparativa`
- 335-342: `SECCIONES` (nav a eliminar)
- 466-505: consts `grafBolas/grafEficiencia/grafDuracion/grafBreak/grafBolasPartida` (a eliminar)
- 513-529: `actividadMensual` (a eliminar)
- 566-608: `tilesPrincipales`/`tilesSecundarios`/`bloqueResumen` (degradar a línea)
- 610-680: `bloqueRecords` (compactar + card falta típica)
- 682-697: `graficasJugador` (eliminar) y `graficasTemporales` (quitar 'Partidas por mes')
- 699-717: `bloqueFaltas` (eliminar)
- 719-734: `bloqueRanking` (promover)
- 745-852: render desktop · 854-911: render móvil
- `GraficaHorizontal` (líneas 21-89) queda sin usos tras la poda → eliminar; import `BarrasVerticales` también.

---

### Task 1: Componente Podio

**Files:**
- Create: `frontend/src/components/stats/Podio.jsx`

- [x] **Step 1: Crear el componente**

```jsx
import { winrate, colorJugador } from './StatPrimitives'

const MEDALLAS = ['🥇', '🥈', '🥉']

// Podio: responde "¿quién va ganando?" de un vistazo.
// jugadores: stats ya filtrados (≥1 partida); se exigen ≥2 jugadas para rankear.
export default function Podio({ jugadores, idxJugador }) {
  const ranked = [...jugadores]
    .filter(j => j.partidas_jugadas >= 2)
    .sort((a, b) => winrate(b) - winrate(a))

  if (ranked.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }} className="hide-scrollbar">
      {ranked.map((j, i) => {
        const lider = i === 0
        const wr = Math.round(winrate(j))
        const color = colorJugador(j, idxJugador?.get(j.id) ?? i)
        return (
          <div key={j.id} style={{
            flex: '1 0 110px', minWidth: 110, maxWidth: 180,
            padding: '12px 10px', borderRadius: 12, textAlign: 'center',
            background: lider ? 'var(--accent-bg)' : 'var(--surface)',
            border: lider ? '1px solid var(--accent)' : '1px solid var(--border)',
          }}>
            <div style={{
              fontSize: lider ? 30 : 24, fontWeight: 800, lineHeight: 1.1,
              color: lider ? 'var(--accent)' : 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {wr}%
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              marginTop: 4, minWidth: 0,
            }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{MEDALLAS[i] ?? `${i + 1}º`}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{j.nombre}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
              {j.partidas_ganadas}/{j.partidas_jugadas}
              {j.racha_actual !== 0 && (
                <span style={{
                  marginLeft: 5, fontWeight: 700,
                  color: j.racha_actual > 0 ? '#86efac' : '#fca5a5',
                }}>
                  {j.racha_actual > 0 ? `▲${j.racha_actual}` : `▼${Math.abs(j.racha_actual)}`}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [x] **Step 2: Build para validar sintaxis**

Run: `cd frontend; npm run build`
Expected: build OK (componente aún sin usar — solo valida que compila).

- [x] **Step 3: Commit**

```bash
git add frontend/src/components/stats/Podio.jsx
git commit -m "feat(stats): componente Podio con win rate como hero number"
```

---

### Task 2: Reestructurar bloques de Estadisticas.jsx

**Files:**
- Modify: `frontend/src/pages/Estadisticas.jsx`

- [x] **Step 1: Import de Podio y limpieza de imports**

En la cabecera (líneas 1-13): añadir `import Podio from '../components/stats/Podio'` y eliminar `import BarrasVerticales from '../components/stats/BarrasVerticales'`.

- [x] **Step 2: Eliminar `GraficaHorizontal` (líneas 19-89) y `SECCIONES` (líneas 335-342)**

Borrar la función `GraficaHorizontal` completa y la const `SECCIONES`.

- [x] **Step 3: Eliminar consts de gráficas muertas**

Borrar `grafBolas`, `grafEficiencia`, `grafDuracion`, `grafBreak`, `grafBolasPartida` (472-505) y `actividadMensual` (513-529). Conservar `idxJugador`, `cj`, `finalizadasHist`, `sesionesHist`, `evolucionSeries`, `faltasOrdenadas`, `faltaField`.

- [x] **Step 4: Sustituir `tilesPrincipales`/`tilesSecundarios`/`bloqueResumen` por podio + línea KPI**

Reemplazar las líneas 566-608 por:

```jsx
  const bloquePodio = (
    <Podio jugadores={rankingFiltrado} idxJugador={idxJugador} />
  )

  // KPIs globales degradados a una línea de contexto — el podio es el protagonista
  const kpi = (label, value, color) => (
    <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 700, color: color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</span> {label}
    </span>
  )
  const lineaKpis = (
    <div style={{
      display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
      padding: '8px 12px', borderRadius: 10, background: 'var(--surface)',
      border: '1px solid var(--border)',
    }}>
      {kpi('partidas', todasFiltradas.length)}
      {kpi('finalizadas', finalizadasFiltradas.length, '#86efac')}
      {enCursoFiltradas.length > 0 && kpi('en curso', enCursoFiltradas.length, '#fbbf24')}
      {filtro === 'todas' && kpi('bola 8', bola8.length)}
      {filtro === 'todas' && kpi('bola 9', bola9.length)}
      {duracionMedia != null && kpi('media', duracionMedia.str, '#c4b5fd')}
      {faltasPorPartida != null && kpi('faltas/partida', faltasPorPartida, '#fb923c')}
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>
        {(stats ?? []).length} jugadores{tiempoActivo ? ` · ${periodoLabel}` : ''}
      </span>
    </div>
  )
```

- [x] **Step 5: Compactar Récords + card "Falta más típica"**

En `bloqueRecords` (ahora ~610): cambiar `minmax(250px, 1fr)` por `minmax(210px, 1fr)`, y añadir tras la card `masLenta`:

```jsx
        {faltasOrdenadas.length > 0 && (
          <RecordCard emoji="⚠️" titulo="Falta más típica"
            nombre={faltasOrdenadas[0].nombre}
            valor={`${faltasOrdenadas[0][faltaField] ?? 0} veces`}
          />
        )}
```

- [x] **Step 6: Podar `graficasJugador`, `graficasTemporales` y `bloqueFaltas`**

Borrar la const `graficasJugador` entera y `bloqueFaltas` entero. En `graficasTemporales` quitar la línea de `actividadMensual` ('Partidas por mes'), dejando solo:

```jsx
  const graficasTemporales = [
    sesionesHist.length > 1     && { titulo: 'Victorias por sesión', nodo: <SesionesChart sesiones={sesionesHist} jugadores={stats ?? []} /> },
    evolucionSeries.length > 0  && {
      titulo: 'Evolución win rate',
      nodo: <LineChart series={evolucionSeries} viewW={desktop ? 1000 : 380} />,
    },
  ].filter(Boolean)
```

(Nota: se elimina `ancho: true` — ahora van lado a lado.)

- [x] **Step 7: Retitular `bloqueRanking` a Leaderboard**

En `bloqueRanking`, cambiar el `<p>` del título: `Ranking` → `Leaderboard`.

- [x] **Step 8: Render desktop nuevo**

Reemplazar el bloque `if (desktop) { ... }` completo por (sin nav de secciones, orden podio → KPIs → leaderboard → récords → tendencias):

```jsx
  // ─── Desktop: cabecera sticky (título + filtros) sobre el dashboard ───
  if (desktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'var(--bg)', padding: '8px 0 10px',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <h2 style={{ fontSize: '20px', margin: 0 }}>Estadísticas</h2>
            <button
              onClick={() => navigate('/tv')}
              style={{
                padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(255,255,255,.06)', border: '1px solid var(--border)',
                color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}
            >📺 TV</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {MODALIDADES.map(m => (
              <Chip key={m.value} label={m.label} activo={filtro === m.value} onClick={() => setFiltro(m.value)} />
            ))}
            <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0, margin: '0 4px' }} />
            {PERIODOS.map(t => (
              <Chip key={t.value} label={t.label} activo={tiempo === t.value} onClick={() => setTiempo(t.value)} />
            ))}
          </div>
        </div>

        <main style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', minWidth: 0 }}>
          {sinDatos ? vacio : (
            <>
              {bloquePodio}
              {lineaKpis}
              {bloqueRanking}
              {bloqueRecords}
              {graficasTemporales.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 'var(--gap)' }}>
                  {graficasTemporales.map(g => (
                    <div key={g.titulo} className="card" style={{ padding: '12px', minWidth: 0 }}>
                      <SeccionTitulo>{g.titulo}</SeccionTitulo>
                      {g.nodo}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    )
  }
```

- [x] **Step 9: Render móvil nuevo**

En el return móvil, reemplazar el bloque `{sinDatos ? vacio : (...)}` por el mismo orden:

```jsx
      {sinDatos ? vacio : (
        <>
          {bloquePodio}
          {lineaKpis}
          {bloqueRanking}
          {bloqueRecords}
          {graficasTemporales.map(g => (
            <div key={g.titulo} className="card" style={{ padding: '12px' }}>
              <SeccionTitulo>{g.titulo}</SeccionTitulo>
              {g.nodo}
            </div>
          ))}
        </>
      )}
```

(El header sticky móvil con título/TV/modalidad y la fila de periodos no cambian.)

- [x] **Step 10: Build**

Run: `cd frontend; npm run build`
Expected: build OK. Si falla por variables sin usar o imports rotos, resolver (StatTile puede quedar sin uso → quitar del import de StatPrimitives si es el caso).

- [x] **Step 11: Commit**

```bash
git add frontend/src/pages/Estadisticas.jsx
git commit -m "feat(stats): jerarquia de 3 niveles — podio, leaderboard central, poda de duplicados"
```

---

### Task 3: Líder por columna en TablaComparativa

**Files:**
- Modify: `frontend/src/pages/Estadisticas.jsx` (COLS ~93-103 y render de celdas en TablaComparativa)

- [x] **Step 1: Marcar dirección "mejor" en COLS**

```jsx
const COLS = [
  { key: 'pj',      head: 'PJ',     grupo: 'fijo',  get: j => j.partidas_jugadas,    fmt: v => v },
  { key: 'winrate', head: 'Win%',   grupo: 'fijo',  mejor: 'max' }, // render especial (barra)
  { key: 'bolas',   head: 'Bolas',  grupo: 'fijo',  get: j => j.bolas_metidas,       fmt: v => v,            mejor: 'max' },
  { key: 'racha',   head: 'Racha',  grupo: 'fijo',  mejor: 'max' }, // render especial
  { key: 'bpt',     head: 'B/T',    grupo: 'nuevo', get: j => j.bolas_por_turno,     fmt: v => v.toFixed(2), mejor: 'max' },
  { key: 'bpp',     head: 'B/P',    grupo: 'nuevo', get: j => j.bolas_por_partida,   fmt: v => v.toFixed(1), mejor: 'max' },
  { key: 'break',   head: 'Break%', grupo: 'nuevo', get: j => j.break_con_bola_pct,  fmt: v => `${Math.round(v)}%`, mejor: 'max' },
  { key: 'fpp',     head: 'F/P',    grupo: 'nuevo', get: j => j.faltas_por_partida,  fmt: v => v.toFixed(1), mejor: 'min' },
  { key: 'mbt',     head: 'MaxB',  grupo: 'nuevo', get: j => j.max_bolas_turno,     fmt: v => v,            mejor: 'max' },
]
```

(`pj` sin `mejor`: jugar más no es "mejor".)

- [x] **Step 2: Calcular líder por columna dentro de TablaComparativa**

Tras el cálculo de `filas`, añadir:

```jsx
  // Mejor valor por columna (sortVal cubre también winrate y racha)
  const lideres = {}
  for (const col of COLS) {
    if (!col.mejor || filas.length < 2) continue
    const vals = filas.map(j => sortVal(j, col.key))
    lideres[col.key] = col.mejor === 'max' ? Math.max(...vals) : Math.min(...vals)
  }
  const esLider = (j, key) => lideres[key] !== undefined && sortVal(j, key) === lideres[key]
```

- [x] **Step 3: Destacar la celda líder en el render**

En el render de celdas con `col.get` (las columnas genéricas), aplicar al `<td>` cuando `esLider(j, col.key)`:

```jsx
color: '#86efac', fontWeight: 800
```

(Las columnas de render especial `winrate` y `racha` ya destacan por sí mismas con barra/colores — no tocar.)

- [x] **Step 4: Build + commit**

Run: `cd frontend; npm run build` → OK.

```bash
git add frontend/src/pages/Estadisticas.jsx
git commit -m "feat(stats): mejor celda por columna destacada en la leaderboard"
```

---

### Task 4: Verificación integral y deploy

- [x] **Step 1: Suite backend** (no debe verse afectada)

Run: `python -m pytest -q`
Expected: 129 passed.

- [x] **Step 2: Deploy**

```bash
git push origin main
ssh hub "cd /srv/billar/src && git pull --ff-only && cd ~/homelab/docker-compose/billar && docker compose up -d --build"
curl -s -o /dev/null -w '%{http_code}' http://100.73.48.106:8020/   # → 200
```

- [x] **Step 3: Verificación visual en server**

- Desktop 1920 y 1280: podio arriba con líder acentuado, línea KPI, leaderboard con líderes en verde, récords compactos (incluida "Falta más típica"), 2 tendencias lado a lado. Sin nav de secciones. Sin las 5 barras ni Faltas ni Partidas por mes.
- Cambiar filtros modalidad/periodo: podio y leaderboard se actualizan; URL refleja estado.
- Móvil 390: mismos bloques apilados, podio scrolleable horizontal.

- [x] **Step 4: Actualizar stats-backlog si procede y commit final de retoques**

```bash
git add -A
git commit -m "fix(stats): retoques de la pasada visual del rework"
```
