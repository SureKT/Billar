# Game UX + Logros en vivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar toasts cuando se desbloquea un logro durante una partida, añadir glow dorado al formulario con bola en mano, y listar logros desbloqueados en el banner de resultado.

**Architecture:** Frontend-only, sin cambios de backend. Snapshot de logros en `useRef` inicializado al montar `Partida`; diff tras cada turno para detectar nuevos logros y lanzar toasts. `ResultadoBanner` recibe `logrosPartida` prop con logros filtrados por `partida_id` (campo ya devuelto por el backend en `LogroEstado`).

**Tech Stack:** React 18, Vite. API calls via `frontend/src/api/client.js` (`api.getLogrosJugador`). Toast system en `frontend/src/utils/toast.js` + `frontend/src/components/Toast.jsx`.

---

## Ficheros a modificar

| Fichero | Qué cambia |
|---|---|
| `frontend/src/utils/toast.js` | `showToast` acepta `duration` opcional; `msg` puede ser objeto |
| `frontend/src/components/Toast.jsx` | Nuevo tipo `'logro'`: layout con emoji + 2 líneas, fondo purple/amber, 5s |
| `frontend/src/components/partida/FormularioTurno.jsx` | Borde + glow dorado en la card cuando `partida.bola_en_mano` |
| `frontend/src/pages/Partida.jsx` | `logrosSnapshotRef`, `detectarNuevosLogros`, `checkNuevosLogros`, `logrosPartida` state |
| `frontend/src/components/partida/ResultadoBanner.jsx` | Prop `logrosPartida`, sección morada "🏅 Logros desbloqueados" |

---

### Task 1: Toast — tipo 'logro' con duración configurable

**Files:**
- Modify: `frontend/src/utils/toast.js`
- Modify: `frontend/src/components/Toast.jsx`

- [ ] **Step 1: Reemplazar toast.js**

Contenido completo de `frontend/src/utils/toast.js`:

```js
const listeners = new Set()

// msg: string para tipos 'error'/'success', objeto { quien, emoji, nombre, nivel? } para tipo 'logro'
export function showToast(msg, type = 'error', duration = 3000) {
  const id = Date.now() + Math.random()
  listeners.forEach(fn => fn({ id, msg, type, duration }))
}

export function subscribeToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
```

- [ ] **Step 2: Reemplazar Toast.jsx**

Contenido completo de `frontend/src/components/Toast.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { subscribeToast } from '../utils/toast'

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return subscribeToast(t => {
      setToasts(prev => [...prev, t])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), t.duration ?? 3000)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: 6,
      alignItems: 'center', pointerEvents: 'none', width: '90%', maxWidth: 380,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '10px 18px', borderRadius: 10, width: '100%',
          background: t.type === 'logro'
            ? 'linear-gradient(135deg, rgba(88,28,135,.95) 0%, rgba(120,53,15,.95) 100%)'
            : t.type === 'success' ? 'rgba(22,101,52,.96)' : 'rgba(127,29,29,.96)',
          border: t.type === 'logro' ? '1px solid rgba(168,85,247,.5)' : 'none',
          color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.5)',
          animation: 'slideUp .2s ease',
          backdropFilter: 'blur(8px)',
          textAlign: t.type === 'logro' ? 'left' : 'center',
        }}>
          {t.type === 'logro' && typeof t.msg === 'object' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{t.msg.emoji}</span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {t.msg.quien} desbloqueó
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.msg.nombre}</div>
                {t.msg.nivel && (
                  <div style={{ fontSize: 11, color: '#d8b4fe' }}>{t.msg.nivel}</div>
                )}
              </div>
            </div>
          ) : (
            <>{t.type === 'success' ? '✓ ' : '⚠ '}{t.msg}</>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verificar que toasts existentes siguen funcionando**

Arrancar frontend:
```
cd frontend && npm run dev
```

Ir a una partida en curso. Seleccionar bolas y pulsar "✓ Confirmar turno" con alguna combinación inválida que provoque error. Verificar que aparece el toast rojo de siempre.

También verificar que no hay errores en consola del navegador (`F12 → Console`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/toast.js frontend/src/components/Toast.jsx
git commit -m "feat(ux): add logro toast type with configurable duration"
```

---

### Task 2: Bola en mano — glow dorado en la card

**Files:**
- Modify: `frontend/src/components/partida/FormularioTurno.jsx:116`

- [ ] **Step 1: Añadir glow condicional**

En `frontend/src/components/partida/FormularioTurno.jsx` línea ~116, buscar:

```jsx
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
```

Reemplazar por:

```jsx
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      ...(partida.bola_en_mano ? {
        borderColor: 'rgba(202,138,4,.7)',
        boxShadow: '0 0 0 1px rgba(202,138,4,.3), 0 0 14px rgba(202,138,4,.12)',
      } : {}),
    }}>
```

- [ ] **Step 2: Verificar visualmente**

Con el frontend arrancado, crear o retomar una partida de Bola 8. Registrar un turno con falta "Blanca dentro (Scratch)" — esto activa `bola_en_mano` para el siguiente turno. En el turno siguiente, el formulario debe mostrar borde dorado + glow suave además del badge "Bola en mano" ya existente.

Para confirmar: en consola del navegador, buscar `partida.bola_en_mano` o verificar que el badge amarillo "Bola en mano" está visible en la cabecera del formulario.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/partida/FormularioTurno.jsx
git commit -m "feat(ux): gold border glow on turn form when ball-in-hand active"
```

---

### Task 3: Snapshot de logros + toasts al registrar turno

**Files:**
- Modify: `frontend/src/pages/Partida.jsx`

**Contexto:** `Partida.jsx` es el componente principal de una partida activa. Ya importa `useRef`, `useState`, `useEffect`, `api`, y `jugadores`. El componente tiene varios `useEffect` encadenados y la función `registrar()` que envía el turno al backend. Este task añade: un `useRef` para el snapshot, dos funciones de detección, un `useEffect` de inicialización, y una llamada tras `reload()`.

- [ ] **Step 1: Añadir import de showToast**

En `frontend/src/pages/Partida.jsx`, al final del bloque de imports (actualmente líneas 1-8), añadir:

```js
import { showToast } from '../utils/toast'
```

El bloque de imports queda:
```js
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePartidaData } from '../hooks/usePartidaData'
import BolasEquipo from '../components/partida/BolasEquipo'
import ResultadoBanner from '../components/partida/ResultadoBanner'
import FormularioTurno from '../components/partida/FormularioTurno'
import HistorialTurnos from '../components/partida/HistorialTurnos'
import { showToast } from '../utils/toast'
```

- [ ] **Step 2: Añadir logrosSnapshotRef**

Buscar la línea `const wakeLockRef = useRef(null)` (~línea 27) y añadir justo después:

```js
  const logrosSnapshotRef = useRef(null) // { [jugador_id]: LogroEstado[] }
```

- [ ] **Step 3: Añadir useEffect de inicialización del snapshot**

Añadir justo después del último `useEffect` existente (~línea 96, el que escucha `bolas.length` para beforeunload) y antes de los guards `if (loading)`:

```js
  // ── Snapshot de logros al arrancar partida en curso ───────────────────────────
  useEffect(() => {
    if (!partida || partida.estado !== 'en_curso' || logrosSnapshotRef.current) return
    const ids = [...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
    Promise.all(ids.map(jid => api.getLogrosJugador(jid)))
      .then(results => {
        logrosSnapshotRef.current = Object.fromEntries(ids.map((jid, i) => [jid, results[i]]))
      })
      .catch(() => {})
  }, [partida?.id, partida?.estado])
```

- [ ] **Step 4: Añadir detectarNuevosLogros y checkNuevosLogros**

Añadir justo ANTES de la función `registrar()` (~línea 130):

```js
  function detectarNuevosLogros(antes, despues) {
    const nuevos = []
    for (const logro of despues) {
      if (!logro.desbloqueado) continue
      const prevLogro = antes.find(l => l.id === logro.id)
      if (!prevLogro) continue
      if (logro.niveles_desbloqueados.length > 0) {
        const prevNiveles = new Set(prevLogro.niveles_desbloqueados ?? [])
        for (const nivel of logro.niveles_desbloqueados) {
          if (!prevNiveles.has(nivel)) nuevos.push({ ...logro, nivel_nuevo: nivel })
        }
      } else {
        if (!prevLogro.desbloqueado) nuevos.push(logro)
      }
    }
    return nuevos
  }

  async function checkNuevosLogros() {
    if (!logrosSnapshotRef.current) return
    const ids = [...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
    try {
      const results = await Promise.all(ids.map(jid => api.getLogrosJugador(jid)))
      for (let i = 0; i < ids.length; i++) {
        const jid = ids[i]
        const nuevos = detectarNuevosLogros(logrosSnapshotRef.current[jid] ?? [], results[i])
        const jugNombre = jugadores.find(j => j.id === jid)?.nombre ?? `#${jid}`
        for (const logro of nuevos) {
          const nivelLabel = logro.nivel_nuevo
            ? logro.nivel_nuevo.charAt(0).toUpperCase() + logro.nivel_nuevo.slice(1)
            : null
          showToast({ quien: jugNombre, emoji: logro.emoji, nombre: logro.nombre, nivel: nivelLabel }, 'logro', 5000)
        }
        logrosSnapshotRef.current[jid] = results[i]
      }
    } catch {
      // fallo silencioso — los toasts de logros no son críticos
    }
  }
```

- [ ] **Step 5: Llamar checkNuevosLogros en registrar()**

En la función `registrar()`, buscar:

```js
      await reload()
    } catch (err) {
```

Reemplazar por:

```js
      await reload()
      await checkNuevosLogros()
    } catch (err) {
```

- [ ] **Step 6: Verificar en navegador**

Con el frontend corriendo, abrir una partida y registrar varios turnos. Para forzar un desbloqueo del logro "Primeras bolas" (10 bolas totales), registra turnos con varias bolas hasta completar 10 en total entre todas las partidas del jugador.

Si el jugador ya tiene logros sencillos desbloqueados, crear un jugador nuevo para tener estado limpio.

Al desbloquear, debe aparecer en la parte inferior de la pantalla un toast morado/ámbar con emoji + nombre de jugador + nombre del logro. Dura 5 segundos.

Si no consigues un desbloqueo natural, puedes añadir temporalmente `console.log('nuevos logros:', nuevos)` dentro de `checkNuevosLogros` para verificar que el diff funciona.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Partida.jsx
git commit -m "feat(logros): live achievement unlock toasts on turn registration"
```

---

### Task 4: Sección de logros desbloqueados en ResultadoBanner

**Files:**
- Modify: `frontend/src/pages/Partida.jsx`
- Modify: `frontend/src/components/partida/ResultadoBanner.jsx`

**Contexto:** `ResultadoBanner` se muestra cuando `partida.estado === 'finalizada'`. El backend ya devuelve `partida_id` en cada `LogroEstado` (campo que indica en qué partida se desbloqueó ese logro). Usamos ese campo para filtrar.

- [ ] **Step 1: Añadir logrosPartida state en Partida.jsx**

Junto a los otros `useState` al inicio del componente (~líneas 15-26), añadir:

```js
  const [logrosPartida, setLogrosPartida] = useState(null)
```

- [ ] **Step 2: Añadir useEffect que fetcha logros al finalizar la partida**

Añadir después del `useEffect` de snapshot de logros (añadido en Task 3 Step 3):

```js
  // ── Logros desbloqueados en esta partida (para ResultadoBanner) ───────────────
  useEffect(() => {
    if (!partida || partida.estado !== 'finalizada') return
    const ids = [...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
    Promise.all(ids.map(jid => api.getLogrosJugador(jid)))
      .then(results => {
        const encontrados = []
        ids.forEach((jid, i) => {
          for (const logro of results[i]) {
            if (logro.desbloqueado && logro.partida_id === parseInt(id)) {
              encontrados.push({ jugador_id: jid, ...logro })
            }
          }
        })
        setLogrosPartida(encontrados)
      })
      .catch(() => setLogrosPartida([]))
  }, [partida?.estado, partida?.id])
```

Nota: `id` viene de `useParams()` como string, de ahí el `parseInt(id)`.

- [ ] **Step 3: Pasar logrosPartida a ResultadoBanner**

En el render de `Partida.jsx`, buscar `<ResultadoBanner` (~línea 311) y añadir la prop `logrosPartida`:

```jsx
          <ResultadoBanner
            partida={partida}
            turnos={turnos}
            jugadores={jugadores}
            onRevancha={revancha}
            onRepetir={repetir}
            torneoId={partida.torneo_id}
            logrosPartida={logrosPartida}
          />
```

- [ ] **Step 4: Añadir prop y sección en ResultadoBanner.jsx**

En `frontend/src/components/partida/ResultadoBanner.jsx`, actualizar la firma del componente (~línea 41):

```jsx
export default function ResultadoBanner({ partida, turnos, jugadores, onRevancha, onRepetir, torneoId, logrosPartida }) {
```

Luego, dentro del return, añadir justo ANTES del bloque `{/* ── Botones ── */}` (~línea 158):

```jsx
      {/* ── Logros desbloqueados en esta partida ── */}
      {logrosPartida?.length > 0 && (
        <div style={{
          background: 'rgba(88,28,135,.15)',
          border: '1px solid rgba(168,85,247,.3)',
          borderRadius: 10, padding: '12px 14px',
        }}>
          <p style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em',
            color: '#c4b5fd', marginBottom: 10, fontWeight: 700,
          }}>
            🏅 Logros desbloqueados
          </p>
          {logrosPartida.map(logro => (
            <div key={`${logro.jugador_id}-${logro.id}`} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)',
            }}>
              <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>
                {logro.emoji}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{logro.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                  {nombre(logro.jugador_id, jugadores)}
                </div>
              </div>
              {logro.nivel_actual && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(168,85,247,.2)', color: '#c4b5fd', flexShrink: 0,
                }}>
                  {logro.nivel_actual}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
```

Nota: `nombre` ya existe en `ResultadoBanner.jsx` como función local: `function nombre(id, jugadores)`.

- [ ] **Step 5: Verificar en navegador**

Abrir una partida ya **finalizada**. El ResultadoBanner debe mostrar la sección morada "🏅 Logros desbloqueados" si en esa partida se desbloqueó algún logro.

Para saber qué partida tiene logros: ir a `/logros`, seleccionar un jugador, ver qué logros tienen `Partida #N` asignada, e ir a esa partida.

Si la sección no aparece en ninguna partida, crear una partida nueva, jugarla hasta el final (puede ser una partida corta donde el jugador consiga su primera victoria o primera bola metida), y verificar en el banner.

Si la sección aparece aunque no haya logros (sección visible vacía): revisar que la condición `logrosPartida?.length > 0` está correctamente puesta.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Partida.jsx frontend/src/components/partida/ResultadoBanner.jsx
git commit -m "feat(logros): show achievements unlocked in this game in result banner"
```
