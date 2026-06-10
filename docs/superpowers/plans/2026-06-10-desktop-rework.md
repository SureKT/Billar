# Rework Desktop (sidebar + anchos por página) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sidebar de navegación fijo en desktop y ancho máximo de contenido por página, eliminando el efecto "layout móvil estirado a 1400px".

**Architecture:** El shell global pasa de nav horizontal + contenedor único de 1400px a: sidebar lateral (≥1024px) + `<main>` flexible donde cada página fija su propio ancho máximo centrado. Componentes internos no cambian — solo disposición y contención. Móvil queda intacto (todo detrás de `useMediaQuery('(min-width: 1024px)')` o media queries CSS).

**Tech Stack:** React 18 + Vite, estilos inline (patrón del proyecto), `useMediaQuery` existente. Sin librerías nuevas. Sin tests automatizados de UI en el proyecto — verificación = `npm run build` + revisión visual (móvil ≤480px, desktop 1280px/1920px).

**Spec:** `docs/superpowers/specs/2026-06-10-desktop-rework-design.md`

**Estado actual relevante (verificado):**
- `index.css:40-45` — `#root` salta a `max-width: 1400px` en ≥1024px. Causa raíz del estiramiento.
- `Nav.jsx` — solo variante horizontal; fija `--nav-height` (62/34px) según scroll. Fetch de `jugadores` muerto (no se usa).
- `Partida.jsx:467-470` — grid desktop `minmax(440px, 540px) 1fr`: el historial se infla a ~850px.
- `Inicio.jsx:283-300` — desktop ya tiene grid `320px 1fr` (aside + listado), pero hereda 1400px.
- `Jugadores.jsx:716` — sin tope de ancho; cards ya en grid `auto-fill minmax(360px, 1fr)`.
- `Logros.jsx:364` — ya capped a 900px; grid `auto-fill minmax(380px, 1fr)`.
- `Reglas.jsx:227` — capped a 800px; secciones en acordeón colapsado.
- Ya conformes, **no tocar**: `NuevaPartida.jsx` (960px centrado), `Torneos.jsx` (1100px), `TorneoDetalle.jsx` (760px), `Estadisticas.jsx` (dashboard propio), `TV.jsx`.

---

### Task 1: Shell — sidebar desktop

**Files:**
- Modify: `frontend/src/index.css:39-45`
- Modify: `frontend/src/components/Nav.jsx` (reescritura completa)
- Modify: `frontend/src/App.jsx:20`

- [ ] **Step 1: `index.css` — `#root` en fila a ancho completo en desktop**

Reemplazar el bloque de las líneas 39-45:

```css
/* Desktop: toda la app a ancho completo — cada página dispone sus bloques en grid */
@media (min-width: 1024px) {
  #root {
    max-width: 1400px;
    padding: 0 24px;
  }
}
```

por:

```css
/* Desktop: sidebar lateral + main flexible — cada página fija su ancho máximo */
@media (min-width: 1024px) {
  #root {
    max-width: none;
    flex-direction: row;
  }
}
```

- [ ] **Step 2: Reescribir `Nav.jsx` con dos variantes**

Contenido completo del fichero (sustituye al actual; elimina el fetch muerto de `jugadores`):

```jsx
import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useMediaQuery } from '../hooks/useMediaQuery'

const NAV_FULL    = 62  // px — icon container 20 + gap 2 + text 16 + pad 12+10 + border 1 ≈ 61
const NAV_COMPACT = 34  // px — icon container 20 + pad 6+6 + border 1 = 33

const LINKS = [
  { to: '/',          end: true,  icon: '🎱', label: 'Partidas' },
  { to: '/nueva',     end: false, icon: '＋', label: 'Nueva', destacado: true },
  { to: '/stats',     end: false, icon: '📊', label: 'Stats' },
  { to: '/torneos',   end: false, icon: '🏆', label: 'Torneos' },
  { to: '/jugadores', end: false, icon: '👤', label: 'Jugadores' },
  { to: '/logros',    end: false, icon: '🏅', label: 'Logros' },
]

export default function Nav() {
  const desktop = useMediaQuery('(min-width: 1024px)')
  return desktop ? <NavSidebar /> : <NavMovil />
}

// ── Desktop: sidebar lateral fijo ──────────────────────────────────────────────
function NavSidebar() {
  useEffect(() => {
    // Sin barra superior: los sticky de las páginas (top: var(--nav-height)) parten de 0
    document.documentElement.style.setProperty('--nav-height', '0px')
  }, [])

  const linkStyle = (isActive, destacado) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    fontSize: 14, fontWeight: 600,
    color: isActive ? 'var(--accent)' : destacado ? 'var(--text)' : 'var(--text-dim)',
    background: isActive ? 'var(--accent-bg)' : destacado ? 'rgba(6,182,212,.07)' : 'transparent',
    transition: 'background .15s, color .15s',
  })

  const icono = (emoji) => (
    <span style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>{emoji}</span>
  )

  return (
    <nav style={{
      width: 200, flexShrink: 0,
      position: 'sticky', top: 0, height: '100dvh', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '20px 12px',
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', marginBottom: 18 }}>
        <span style={{ fontSize: 20 }}>🎱</span>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.02em' }}>Billar</span>
      </div>
      {LINKS.map(l => (
        <NavLink key={l.to} to={l.to} end={l.end} style={({ isActive }) => linkStyle(isActive, l.destacado)}>
          {icono(l.icon)}
          {l.label}
        </NavLink>
      ))}
      <NavLink to="/reglas" style={({ isActive }) => linkStyle(isActive, false)}>
        {icono('📖')}
        Reglas
      </NavLink>
      <div style={{ flex: 1 }} />
      <NavLink to="/tv" style={({ isActive }) => linkStyle(isActive, false)}>
        {icono('📺')}
        Modo TV
      </NavLink>
    </nav>
  )
}

// ── Móvil: nav horizontal sticky con compactación al scroll (sin cambios) ──────
function NavMovil() {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    // sync --nav-height with initial state
    document.documentElement.style.setProperty('--nav-height', `${NAV_FULL}px`)

    let isCompact = false
    const onScroll = () => {
      const y = window.scrollY
      if (!isCompact && y > 60) {
        isCompact = true
        setCompact(true)
        document.documentElement.style.setProperty('--nav-height', `${NAV_COMPACT}px`)
      } else if (isCompact && y < 20) {
        isCompact = false
        setCompact(false)
        document.documentElement.style.setProperty('--nav-height', `${NAV_FULL}px`)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const linkBase = (isActive) => ({
    padding: compact ? '7px 0' : '12px 0 10px',
    flex: 1,
    textAlign: 'center',
    fontWeight: 600,
    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'color .15s, border-color .15s, padding .18s ease',
    letterSpacing: '.02em',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  })

  const textStyle = {
    fontSize: '13px',
    lineHeight: '13px',
    paddingBottom: '4px',          // room for descenders (g, j, y…)
    maxHeight: compact ? 0 : '18px',
    opacity: compact ? 0 : 1,
    overflow: 'hidden',
    transition: 'max-height .18s ease, opacity .15s ease',
    whiteSpace: 'nowrap',
  }

  const iconStyle = (size = '16px') => ({
    height: 20,
    display: 'flex',
    alignItems: 'center',
    fontSize: size,
    flexShrink: 0,
  })

  return (
    <nav style={{
      display: 'flex',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      transition: 'padding .3s ease',
    }}>
      <NavLink to="/" end style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle('18px')}>🎱</span>
        <span style={textStyle}>Partidas</span>
      </NavLink>
      <NavLink to="/nueva" style={({ isActive }) => ({
        ...linkBase(isActive),
        color: isActive ? 'var(--accent)' : 'var(--text)',
        background: 'rgba(6,182,212,.07)',
        borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
      })}>
        <span style={{ ...iconStyle('22px'), color: '#4ade80' }}>＋</span>
        <span style={textStyle}>Nueva</span>
      </NavLink>
      <NavLink to="/stats" style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle()}>📊</span>
        <span style={textStyle}>Stats</span>
      </NavLink>
      <NavLink to="/torneos" style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle()}>🏆</span>
        <span style={textStyle}>Torneos</span>
      </NavLink>
      <NavLink to="/jugadores" style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle()}>👤</span>
        <span style={textStyle}>Jugadores</span>
      </NavLink>
      <NavLink to="/logros" style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle()}>🏅</span>
        <span style={textStyle}>Logros</span>
      </NavLink>
    </nav>
  )
}
```

Nota: el `useApi(api.getJugadores)` del Nav actual es código muerto (no se usa en el render) — desaparece con la reescritura.

- [ ] **Step 3: `App.jsx` — `<main>` con `minWidth: 0`**

En `frontend/src/App.jsx:20`, cambiar:

```jsx
      <main style={{ flex: 1, padding: '16px', paddingBottom: '24px' }}>
```

por:

```jsx
      <main style={{ flex: 1, minWidth: 0, padding: '16px', paddingBottom: '24px' }}>
```

(`minWidth: 0` evita que contenido ancho —tablas, grids— desborde el flex item en el layout de fila.)

- [ ] **Step 4: Build**

Run: `cd frontend; npm run build`
Expected: build OK, sin errores.

- [ ] **Step 5: Verificación visual**

Con backend arrancado (`uvicorn app.main:app --host 0.0.0.0 --port 8000`), abrir `http://localhost:8000`:
- A 1280px: sidebar izquierda con logo, 7 enlaces y "Modo TV" abajo; sin barra superior; activo resaltado en cian.
- A 480px (devtools): nav horizontal idéntico al actual, compactación al scroll funciona.
- Navegar a Inicio: los sticky de filtros pegan arriba del todo (sin hueco de 62px).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/components/Nav.jsx frontend/src/App.jsx
git commit -m "feat(ui): sidebar de navegación fijo en desktop"
```

---

### Task 2: Partida — historial con tope, conjunto centrado

**Files:**
- Modify: `frontend/src/pages/Partida.jsx:309` y `frontend/src/pages/Partida.jsx:467-470`

- [ ] **Step 1: Wrapper de página con ancho máximo**

En `Partida.jsx:309`, cambiar:

```jsx
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
```

por:

```jsx
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--gap)',
      maxWidth: desktop ? 1000 : undefined, margin: desktop ? '0 auto' : undefined, width: '100%',
    }}>
```

(`desktop` ya existe en el componente, línea 16.)

- [ ] **Step 2: Grid con historial capped**

En `Partida.jsx:467-470`, cambiar:

```jsx
      <div style={desktop
        ? { display: 'grid', gridTemplateColumns: 'minmax(440px, 540px) 1fr', gap: 'var(--gap)', alignItems: 'start' }
        : { display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }
      }>
```

por:

```jsx
      <div style={desktop
        ? { display: 'grid', gridTemplateColumns: 'minmax(440px, 540px) minmax(320px, 400px)', gap: 'var(--gap)', alignItems: 'start', justifyContent: 'center' }
        : { display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }
      }>
```

- [ ] **Step 3: Build**

Run: `cd frontend; npm run build`
Expected: build OK.

- [ ] **Step 4: Verificación visual**

Abrir una partida en curso a 1280px y 1920px: historial ya no supera ~400px; bloque acción + historial centrados; en móvil, stack vertical intacto.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Partida.jsx
git commit -m "fix(partida): tope de ancho al historial y conjunto centrado en desktop"
```

---

### Task 3: Inicio — ancho máximo 1100px

**Files:**
- Modify: `frontend/src/pages/Inicio.jsx:285`

- [ ] **Step 1: Cap del grid desktop**

En `Inicio.jsx:285` (dentro del `if (desktop)`), cambiar:

```jsx
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
```

por:

```jsx
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
```

- [ ] **Step 2: Build + verificación visual**

Run: `cd frontend; npm run build`
Expected: build OK. A 1920px el conjunto aside+listado queda centrado a 1100px; filas de partida ya no ocupan ~1050px.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Inicio.jsx
git commit -m "fix(inicio): ancho máximo 1100px centrado en desktop"
```

---

### Task 4: Jugadores — ancho máximo 1100px

**Files:**
- Modify: `frontend/src/pages/Jugadores.jsx:716`

- [ ] **Step 1: Wrapper con tope**

En `Jugadores.jsx:716`, cambiar:

```jsx
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
```

por:

```jsx
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
```

(Sin condicional: en móvil el viewport ya es < 1100px, no afecta. El grid interno `auto-fill minmax(360px, 1fr)` pasa de 3 columnas anchas a 2-3 columnas de ~350-360px.)

- [ ] **Step 2: Build + verificación visual**

Run: `cd frontend; npm run build`
Expected: build OK. A 1920px: cards de jugador en 2-3 columnas compactas centradas; sticky de orden funciona pegado arriba.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Jugadores.jsx
git commit -m "fix(jugadores): ancho máximo 1100px centrado en desktop"
```

---

### Task 5: Logros — subir tope a 1100px

**Files:**
- Modify: `frontend/src/pages/Logros.jsx:364`

- [ ] **Step 1: Ajustar maxWidth**

En `Logros.jsx:364`, cambiar:

```jsx
    <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
```

por:

```jsx
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
```

(El grid interno `auto-fill minmax(380px, 1fr)` pasa de 2 columnas justas a 2 columnas holgadas en 1100px — coherente con Jugadores.)

- [ ] **Step 2: Build + verificación visual**

Run: `cd frontend; npm run build`
Expected: build OK. Logros en 2 columnas a 1100px, centrado.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Logros.jsx
git commit -m "fix(logros): tope a 1100px coherente con jugadores"
```

---

### Task 6: Reglas — índice lateral y secciones abiertas en desktop

**Files:**
- Modify: `frontend/src/pages/Reglas.jsx` (componentes `Seccion`, `ModoBola8`, `ModoBola9`, `Reglas`)

- [ ] **Step 1: `Seccion` con modo siempre-abierta e id ancla**

Cambiar el componente `Seccion` (líneas 4-26) a:

```jsx
function Seccion({ titulo, children, defaultOpen = false, siempreAbierta = false, id }) {
  const [open, setOpen] = useState(defaultOpen)
  const abierta = siempreAbierta || open
  return (
    <div id={id} style={{ borderBottom: '1px solid var(--border)', scrollMarginTop: 12 }}>
      <button
        onClick={() => !siempreAbierta && setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: siempreAbierta ? 'default' : 'pointer',
          padding: '13px 0', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{titulo}</span>
        {!siempreAbierta && (
          <span style={{ fontSize: 12, color: 'var(--text-dim)', transition: 'transform .15s', transform: abierta ? 'rotate(90deg)' : 'none' }}>▶</span>
        )}
      </button>
      {abierta && (
        <div style={{ paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `ModoBola8` y `ModoBola9` aceptan `abiertas` y propagan ids**

Cambiar las firmas a `function ModoBola8({ abiertas })` y `function ModoBola9({ abiertas })`. En cada `<Seccion>` añadir `siempreAbierta={abiertas}` y su `id`:

ModoBola8:
- `<Seccion id="objetivo" titulo="Objetivo" defaultOpen siempreAbierta={abiertas}>`
- `<Seccion id="saque" titulo="Saque (break)" siempreAbierta={abiertas}>`
- `<Seccion id="grupos" titulo="Asignación de grupos" siempreAbierta={abiertas}>`
- `<Seccion id="bola8" titulo="Bola 8" siempreAbierta={abiertas}>`
- `<Seccion id="faltas" titulo="Faltas" siempreAbierta={abiertas}>`
- `<Seccion id="tabla" titulo="Tabla de resultados" siempreAbierta={abiertas}>`

ModoBola9:
- `<Seccion id="objetivo" titulo="Objetivo" defaultOpen siempreAbierta={abiertas}>`
- `<Seccion id="saque" titulo="Saque (break)" siempreAbierta={abiertas}>`
- `<Seccion id="durante" titulo="Durante la partida" siempreAbierta={abiertas}>`
- `<Seccion id="respot" titulo="Bola 9 + blanca" siempreAbierta={abiertas}>`
- `<Seccion id="faltas" titulo="Faltas" siempreAbierta={abiertas}>`
- `<Seccion id="tabla" titulo="Tabla de resultados" siempreAbierta={abiertas}>`

- [ ] **Step 3: Layout desktop con índice sticky**

Sustituir el componente `Reglas` (líneas 221-256) por:

```jsx
const SECCIONES = {
  bola8: [
    ['objetivo', 'Objetivo'], ['saque', 'Saque (break)'], ['grupos', 'Asignación de grupos'],
    ['bola8', 'Bola 8'], ['faltas', 'Faltas'], ['tabla', 'Tabla de resultados'],
  ],
  bola9: [
    ['objetivo', 'Objetivo'], ['saque', 'Saque (break)'], ['durante', 'Durante la partida'],
    ['respot', 'Bola 9 + blanca'], ['faltas', 'Faltas'], ['tabla', 'Tabla de resultados'],
  ],
}

export default function Reglas() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [modo, setModo] = useState(searchParams.get('modo') === 'bola9' ? 'bola9' : 'bola8')
  const desktop = useMediaQuery('(min-width: 1024px)')

  const cabecera = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
        >←</button>
        <h2 style={{ fontSize: 20, margin: 0 }}>Reglas</h2>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[['bola8', '⚫ Bola 8'], ['bola9', '🟡 Bola 9']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setModo(val)}
            style={{
              flex: 1, padding: '10px',
              borderRadius: 8, fontSize: 14, fontWeight: 700,
              border: modo === val ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: modo === val ? 'rgba(6,182,212,.13)' : 'var(--surface2)',
              color: modo === val ? 'var(--accent)' : 'var(--text)',
              transition: 'all .15s',
            }}
          >{label}</button>
        ))}
      </div>
    </>
  )

  const contenido = modo === 'bola8' ? <ModoBola8 abiertas={desktop} /> : <ModoBola9 abiertas={desktop} />

  if (desktop) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 720px)', gap: 20, justifyContent: 'center', alignItems: 'start' }}>
        <aside style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', margin: '0 0 6px', padding: '0 10px' }}>
            Secciones
          </p>
          {SECCIONES[modo].map(([id, titulo]) => (
            <button
              key={id}
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                padding: '6px 10px', borderRadius: 6, fontSize: 13, color: 'var(--text-dim)',
              }}
              className="hoverable"
            >{titulo}</button>
          ))}
        </aside>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', minWidth: 0 }}>
          {cabecera}
          {contenido}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 800, margin: '0 auto', width: '100%' }}>
      {cabecera}
      {contenido}
    </div>
  )
}
```

Añadir el import al inicio del fichero:

```jsx
import { useMediaQuery } from '../hooks/useMediaQuery'
```

- [ ] **Step 4: Build + verificación visual**

Run: `cd frontend; npm run build`
Expected: build OK. Desktop: índice a la izquierda, todas las secciones abiertas sin chevron, click en índice hace scroll suave. Móvil: acordeón intacto a 800px max.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Reglas.jsx
git commit -m "feat(reglas): índice lateral y secciones abiertas en desktop"
```

---

### Task 7: Verificación final integral

- [ ] **Step 1: Build limpio**

Run: `cd frontend; npm run build`
Expected: sin errores ni warnings nuevos.

- [ ] **Step 2: Pasada visual completa**

Con backend en marcha, revisar a 1024px, 1280px y 1920px: Inicio, NuevaPartida, Partida (en curso y finalizada), Jugadores, Logros, Reglas, Torneos, TorneoDetalle, Estadísticas. Comprobar:
- Sidebar visible y activo correcto en todas.
- Ningún componente estirado a más de su tope.
- Sticky bars (filtros Inicio, orden Jugadores, controles Logros) pegan arriba sin hueco.

A 480px y 390px (devtools): nav horizontal, layouts idénticos a antes del rework.

- [ ] **Step 3: Commit final si hubo retoques**

```bash
git add -A frontend/src
git commit -m "fix(ui): retoques de la pasada visual del rework desktop"
```
