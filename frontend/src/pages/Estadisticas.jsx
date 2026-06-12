import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useSessionState } from '../hooks/useSessionState'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { api } from '../api/client'
import { SkeletonList } from '../components/Skeleton'
import Chip from '../components/Chip'
import { pct, winrate, colorJugador } from '../components/stats/StatPrimitives'
import { agruparPorSesion } from '../utils/sesiones'
import LineChart from '../components/stats/LineChart'
import SesionesChart from '../components/stats/SesionesChart'
import Podio from '../components/stats/Podio'

const FALTAS_INTERNAS = ['Bola 8 ilegal', 'Tres faltas consecutivas', 'Blanca dentro (Scratch)']

// ─── sub-componentes ──────────────────────────────────────────────────────────

// ─── Tabla comparativa ordenable ──────────────────────────────────────────────

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

function sortVal(j, key) {
  if (key === 'nombre') return j.nombre.toLowerCase()
  if (key === 'winrate') return winrate(j)
  if (key === 'racha') return j.racha_actual
  const col = COLS.find(c => c.key === key)
  return col?.get ? col.get(j) : 0
}

function RachaCell({ valor }) {
  if (valor > 0) return <span style={{ color: '#4ade80', fontWeight: 700 }}>▲{valor}</span>
  if (valor < 0) return <span style={{ color: '#f87171', fontWeight: 700 }}>▼{-valor}</span>
  return <span style={{ color: 'var(--text-dim)' }}>—</span>
}

function TablaComparativa({ jugadores }) {
  const [sortKey, setSortKey] = useSessionState('stats_tabla_sort', 'winrate')
  const [sortDir, setSortDir] = useSessionState('stats_tabla_dir', 'desc')
  const medallas = ['🥇', '🥈', '🥉']
  const scrollRef = useRef(null)
  const [hayOverflow, setHayOverflow] = useState(false)

  // Detecta si la tabla desborda (para mostrar el hint y la barra solo entonces) y,
  // de paso, convierte el scroll de rueda vertical en horizontal sobre la tabla.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const medir = () => setHayOverflow(el.scrollWidth > el.clientWidth + 1)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    function onWheel(e) {
      if (el.scrollWidth <= el.clientWidth) return          // no hay overflow
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return  // ya es scroll horizontal
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { ro.disconnect(); el.removeEventListener('wheel', onWheel) }
  }, [])

  function clickCabecera(key) {
    if (key === sortKey) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filas = [...jugadores].sort((a, b) => {
    const va = sortVal(a, sortKey)
    const vb = sortVal(b, sortKey)
    let cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    if (cmp === 0) cmp = b.partidas_jugadas - a.partidas_jugadas
    return sortDir === 'desc' ? -cmp : cmp
  })

  // Mejor valor por columna — la celda líder se destaca (sortVal cubre winrate y racha)
  const lideres = {}
  for (const col of COLS) {
    if (!col.mejor || filas.length < 2) continue
    const vals = filas.map(j => sortVal(j, col.key))
    lideres[col.key] = col.mejor === 'max' ? Math.max(...vals) : Math.min(...vals)
  }
  const esLider = (j, key) => lideres[key] !== undefined && sortVal(j, key) === lideres[key]

  const thBase = {
    fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)',
    textTransform: 'uppercase', letterSpacing: '.04em',
    padding: '0 10px', height: 42, whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none', textAlign: 'right',
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
  }
  const stickyCol = {
    position: 'sticky', left: 0, zIndex: 1,
    boxShadow: '1px 0 0 var(--border)',
  }

  function Cabecera({ col, sticky, align }) {
    const activa = col.key === sortKey
    return (
      <th
        onClick={() => clickCabecera(col.key)}
        style={{
          ...thBase,
          textAlign: align ?? 'right',
          color: activa ? 'var(--accent)' : 'var(--text-dim)',
          ...(sticky ? { ...stickyCol, textAlign: 'left' } : {}),
          ...(col.grupo === 'nuevo' ? { background: 'rgba(255,255,255,.015)' } : {}),
        }}
      >
        {col.head}{activa ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </th>
    )
  }

  const tdBase = {
    padding: '0 10px', height: 44, fontSize: '13px',
    textAlign: 'right', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
  }

  return (
    <div>
      {hayOverflow && (
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'right',
          padding: '0 4px 6px' }}>Desliza para más →</p>
      )}
      <div style={{ position: 'relative' }}>
        <div ref={scrollRef} style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
            <thead>
              <tr>
                <Cabecera col={{ key: 'nombre', head: 'Jugador' }} sticky align="left" />
                {COLS.map(c => <Cabecera key={c.key} col={c} />)}
              </tr>
            </thead>
            <tbody>
              {filas.map((j, i) => {
                const p = pct(j.partidas_ganadas, j.partidas_jugadas)
                const winColor = p >= 60 ? '#4ade80' : p >= 40 ? '#fbbf24' : '#f87171'
                const top = i === 0
                // Fondo OPACO (tinte compuesto sobre surface) — la columna sticky
                // debe tapar el contenido que se desliza por debajo al hacer scroll.
                const filaBg = top
                  ? 'linear-gradient(rgba(250,204,21,.05), rgba(250,204,21,.05)), var(--surface)'
                  : 'var(--surface)'
                const filaBgNuevo = top
                  ? filaBg
                  : 'linear-gradient(rgba(255,255,255,.015), rgba(255,255,255,.015)), var(--surface)'
                return (
                  <tr key={j.id}>
                    <td style={{
                      ...tdBase, textAlign: 'left', ...stickyCol, background: filaBg,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 20, textAlign: 'center', flexShrink: 0,
                          fontSize: i < 3 ? '15px' : '12px',
                          color: i < 3 ? undefined : 'var(--text-dim)' }}>
                          {i < 3 ? medallas[i] : i + 1}
                        </span>
                        {j.color && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%',
                            background: j.color, flexShrink: 0 }} />
                        )}
                        <span style={{ fontWeight: 700, overflow: 'hidden',
                          textOverflow: 'ellipsis', maxWidth: 110,
                          color: top ? '#fcd34d' : 'var(--text)' }}>
                          {j.nombre}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdBase, background: filaBg }}>{j.partidas_jugadas}</td>
                    <td style={{ ...tdBase, background: filaBg, minWidth: 96 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <div style={{ flex: 1, maxWidth: 48, height: 5, borderRadius: 3,
                          background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p}%`, background: winColor }} />
                        </div>
                        <span style={{ color: winColor, fontWeight: 700, minWidth: 30 }}>{p}%</span>
                      </div>
                    </td>
                    <td style={{ ...tdBase, background: filaBg,
                      ...(esLider(j, 'bolas') ? { color: '#86efac', fontWeight: 800 } : {}) }}>
                      {j.bolas_metidas}
                    </td>
                    <td style={{ ...tdBase, background: filaBg }}><RachaCell valor={j.racha_actual} /></td>
                    {COLS.filter(c => c.grupo === 'nuevo').map(c => (
                      <td key={c.key} style={{ ...tdBase, background: filaBgNuevo,
                        ...(esLider(j, c.key)
                          ? { color: '#86efac', fontWeight: 800 }
                          : { color: 'var(--text-dim)' }) }}>
                        {c.fmt(c.get(j))}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {hayOverflow && (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 24,
            pointerEvents: 'none',
            background: 'linear-gradient(to left, rgba(24,24,31,.9), transparent)' }} />
        )}
      </div>
      <p style={{ fontSize: '10px', color: 'var(--text-dim)', padding: '8px 12px',
        lineHeight: 1.5 }}>
        PJ partidas jugadas · B/T bolas/turno · B/P bolas/partida · Break% breaks con bola · F/P faltas/partida · MaxB máx bolas en un turno
      </p>
    </div>
  )
}

function RecordCard({ emoji, titulo, nombre, valor, partidaId, partidaNumero, onNavigate }) {
  const inner = (
    <>
      <span style={{ fontSize: '22px', flexShrink: 0 }}>{emoji}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', marginBottom: 2 }}>{titulo}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
          {partidaNumero != null && (
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, flexShrink: 0 }}>#{partidaNumero}</span>
          )}
        </div>
        {valor && <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{valor}</div>}
      </div>
      {partidaId != null && (
        <span style={{ fontSize: '16px', color: 'var(--text-dim)', flexShrink: 0 }}>›</span>
      )}
    </>
  )
  const sharedStyle = {
    background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px',
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  }
  if (partidaId != null) {
    return (
      <button className="hoverable" onClick={() => onNavigate(partidaId)} style={{
        ...sharedStyle,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        font: 'inherit', lineHeight: 'inherit', color: 'inherit',
      }}>
        {inner}
      </button>
    )
  }
  return <div style={sharedStyle}>{inner}</div>
}

function SeccionTitulo({ children }) {
  return (
    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 10 }}>
      {children}
    </p>
  )
}

const MODALIDADES = [
  { value: 'todas', label: 'Todas' },
  { value: 'bola8', label: 'Bola 8' },
  { value: 'bola9', label: 'Bola 9' },
]

const PERIODOS = [
  { value: 'siempre', label: 'Siempre' },
  { value: 'sesion',  label: 'Última sesión' },
  { value: '7d',      label: '7 días' },
  { value: '30d',     label: '30 días' },
]

// ISO local sin zona — coherente con Partida.fecha (datetime.now() naive)
function toNaiveIso(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function fmtFechaCorta(isoStr) {
  const s = /Z|[+-]\d{2}:\d{2}$/.test(isoStr) ? isoStr : isoStr + 'Z'
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function Estadisticas() {
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtro, setFiltroState] = useState(searchParams.get('filtro') ?? 'todas')
  const [tiempo, setTiempoState] = useState(searchParams.get('tiempo') ?? 'siempre')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  function actualizarParams(f, t) {
    const params = {}
    if (f !== 'todas') params.filtro = f
    if (t !== 'siempre') params.tiempo = t
    setSearchParams(params, { replace: true })
  }
  function setFiltro(val)  { setFiltroState(val);  actualizarParams(val, tiempo) }
  function setTiempo(val)  { setTiempoState(val);  actualizarParams(filtro, val) }

  const modalidadParam = filtro === 'todas' ? null : filtro
  const { data: partidas, loading: loadingPart } = useApi(api.getPartidas)
  const { data: todosJugadores, reload: reloadJugadores } = useApi(api.getJugadores)

  const sesionReciente = tiempo === 'sesion'
    ? (agruparPorSesion((partidas ?? []).filter(p => p.estado === 'finalizada'))[0] ?? null)
    : null

  // Rango temporal → desde (ISO naive local, coherente con Partida.fecha)
  const rangoDesde = (() => {
    if (tiempo === '7d')  return new Date(Date.now() - 7  * 86_400_000)
    if (tiempo === '30d') return new Date(Date.now() - 30 * 86_400_000)
    if (tiempo === 'sesion') return sesionReciente ? new Date(sesionReciente.fechaInicio) : null
    return null
  })()
  const desdeIso = rangoDesde ? toNaiveIso(rangoDesde) : null
  const tiempoActivo = tiempo !== 'siempre'

  const { data: stats, reload: reloadStats } = useApi(
    () => api.getAllStats(false, modalidadParam, desdeIso),
    [filtro, tiempo, desdeIso]
  )
  const [faltas, setFaltas] = useState(null)

  const activeIdsKey = (stats ?? []).map(j => j.id).sort((a, b) => a - b).join(',')
  useEffect(() => {
    if (!stats) return
    const ids = stats.map(j => j.id)
    api.getFaltas(ids, desdeIso).then(setFaltas).catch(() => {})
  }, [activeIdsKey, desdeIso])

  useEffect(() => {
    if (!dropdownOpen) return
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [dropdownOpen])

  if (loadingPart && !partidas) return <SkeletonList n={5} />

  const jugadoresConPartidas = (stats ?? []).filter(j => j.partidas_jugadas > 0)
  const activeIds = new Set((stats ?? []).map(j => j.id))
  const partidasActivas = (partidas ?? []).filter(p =>
    [...(p.equipo1_jugadores ?? []), ...(p.equipo2_jugadores ?? [])].some(id => activeIds.has(id))
  )

  // Rango temporal aplicado client-side a las partidas (records, counts)
  const todasPartidas = rangoDesde
    ? partidasActivas.filter(p => new Date(p.fecha) >= rangoDesde)
    : partidasActivas

  const finalizadas = todasPartidas.filter(p => p.estado === 'finalizada')
  const enCurso     = todasPartidas.filter(p => p.estado === 'en_curso')
  const bola8       = todasPartidas.filter(p => p.modalidad === 'bola8')
  const bola9       = todasPartidas.filter(p => p.modalidad === 'bola9')

  const faltaField = filtro === 'bola8' ? 'frecuencia_bola8' : filtro === 'bola9' ? 'frecuencia_bola9' : 'frecuencia'
  const totalFaltas = (faltas ?? []).reduce((s, f) => s + (f[faltaField] ?? 0), 0)

  // Partidas filtradas por modalidad (para counts y records)
  const finalizadasFiltradas = filtro === 'todas' ? finalizadas : finalizadas.filter(p => p.modalidad === filtro)
  const todasFiltradas       = filtro === 'todas' ? todasPartidas : todasPartidas.filter(p => p.modalidad === filtro)
  const enCursoFiltradas     = filtro === 'todas' ? enCurso : enCurso.filter(p => p.modalidad === filtro)

  const rankingFiltrado = [...jugadoresConPartidas].sort((a, b) => winrate(b) - winrate(a) || b.partidas_jugadas - a.partidas_jugadas)

  // Duración media (filtrada)
  const conDuracion = finalizadasFiltradas.filter(p => p.fecha_fin)
  const duracionMedia = (() => {
    if (conDuracion.length === 0) return null
    const ms = conDuracion.reduce((s, p) => s + (new Date(p.fecha_fin) - new Date(p.fecha)), 0) / conDuracion.length
    const min = Math.floor(ms / 60_000)
    const seg = Math.floor((ms % 60_000) / 1_000)
    return { str: `${min}' ${String(seg).padStart(2, '0')}"` }
  })()

  // Faltas: el endpoint ya respeta el periodo (param desde) → coherente con el filtro
  const faltasPorPartida = finalizadasFiltradas.length > 0
    ? (totalFaltas / finalizadasFiltradas.length).toFixed(1) : null

  const faltasOrdenadas = (faltas ?? [])
    .filter(f => !FALTAS_INTERNAS.includes(f.nombre) && (f[faltaField] ?? 0) > 0)
    .sort((a, b) => (b[faltaField] ?? 0) - (a[faltaField] ?? 0))
    .slice(0, 6)

  // Records
  const mejorWinRate = [...jugadoresConPartidas].sort((a, b) => winrate(b) - winrate(a))[0]
  const masBolas     = [...jugadoresConPartidas].sort((a, b) => b.bolas_metidas - a.bolas_metidas)[0]
  const rachaPos     = [...jugadoresConPartidas].filter(j => j.racha_actual > 0).sort((a, b) => b.racha_actual - a.racha_actual)[0]
  const masEficiente = [...jugadoresConPartidas].filter(j => j.bolas_por_turno > 0).sort((a, b) => b.bolas_por_turno - a.bolas_por_turno)[0]

  function nombresPartida(p) {
    return [...(p.equipo1_jugadores ?? []), ...(p.equipo2_jugadores ?? [])]
      .map(id => (stats ?? []).find(s => s.id === id)?.nombre ?? `J${id}`)
      .join(' · ')
  }
  function durMs(p) { return new Date(p.fecha_fin) - new Date(p.fecha) }
  function fmtMin(ms) {
    const m = Math.floor(ms / 60_000), s = Math.floor((ms % 60_000) / 1_000)
    return `${m}' ${String(s).padStart(2,'0')}"`
  }

  const rachaHistorica = [...jugadoresConPartidas].filter(j => j.racha_mejor > 1).sort((a,b) => b.racha_mejor - a.racha_mejor)[0]
  const rachaPeorHist = [...jugadoresConPartidas].filter(j => (j.racha_peor ?? 0) > 1).sort((a,b) => b.racha_peor - a.racha_peor)[0]
  const masMaxBolasT  = [...jugadoresConPartidas].filter(j => (j.max_bolas_turno ?? 0) > 0).sort((a,b) => b.max_bolas_turno - a.max_bolas_turno)[0]
  const masRapida = conDuracion.length > 0 ? conDuracion.reduce((m,p) => durMs(p) < durMs(m) ? p : m) : null
  const masLenta  = conDuracion.length > 0 ? conDuracion.reduce((m,p) => durMs(p) > durMs(m) ? p : m) : null

  // ── Datos para gráficas de jugador (respetan filtros) ──
  const idxJugador = new Map((stats ?? []).map((j, i) => [j.id, i]))
  const cj = j => colorJugador(j, idxJugador.get(j.id) ?? 0)

  // ── Datos temporales (histórico completo, solo filtrados por modalidad —
  //    son visualizaciones de línea de tiempo, recortarlas las vaciaría) ──
  const finalizadasHist = partidasActivas
    .filter(p => p.estado === 'finalizada')
    .filter(p => filtro === 'todas' || p.modalidad === filtro)

  const sesionesHist = agruparPorSesion(finalizadasHist)

  const evolucionSeries = (() => {
    if (!stats) return []
    const porJugador = new Map()
    const orden = [...finalizadasHist].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    for (const p of orden) {
      if (!p.ganador_equipo) continue
      for (const eq of [1, 2]) {
        for (const id of (eq === 1 ? p.equipo1_jugadores : p.equipo2_jugadores) ?? []) {
          if (!porJugador.has(id)) porJugador.set(id, { jugadas: 0, ganadas: 0, puntos: [] })
          const r = porJugador.get(id)
          r.jugadas += 1
          if (p.ganador_equipo === eq) r.ganadas += 1
          r.puntos.push({ t: new Date(p.fecha).getTime(), y: (r.ganadas / r.jugadas) * 100 })
        }
      }
    }
    return [...porJugador.entries()]
      .filter(([id]) => idxJugador.has(id))
      .sort(([, a], [, b]) => b.jugadas - a.jugadas)
      .slice(0, 6)
      .map(([id, r]) => {
        const j = stats.find(s => s.id === id)
        // Las 2 primeras partidas oscilan 0↔100% — ruido sin valor; empezar en la 3ª
        const puntos = r.puntos.length > 3 ? r.puntos.slice(2) : r.puntos.slice(-1)
        return { nombre: j.nombre, color: cj(j), puntos }
      })
  })()

  const sinDatos = todasFiltradas.length === 0
  const periodoLabel = PERIODOS.find(t => t.value === tiempo)?.label

  // ── Bloques de contenido (única fuente — móvil y desktop los disponen distinto) ──

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
      <div ref={dropdownRef} style={{ position: 'relative', marginLeft: 'auto' }}>
        <button
          onClick={() => setDropdownOpen(o => !o)}
          style={{
            fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 4px', borderRadius: 4, font: 'inherit',
          }}
        >
          {(stats ?? []).length} jugadores{tiempoActivo ? ` · ${periodoLabel}` : ''} ▾
        </button>
        {dropdownOpen && (
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '6px 0', minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          }}>
            <p style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em',
              color: 'var(--text-dim)', padding: '4px 12px 6px', fontWeight: 700, margin: 0,
            }}>Jugadores activos</p>
            {(todosJugadores ?? [])
              .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre))
              .map(j => (
                <button
                  key={j.id}
                  onClick={async () => {
                    await api.toggleActivoJugador(j.id)
                    reloadJugadores()
                    reloadStats()
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 12px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    font: 'inherit', color: 'inherit', textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: j.color ?? 'transparent',
                    border: j.color ? 'none' : '1px solid var(--border)',
                  }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{j.nombre}</span>
                  <span style={{
                    width: 28, height: 16, borderRadius: 8, flexShrink: 0,
                    background: j.activo ? 'var(--accent)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', padding: '0 2px',
                    transition: 'background .15s',
                  }}>
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%', background: '#fff',
                      transform: j.activo ? 'translateX(12px)' : 'translateX(0)',
                      transition: 'transform .15s', display: 'block',
                    }} />
                  </span>
                </button>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )

  const hayRecords = mejorWinRate || masBolas || rachaPos || masEficiente
  const bloqueRecords = hayRecords ? (
    <div className="card" style={{ padding: '12px' }}>
      <SeccionTitulo>Récords{tiempoActivo ? ` · ${periodoLabel}` : ''}</SeccionTitulo>
      <div style={{
        display: 'grid', gap: 8,
        gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(210px, 1fr))' : '1fr',
      }}>
        {mejorWinRate && mejorWinRate.partidas_jugadas >= 2 && (
          <RecordCard emoji="🏆" titulo="Mejor win rate"
            nombre={mejorWinRate.nombre}
            valor={`${pct(mejorWinRate.partidas_ganadas, mejorWinRate.partidas_jugadas)}% (${mejorWinRate.partidas_ganadas}/${mejorWinRate.partidas_jugadas})`}
          />
        )}
        {masBolas && masBolas.bolas_metidas > 0 && (
          <RecordCard emoji="🎱" titulo="Más bolas metidas"
            nombre={masBolas.nombre}
            valor={`${masBolas.bolas_metidas} bolas · ${masBolas.bolas_por_turno} x turno`}
          />
        )}
        {masEficiente && masEficiente !== masBolas && (
          <RecordCard emoji="⚡" titulo="Más eficiente (bolas/turno)"
            nombre={masEficiente.nombre}
            valor={`${masEficiente.bolas_por_turno} bolas por turno`}
          />
        )}
        {rachaPos && (
          <RecordCard emoji="🔥" titulo="Racha ganadora actual"
            nombre={rachaPos.nombre}
            valor={`${rachaPos.racha_actual} seguidas`}
          />
        )}
        {rachaHistorica && (
          <RecordCard emoji="📈" titulo="Racha histórica"
            nombre={rachaHistorica.nombre}
            valor={`${rachaHistorica.racha_mejor} victorias seguidas`}
          />
        )}
        {rachaPeorHist && (
          <RecordCard emoji="📉" titulo="Peor racha"
            nombre={rachaPeorHist.nombre}
            valor={`${rachaPeorHist.racha_peor} derrotas seguidas`}
          />
        )}
        {masMaxBolasT && (
          <RecordCard emoji="💥" titulo="Máx bolas en un turno"
            nombre={masMaxBolasT.nombre}
            valor={`${masMaxBolasT.max_bolas_turno} bolas`}
          />
        )}
        {masRapida && (
          <RecordCard emoji="⚡" titulo="Partida más rápida"
            nombre={nombresPartida(masRapida)}
            valor={fmtMin(durMs(masRapida))}
            partidaId={masRapida.id}
            partidaNumero={masRapida.numero}
            onNavigate={id => navigate(`/partida/${id}`)}
          />
        )}
        {masLenta && masLenta !== masRapida && (
          <RecordCard emoji="🐢" titulo="Partida más larga"
            nombre={nombresPartida(masLenta)}
            valor={fmtMin(durMs(masLenta))}
            partidaId={masLenta.id}
            partidaNumero={masLenta.numero}
            onNavigate={id => navigate(`/partida/${id}`)}
          />
        )}
        {faltasOrdenadas.length > 0 && (
          <RecordCard emoji="⚠️" titulo="Falta más típica"
            nombre={faltasOrdenadas[0].nombre}
            valor={`${faltasOrdenadas[0][faltaField] ?? 0} veces`}
          />
        )}
      </div>
    </div>
  ) : null

  const graficasTemporales = [
    sesionesHist.length > 1     && { titulo: 'Victorias por sesión', nodo: <SesionesChart sesiones={sesionesHist} jugadores={stats ?? []} /> },
    evolucionSeries.length > 0  && {
      titulo: 'Evolución win rate',
      nodo: <LineChart series={evolucionSeries} viewW={desktop ? 1000 : 380} />,
    },
  ].filter(Boolean)

  const bloqueRanking = jugadoresConPartidas.length > 0 ? (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: '13px', fontWeight: 700 }}>Leaderboard{tiempoActivo ? ` · ${periodoLabel}` : ''}</p>
      </div>
      {rankingFiltrado.length === 0 ? (
        <p style={{ padding: '16px 14px', fontSize: '13px', color: 'var(--text-dim)' }}>
          Sin datos para este filtro
        </p>
      ) : (
        <div style={{ padding: '10px 12px 4px' }}>
          <TablaComparativa jugadores={rankingFiltrado} />
        </div>
      )}
    </div>
  ) : null

  const vacio = tiempo === 'sesion' ? (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '48px', marginBottom: 12 }}>📊</div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
        Los jugadores activos no participaron en la última sesión
        {sesionReciente ? ` (${fmtFechaCorta(sesionReciente.fechaRef)})` : ''}
      </p>
      <button
        onClick={() => setTiempo('siempre')}
        style={{
          padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
          background: 'var(--accent)', border: 'none',
          color: '#000', fontWeight: 700, fontSize: 13, font: 'inherit',
        }}
      >Ver todas las estadísticas</button>
    </div>
  ) : (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '48px', marginBottom: 12 }}>📊</div>
      <p style={{ color: 'var(--text-dim)' }}>
        {tiempoActivo ? 'Sin partidas en este periodo' : 'Aún no hay partidas registradas'}
      </p>
    </div>
  )

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

  // ─── Móvil: stack vertical (versión adaptada funcional) ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* Solo título + modalidad quedan sticky — el periodo scrollea para no
          comerse ~150px de viewport en móvil */}
      <div style={{
        position: 'sticky', top: 'var(--nav-height)', zIndex: 50,
        background: 'var(--bg)', padding: '14px 16px 6px', margin: '0 -16px',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <h2 style={{ fontSize: '20px', margin: 0, flexShrink: 0 }}>Estadísticas</h2>
        <button
          onClick={() => navigate('/tv')}
          style={{
            padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,.06)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}
        >📺 TV</button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {MODALIDADES.map(m => (
            <Chip key={m.value} label={m.label} activo={filtro === m.value} onClick={() => setFiltro(m.value)} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: -6 }}>
        {PERIODOS.map(t => (
          <Chip key={t.value} label={t.label} activo={tiempo === t.value} onClick={() => setTiempo(t.value)} />
        ))}
      </div>

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
    </div>
  )
}
