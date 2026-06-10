import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'
import Sugerencias from './Sugerencias'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { SkeletonList } from '../components/Skeleton'

// Plantillas de grupo habitual — persistidas en localStorage (uso local, sin backend)
const PLANTILLAS_KEY = 'billar_plantillas'
function cargarPlantillas() {
  try { return JSON.parse(localStorage.getItem(PLANTILLAS_KEY)) || [] } catch { return [] }
}
function persistirPlantillas(arr) {
  try { localStorage.setItem(PLANTILLAS_KEY, JSON.stringify(arr)) } catch {}
}

function RachaChip({ racha }) {
  if (!racha) return null
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, marginLeft: 4,
      color: racha > 0 ? '#86efac' : '#fca5a5',
    }}>
      {racha > 0 ? `▲${racha}` : `▼${Math.abs(racha)}`}
    </span>
  )
}

function ListaOrdenable({ ids, jugadores, onChange }) {
  const [dragging, setDragging] = useState(null)
  const [insertBefore, setInsertBefore] = useState(null)
  const containerRef = useRef(null)

  function getInsertIdx(clientY) {
    const container = containerRef.current
    if (!container) return null
    const items = Array.from(container.querySelectorAll('[data-drag-item]'))
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return items.length
  }

  function startDrag(e, fromIdx) {
    e.preventDefault()
    setDragging(fromIdx)
    const target = { idx: null }

    function onMove(me) {
      const t = getInsertIdx(me.clientY)
      target.idx = t
      setInsertBefore(t)
    }

    function onUp() {
      const to = target.idx
      if (to !== null && to !== fromIdx && to !== fromIdx + 1) {
        const arr = [...ids]
        const [item] = arr.splice(fromIdx, 1)
        arr.splice(to > fromIdx ? to - 1 : to, 0, item)
        onChange(arr)
      }
      setDragging(null)
      setInsertBefore(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function remove(id) {
    onChange(ids.filter(x => x !== id))
  }

  if (ids.length < 2) return null

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Orden de juego · arrastra ⠿ para cambiar
      </p>
      <div ref={containerRef}>
        {ids.map((id, i) => {
          const j = jugadores.find(j => j.id === id)
          const isDragging = dragging === i
          const showLine = insertBefore === i || (insertBefore === ids.length && i === ids.length - 1 && insertBefore !== i)

          return (
            <div key={id}>
              {insertBefore === i && dragging !== i && dragging !== i - 1 && (
                <div style={{ height: 2, background: 'var(--accent)', borderRadius: 1, margin: '2px 6px' }} />
              )}
              <div
                data-drag-item={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8, marginBottom: 4,
                  background: isDragging ? 'var(--accent-bg)' : 'var(--surface2)',
                  border: `1px solid ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                  opacity: isDragging ? 0.45 : 1,
                  transition: 'opacity .1s, background .1s',
                  userSelect: 'none',
                }}
              >
                <span
                  onPointerDown={e => startDrag(e, i)}
                  style={{
                    color: 'var(--text-dim)', fontSize: '17px', lineHeight: 1,
                    cursor: 'grab', touchAction: 'none', padding: '2px 3px', flexShrink: 0,
                  }}
                >⠿</span>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(6,182,212, 0.13)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 800, color: 'var(--accent)', flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>
                  {j?.nombre}
                </span>
                <button
                  onClick={() => remove(id)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-dim)',
                    fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0,
                  }}
                >×</button>
              </div>
            </div>
          )
        })}
        {insertBefore === ids.length && dragging !== ids.length - 1 && (
          <div style={{ height: 2, background: 'var(--accent)', borderRadius: 1, margin: '2px 6px' }} />
        )}
      </div>
    </div>
  )
}

// teamNum: 1 = azul, 2 = rojo
const TEAM_COLOR = {
  1: { main: 'var(--team1)', bg: 'rgba(59,130,246,.14)', border: 'var(--team1)' },
  2: { main: 'var(--team2)', bg: 'rgba(233,69,96,.14)',  border: 'var(--team2)'  },
}

function SelectorEquipo({ titulo, teamNum, nombre, onNombreChange, jugadores, seleccionados, onChange, excluidos, statsMap, mostrarOrden = true }) {
  const tc = TEAM_COLOR[teamNum]

  function toggle(id) {
    onChange(
      seleccionados.includes(id)
        ? seleccionados.filter(x => x !== id)
        : [...seleccionados, id]
    )
  }

  return (
    <div className="card" style={{ borderLeft: `3px solid ${tc.main}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '60%', minWidth: 0,
          borderBottom: `1.5px ${nombre ? 'solid' : 'dashed'} ${nombre ? tc.main : 'var(--text-dim)'}`,
          transition: 'border-color .15s',
        }}>
          <input
            value={nombre}
            onChange={e => onNombreChange(e.target.value)}
            placeholder={titulo}
            maxLength={24}
            style={{
              flex: 1, minWidth: 0,
              fontWeight: 700, fontSize: '15px', color: tc.main,
              background: 'none', outline: 'none', padding: '0 0 3px 0',
              border: 'none',
            }}
          />
          <span style={{ color: 'var(--text-dim)', fontSize: '13px', flexShrink: 0, paddingBottom: 2, pointerEvents: 'none' }}>✎</span>
        </div>
        <span style={{ fontSize: '13px', color: seleccionados.length > 0 ? '#86efac' : 'var(--text-dim)' }}>
          {seleccionados.length === 0 ? 'Sin jugadores' : `${seleccionados.length} jugador${seleccionados.length > 1 ? 'es' : ''}`}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {jugadores.map(j => {
          const excluido = excluidos.includes(j.id)
          const sel = seleccionados.includes(j.id)
          const racha = statsMap?.[j.id]?.racha_actual ?? 0
          return (
            <button
              key={j.id}
              disabled={excluido}
              onClick={() => toggle(j.id)}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: '14px', fontWeight: 600,
                border: sel ? `1.5px solid ${tc.main}` : '1px solid var(--border)',
                background: sel ? tc.bg : excluido ? 'transparent' : 'var(--surface2)',
                color: sel ? tc.main : excluido ? 'var(--text-dim)' : 'var(--text)',
                opacity: excluido ? .35 : 1,
                cursor: excluido ? 'not-allowed' : 'pointer',
                transition: 'background .15s, border-color .15s, color .15s',
                display: 'flex', alignItems: 'center',
              }}
            >
              {sel ? '✓ ' : ''}{j.nombre}
              <RachaChip racha={racha} />
            </button>
          )
        })}
      </div>
      {mostrarOrden && <ListaOrdenable ids={seleccionados} jugadores={jugadores} onChange={onChange} />}
    </div>
  )
}

export default function NuevaPartida() {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const { data: jugadores, loading: jLoading } = useApi(api.getJugadores)
  const { data: statsData, loading: sLoading }  = useApi(api.getAllStats)
  const loading = jLoading || sLoading
  const statsMap = Object.fromEntries((statsData ?? []).map(s => [s.id, s]))
  const { state: prefill } = useLocation()
  const [tab, setTab] = useState('manual')
  const [modalidad, setModalidad] = useState(prefill?.modalidad ?? 'bola8')
  const [equipo1, setEquipo1] = useState(prefill?.equipo1 ?? [])
  const [equipo2, setEquipo2] = useState(prefill?.equipo2 ?? [])
  const [nombre1, setNombre1] = useState('')
  const [nombre2, setNombre2] = useState('')
  const [primerJugador, setPrimerJugador] = useState(prefill?.equipo1?.[0] ?? null)
  const [ultimoSaqueId, setUltimoSaqueId] = useState(null)
  const [error, setError] = useState(null)
  const [creando, setCreando] = useState(false)
  const [ajustes, setAjustes] = useState(false)
  const [plantillas, setPlantillas] = useState(() => cargarPlantillas())
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false)
  const [nombrePlantilla, setNombrePlantilla] = useState('')
  const navigate = useNavigate()

  // Sugerencia de quién saca: el que NO sacó la última vez
  const todosIdsKey = [...equipo1, ...equipo2].sort((a, b) => a - b).join(',')
  useEffect(() => {
    if (equipo1.length === 0 || equipo2.length === 0) { setUltimoSaqueId(null); return }
    const ids = [...equipo1, ...equipo2]
    api.getSugerenciaSaque(ids)
      .then(({ ultimo_saque_id }) => {
        setUltimoSaqueId(ultimo_saque_id)
        if (ultimo_saque_id) {
          const sugerido = ids.find(id => id !== ultimo_saque_id)
          if (sugerido) setPrimerJugador(sugerido)
        }
      })
      .catch(() => setUltimoSaqueId(null))
  }, [todosIdsKey])

  // Auto-fill team name from saved combos
  useEffect(() => {
    if (equipo1.length === 0) return
    api.lookupNombreEquipo(equipo1).then(ne => { if (ne) setNombre1(ne.nombre) }).catch(() => {})
  }, [equipo1.join(',')])

  useEffect(() => {
    if (equipo2.length === 0) return
    api.lookupNombreEquipo(equipo2).then(ne => { if (ne) setNombre2(ne.nombre) }).catch(() => {})
  }, [equipo2.join(',')])

  function setEquipo1Safe(ids) {
    setEquipo1(ids)
    setPrimerJugador(prev => {
      if (prev && (ids.includes(prev) || equipo2.includes(prev))) return prev
      return ids[0] ?? equipo2[0] ?? null
    })
  }

  function setEquipo2Safe(ids) {
    setEquipo2(ids)
    setPrimerJugador(prev => {
      if (prev && (equipo1.includes(prev) || ids.includes(prev))) return prev
      return equipo1[0] ?? ids[0] ?? null
    })
  }

  async function crear() {
    if (equipo1.length === 0 || equipo2.length === 0) {
      setError('Cada equipo necesita al menos un jugador')
      return
    }
    setError(null)
    setCreando(true)
    try {
      const n1 = nombre1.trim()
      const n2 = nombre2.trim()
      const p = await api.crearPartida({
        modalidad,
        equipo1: { jugador_ids: equipo1 },
        equipo2: { jugador_ids: equipo2 },
        primer_jugador_id: primerJugador,
        equipo1_nombre: n1 || null,
        equipo2_nombre: n2 || null,
      })
      // Persist team names for future auto-fill
      if (n1) api.upsertNombreEquipo(equipo1, n1).catch(() => {})
      if (n2) api.upsertNombreEquipo(equipo2, n2).catch(() => {})
      navigate(`/partida/${p.id}`, { state: { logrosNuevos: p.logros_nuevos } })
    } catch (err) {
      setError(err.message)
      setCreando(false)
    }
  }

  function nombresDe(ids) {
    return ids.map(id => (jugadores || []).find(j => j.id === id)?.nombre).filter(Boolean).join(', ')
  }

  function aplicarPlantilla(p) {
    const activos = new Set((jugadores || []).filter(j => j.activo !== false).map(j => j.id))
    const e1 = (p.equipo1 || []).filter(id => activos.has(id))
    const e2 = (p.equipo2 || []).filter(id => activos.has(id))
    setModalidad(p.modalidad || 'bola8')
    setEquipo1(e1)
    setEquipo2(e2)
    setNombre1(p.nombre1 || '')
    setNombre2(p.nombre2 || '')
    setPrimerJugador(e1[0] ?? e2[0] ?? null)
  }

  function guardarComoPlantilla() {
    const nom = nombrePlantilla.trim() || `${nombre1.trim() || 'Equipo 1'} vs ${nombre2.trim() || 'Equipo 2'}`
    const nueva = {
      id: Date.now(), nombre: nom, modalidad,
      equipo1, equipo2, nombre1: nombre1.trim(), nombre2: nombre2.trim(),
    }
    const next = [nueva, ...plantillas].slice(0, 6)
    setPlantillas(next); persistirPlantillas(next)
    setGuardandoPlantilla(false); setNombrePlantilla('')
  }

  function borrarPlantilla(pid) {
    const next = plantillas.filter(p => p.id !== pid)
    setPlantillas(next); persistirPlantillas(next)
  }

  if (loading) return <SkeletonList n={3} />

  // Solo jugadores activos en la pantalla de nueva partida
  const jList = (jugadores || []).filter(j => j.activo !== false)
  const listo = equipo1.length > 0 && equipo2.length > 0

  const Tabs = () => (
    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
      {[['manual','Manual'],['mix','🎲 Mix']].map(([v,l]) => (
        <button key={v} onClick={() => setTab(v)} style={{
          padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          border: tab === v ? '1.5px solid var(--accent)' : '1px solid var(--border)',
          background: tab === v ? 'var(--accent-bg)' : 'var(--surface2)',
          color: tab === v ? 'var(--accent)' : 'var(--text-dim)',
          transition: 'all .15s',
        }}>{l}</button>
      ))}
    </div>
  )

  // Desktop: formulario centrado — a 1400px de ancho un form de creación se pierde
  const contenedor = desktop
    ? { display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 960, margin: '0 auto', width: '100%' }
    : { display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }

  if (tab === 'mix') return (
    <div style={{ ...contenedor, maxWidth: desktop ? 1100 : undefined }}>
      <Tabs />
      <Sugerencias />
    </div>
  )

  return (
    <div style={contenedor}>
      <Tabs />

      {/* Plantillas de grupo habitual */}
      {jList.length > 0 && plantillas.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', margin: 0 }}>
            Plantillas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plantillas.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => aplicarPlantilla(p)} style={{
                  flex: 1, textAlign: 'left', cursor: 'pointer', minWidth: 0,
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '8px 10px', color: 'var(--text)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>▶ {p.nombre}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nombresDe(p.equipo1)} vs {nombresDe(p.equipo2)} · {p.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
                  </span>
                </button>
                <button onClick={() => borrarPlantilla(p.id)} title="Borrar plantilla" style={{
                  background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer',
                  padding: '0 4px', flexShrink: 0,
                }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modalidad */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', margin: 0 }}>
            Modalidad
          </p>
          <Link to={`/reglas?modo=${modalidad}`} style={{ fontSize: 11, color: 'var(--text-dim)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: 'var(--accent)', fontSize: 13 }}>ℹ</span><span>Ver reglas</span>
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['bola8', '⚫ Bola 8'], ['bola9', '🟡 Bola 9']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setModalidad(val)}
              style={{
                flex: 1, padding: '10px',
                borderRadius: 8, fontSize: '15px', fontWeight: 700,
                border: modalidad === val ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: modalidad === val ? 'rgba(6,182,212, 0.13)' : 'var(--surface2)',
                color: modalidad === val ? 'var(--accent)' : 'var(--text)',
                transition: 'all .15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {jList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 16px' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 12 }}>Primero añade jugadores</p>
          <button className="btn btn-primary" onClick={() => navigate('/jugadores')}>
            Ir a Jugadores
          </button>
        </div>
      ) : (
        <>
          {/* Desktop: equipos lado a lado */}
          <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: 'var(--gap)', alignItems: 'start' }}>
            <SelectorEquipo
              titulo="Equipo 1" teamNum={1}
              nombre={nombre1} onNombreChange={setNombre1}
              jugadores={jList}
              seleccionados={equipo1}
              onChange={setEquipo1Safe}
              excluidos={equipo2}
              statsMap={statsMap}
              mostrarOrden={ajustes}
            />
            <SelectorEquipo
              titulo="Equipo 2" teamNum={2}
              nombre={nombre2} onNombreChange={setNombre2}
              jugadores={jList}
              seleccionados={equipo2}
              onChange={setEquipo2Safe}
              excluidos={equipo1}
              statsMap={statsMap}
              mostrarOrden={ajustes}
            />
          </div>

          {/* Ajustes opcionales — plegados por defecto (orden, quién saca, plantilla) */}
          {listo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setAjustes(v => !v)}
                  className="btn btn-ghost"
                  style={{ fontSize: 13, color: ajustes ? 'var(--accent)' : 'var(--text-dim)', padding: '6px 12px' }}
                >
                  Ajustes {ajustes ? '▲' : '▼'}
                </button>
                {!ajustes && primerJugador && (
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    Saca: <strong style={{ color: 'var(--text)' }}>{jList.find(j => j.id === primerJugador)?.nombre}</strong>
                  </span>
                )}
              </div>

              {ajustes && (
                <>
                  {/* ¿Quién saca? */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', margin: 0 }}>
                        ¿Quién saca?
                      </p>
                      {ultimoSaqueId && (
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          última vez: {jList.find(j => j.id === ultimoSaqueId)?.nombre ?? `#${ultimoSaqueId}`}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {[...equipo1, ...equipo2].map(id => {
                        const j = jList.find(j => j.id === id)
                        const sel = primerJugador === id
                        const enEq2 = equipo2.includes(id)
                        const esUltimo = ultimoSaqueId === id
                        return (
                          <button
                            key={id}
                            onClick={() => setPrimerJugador(id)}
                            style={{
                              padding: '8px 14px', borderRadius: 8, fontSize: '14px', fontWeight: 600,
                              border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                              background: sel ? 'var(--accent-bg)' : 'var(--surface2)',
                              color: sel ? 'var(--accent)' : 'var(--text-dim)',
                              transition: 'background .15s, border-color .15s',
                              opacity: esUltimo && !sel ? 0.5 : 1,
                            }}
                          >
                            {sel ? '✓ ' : ''}{j?.nombre}
                            <span style={{ fontSize: '11px', marginLeft: 5, color: enEq2 ? 'var(--team2)' : 'var(--team1)', opacity: .8 }}>Eq{enEq2 ? 2 : 1}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Guardar como plantilla */}
                  {!guardandoPlantilla ? (
                    <button
                      className="btn btn-ghost btn-full"
                      onClick={() => setGuardandoPlantilla(true)}
                      style={{ fontSize: 13, color: 'var(--text-dim)' }}
                    >
                      ☆ Guardar como plantilla
                    </button>
                  ) : (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        value={nombrePlantilla}
                        onChange={e => setNombrePlantilla(e.target.value)}
                        placeholder={`${nombre1.trim() || 'Equipo 1'} vs ${nombre2.trim() || 'Equipo 2'}`}
                        maxLength={32}
                        style={{ fontSize: 14, padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-full" onClick={guardarComoPlantilla}>Guardar</button>
                        <button className="btn btn-ghost btn-full" onClick={() => { setGuardandoPlantilla(false); setNombrePlantilla('') }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <p style={{ color: 'var(--accent)', fontSize: '14px', textAlign: 'center' }}>{error}</p>
      )}

      <button
        className="btn btn-primary btn-full"
        onClick={crear}
        disabled={creando || !listo}
        style={{ padding: '15px', fontSize: '17px', marginTop: 4, borderRadius: 10 }}
      >
        {creando ? 'Creando…' : listo ? '▶ Empezar partida' : 'Selecciona los equipos'}
      </button>
    </div>
  )
}
