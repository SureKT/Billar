# Game UX + Logros en vivo — Diseño

**Fecha:** 2026-05-27
**Estado:** Aprobado

---

## Objetivo

Añadir feedback visual en tiempo real cuando se desbloquea un logro durante una partida, mejorar el indicador de bola en mano, y mostrar un resumen de logros desbloqueados al finalizar.

## Alcance

Sub-proyecto A de la revisión global de QoL. Sin cambios de backend ni de base de datos.

---

## Cambios

### 1. Toast de logro desbloqueado

**Fichero:** `frontend/src/components/Toast.jsx`, `frontend/src/utils/toast.js`

Nuevo tipo `'logro'` en el sistema de toasts:
- Fondo: degradado morado→ámbar (`rgba(88,28,135,.95)` → `rgba(120,53,15,.95)`)
- Borde: `rgba(168,85,247,.5)`
- Duración: 5 segundos (vs 3s actual para error/success)
- Estructura del mensaje:
  - Línea superior (11px, gris claro): `{nombre_jugador} desbloqueó`
  - Línea principal (14px, blanco, bold): `{emoji} {nombre_logro}`
  - Línea opcional (11px, `#d8b4fe`): nivel si es logro nivelado, ej. `🥈 Plata`

`toast.js` extiende `showToast` para aceptar duración opcional:
```js
// msg puede ser string (tipos error/success) u objeto { quien, emoji, nombre, nivel? } (tipo logro)
export function showToast(msg, type = 'error', duration = 3000)
```

### 2. Detección de logros nuevos tras turno

**Fichero:** `frontend/src/pages/Partida.jsx`

#### Snapshot en mount

Al montar el componente (partida en curso), se hace fetch paralelo de logros para todos los jugadores de la partida y se guarda en un `useRef`:

```js
const logrosSnapshotRef = useRef(null)
// shape: { [jugador_id]: LogroEstado[] }
```

Inicialización (solo una vez, solo si partida en curso):
```js
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

#### Función de detección

```js
function detectarNuevosLogros(antes, despues) {
  // antes/despues: LogroEstado[]
  const nuevos = []
  for (const logro of despues) {
    if (!logro.desbloqueado) continue
    const prevLogro = antes.find(l => l.id === logro.id)
    if (!prevLogro) continue
    if (logro.niveles_desbloqueados.length > 0) {
      // nivelado: detectar niveles nuevos
      const prevNiveles = new Set(prevLogro.niveles_desbloqueados ?? [])
      for (const nivel of logro.niveles_desbloqueados) {
        if (!prevNiveles.has(nivel)) nuevos.push({ ...logro, nivel_nuevo: nivel })
      }
    } else {
      // simple: recién desbloqueado
      if (!prevLogro.desbloqueado) nuevos.push(logro)
    }
  }
  return nuevos
}
```

#### Llamada tras turno registrado

En `registrar()`, después de `await reload()`:
```js
async function checkNuevosLogros() {
  if (!logrosSnapshotRef.current) return
  const ids = [...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
  const results = await Promise.all(ids.map(jid => api.getLogrosJugador(jid)))
  for (let i = 0; i < ids.length; i++) {
    const jid = ids[i]
    const nuevos = detectarNuevosLogros(logrosSnapshotRef.current[jid] ?? [], results[i])
    const jugNombre = jugadores.find(j => j.id === jid)?.nombre ?? `#${jid}`
    for (const logro of nuevos) {
      // nivel_nuevo es el nombre del nivel (ej. "plata"); capitalizar para display
      const nivelLabel = logro.nivel_nuevo
        ? logro.nivel_nuevo.charAt(0).toUpperCase() + logro.nivel_nuevo.slice(1)
        : null
      showToast({ quien: jugNombre, emoji: logro.emoji, nombre: logro.nombre, nivel: nivelLabel }, 'logro', 5000)
    }
    logrosSnapshotRef.current[jid] = results[i]
  }
}
```

El toast usa `\n` como separador de las dos líneas — `Toast.jsx` renderiza líneas separadas para `type='logro'`.

#### Estructura del toast (Toast.jsx)

Para `type === 'logro'`, el mensaje llega como objeto `{ quien, nombre, nivel }` (o string si es otro tipo):
```jsx
// showToast acepta objeto para logros:
showToast({ quien: jugNombre, emoji: logro.emoji, nombre: logro.nombre, nivel: nivelStr }, 'logro', 5000)
```

Toast renderiza:
```jsx
{t.type === 'logro' && typeof t.msg === 'object' ? (
  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
    <span style={{ fontSize:24 }}>{t.msg.emoji}</span>
    <div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.05em' }}>
        {t.msg.quien} desbloqueó
      </div>
      <div style={{ fontSize:14, fontWeight:700 }}>{t.msg.nombre}</div>
      {t.msg.nivel && <div style={{ fontSize:11, color:'#d8b4fe' }}>{t.msg.nivel}</div>}
    </div>
  </div>
) : (
  <>{t.type === 'success' ? '✓ ' : '⚠ '}{t.msg}</>
)}
```

### 3. Sección logros en ResultadoBanner

**Ficheros:** `frontend/src/pages/Partida.jsx`, `frontend/src/components/partida/ResultadoBanner.jsx`

#### Fetch en Partida.jsx

Cuando la partida finaliza, se fetchean los logros de todos los jugadores y se filtran por `partida_id`:

```js
const [logrosPartida, setLogrosPartida] = useState(null)

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

Se pasa a `ResultadoBanner`: `<ResultadoBanner logrosPartida={logrosPartida} ... />`

#### Sección en ResultadoBanner.jsx

Sección morada bajo las cifras globales, antes de los botones, visible solo si `logrosPartida?.length > 0`:

```jsx
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
        <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{logro.emoji}</span>
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

### 4. Bola en mano — glow en la card

**Fichero:** `frontend/src/components/partida/FormularioTurno.jsx`

El badge existente se mantiene. Se añade borde + glow a la card cuando `partida.bola_en_mano` es `true`:

```jsx
<div className="card" style={{
  display: 'flex', flexDirection: 'column', gap: 14,
  ...(partida.bola_en_mano ? {
    borderColor: 'rgba(202,138,4,.7)',
    boxShadow: '0 0 0 1px rgba(202,138,4,.3), 0 0 14px rgba(202,138,4,.12)',
  } : {}),
}}>
```

---

## Ficheros modificados

| Fichero | Cambio |
|---|---|
| `frontend/src/utils/toast.js` | `showToast` acepta objeto + duración opcional |
| `frontend/src/components/Toast.jsx` | Tipo `'logro'` con layout de dos líneas + emoji |
| `frontend/src/pages/Partida.jsx` | Snapshot ref, `detectarNuevosLogros`, `checkNuevosLogros`, `logrosPartida` state |
| `frontend/src/components/partida/FormularioTurno.jsx` | Borde/glow dorado cuando `bola_en_mano` |
| `frontend/src/components/partida/ResultadoBanner.jsx` | Prop `logrosPartida`, sección morada al final |

## Sin cambios

- Backend (FastAPI / SQLModel)
- Base de datos
- Sistema de logros (`logic_logros.py`)
- Otros componentes

---

## Testing

- Registrar turno que desbloquea un logro → toast aparece con nombre de jugador + logro
- Registrar turno que sube nivel → toast muestra nivel nuevo
- Turno sin desbloqueos → sin toast
- Partida finalizada → `ResultadoBanner` muestra logros de esa partida
- Partida sin logros desbloqueados → sección oculta
- Bola en mano activa → card con borde dorado + badge existente
- Bola en mano inactiva → card sin borde especial
