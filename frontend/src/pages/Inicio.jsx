import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'
import { SkeletonList } from '../components/Skeleton'
import AvatarJugador from '../components/AvatarJugador'

function nombreJugador(id, jugadores) {
  return jugadores?.find(j => j.id === id)?.nombre ?? `#${id}`
}

function duracionMin(fecha, fechaFin) {
  if (!fechaFin) return null
  const ms = new Date(fechaFin) - new Date(fecha)
  const min = Math.floor(ms / 60_000)
  const seg = Math.floor((ms % 60_000) / 1_000)
  return `${min}' ${String(seg).padStart(2, '0')}"`
}

function etiquetaDia(isoStr) {
  const d   = new Date(isoStr)
  const hoy  = new Date()
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
  const mismaFecha = (a, b) => a.toLocaleDateString('es-ES') === b.toLocaleDateString('es-ES')
  if (mismaFecha(d, hoy))  return 'Hoy'
  if (mismaFecha(d, ayer)) return 'Ayer'
  const diffDias = Math.floor((hoy - d) / 86_400_000)
  if (diffDias < 7) return d.toLocaleDateString('es-ES', { weekday: 'long' })
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

function agruparPorDia(partidas) {
  const map = {}
  for (const p of partidas) {
    const clave = new Date(p.fecha).toLocaleDateString('es-ES')
    if (!map[clave]) map[clave] = { clave, fechaRef: p.fecha, partidas: [] }
    map[clave].partidas.push(p)
  }
  return Object.values(map).sort((a, b) => new Date(b.fechaRef) - new Date(a.fechaRef))
}

function duracionSesion(partidas) {
  const totalMs = partidas.reduce((acc, p) => {
    if (!p.fecha_fin) return acc
    return acc + (new Date(p.fecha_fin) - new Date(p.fecha))
  }, 0)
  if (totalMs === 0) return null
  const totalMin = Math.floor(totalMs / 60_000)
  if (totalMin < 60) return `${totalMin}'`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}'` : `${h}h`
}

function SesionHeader({ etiqueta, count, duracion, colapsada, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
        marginBottom: colapsada ? 0 : 8,
      }}
    >
      <span style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0, lineHeight: 1 }}>
        {colapsada ? '▶' : '▼'}
      </span>
      <span style={{
        fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.06em', color: 'var(--text-dim)', flexShrink: 0,
      }}>
        {etiqueta}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>
        {count} partida{count !== 1 ? 's' : ''}{duracion ? ` · ${duracion}` : ''}
      </span>
    </button>
  )
}

function ChipFiltro({ label, activo, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: '12px', fontWeight: 600,
      border: activo ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      background: activo ? 'var(--accent-bg)' : 'var(--surface2)',
      color: activo ? 'var(--accent)' : 'var(--text-dim)',
      cursor: 'pointer', transition: 'all .15s',
    }}>{label}</button>
  )
}

export default function Inicio() {
  const { data: partidas, loading, error, reload } = useApi(api.getPartidas)
  const { data: jugadores } = useApi(api.getJugadores)
  const { data: torneos } = useApi(api.getTorneos)
  const navigate = useNavigate()
  const [filtroEstado, setFiltroEstado]   = useState('todas')
  const touchStartY = useRef(0)
  const [pullY, setPullY]   = useState(0)
  const [pulling, setPulling] = useState(false)

  function onTouchStart(e) {
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (document.documentElement.scrollTop > 5) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) {
      setPullY(Math.min(dy * 0.4, 56))
      setPulling(dy > 70)
    }
  }
  function onTouchEnd() {
    if (pulling) reload()
    setPullY(0)
    setPulling(false)
  }
  const [filtroModal, setFiltroModal]     = useState('todas')
  const [filtrosJugadores, setFiltrosJugadores] = useState(new Set())
  const [panelJugadores, setPanelJugadores]     = useState(false)
  const [colapsadas, setColapsadas]       = useState(new Set())

  function toggleJugador(id) {
    setFiltrosJugadores(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSesion(clave) {
    setColapsadas(prev => {
      const next = new Set(prev)
      next.has(clave) ? next.delete(clave) : next.add(clave)
      return next
    })
  }

  if (loading) return <SkeletonList n={4} />
  if (error) return <p style={{ color: 'var(--accent)', padding: '20px 0' }}>Error: {error}</p>

  const todasLasPartidas = partidas ?? []

  const partidasFiltradas = todasLasPartidas
    .filter(p => filtroEstado === 'todas' || p.estado === filtroEstado)
    .filter(p => filtroModal  === 'todas' || p.modalidad === filtroModal)
    .filter(p => filtrosJugadores.size === 0 ||
      [...filtrosJugadores].every(id => [...p.equipo1_jugadores, ...p.equipo2_jugadores].includes(id)))

  const enCurso     = partidasFiltradas.filter(p => p.estado === 'en_curso')
  const finalizadas = partidasFiltradas.filter(p => p.estado === 'finalizada')
  const sesiones    = agruparPorDia(finalizadas)

  const hayFiltroActivo = filtroEstado !== 'todas' || filtroModal !== 'todas' || filtrosJugadores.size > 0

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {pullY > 8 && (
        <div style={{
          height: pullY, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'var(--text-dim)', transition: pulling ? 'none' : 'height .2s',
          overflow: 'hidden',
        }}>
          {pulling ? '↑ Suelta para actualizar' : '↓ Arrastra para actualizar'}
        </div>
      )}

      {todasLasPartidas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: 12 }}>🎱</div>
          <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>Sin partidas todavía</p>
          <button className="btn btn-primary" onClick={() => navigate('/nueva')}>
            ▶ Crear primera partida
          </button>
        </div>
      )}

      {/* Widget torneos activos */}
      {(torneos ?? []).filter(t => t.estado === 'en_curso').map(t => {
        const pct = t.total > 0 ? (t.jugados / t.total) * 100 : 0
        const pendientes = t.total - t.jugados
        return (
          <button key={t.id} onClick={() => navigate(`/torneo/${t.id}`)} style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: 'rgba(234,179,8,.07)', border: '1px solid rgba(234,179,8,.25)',
            borderRadius: 12, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🏆</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.nombre}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                  {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ height: 3, background: 'rgba(234,179,8,.2)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#fbbf24', borderRadius: 2, transition: 'width .3s' }} />
              </div>
            </div>
            <span style={{ fontSize: 14, color: '#fbbf24', flexShrink: 0 }}>›</span>
          </button>
        )
      })}

      {/* Filtros — solo cuando hay partidas */}
      {todasLasPartidas.length > 0 && (() => {
        const idsEnPartidas = new Set(todasLasPartidas.flatMap(p => [...p.equipo1_jugadores, ...p.equipo2_jugadores]))
        const jugadoresConPartidas = (jugadores ?? []).filter(j => idsEnPartidas.has(j.id))
        const hayJugadores = jugadoresConPartidas.length >= 2
        return (
          <div style={{
            position: 'sticky', top: 'var(--nav-height)', zIndex: 50,
            background: 'var(--bg)', padding: '10px 16px 6px', margin: '0 -16px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <ChipFiltro label="Todas"       activo={filtroEstado === 'todas'}      onClick={() => setFiltroEstado('todas')} />
              <ChipFiltro label="En curso"    activo={filtroEstado === 'en_curso'}   onClick={() => setFiltroEstado('en_curso')} />
              <ChipFiltro label="Finalizadas" activo={filtroEstado === 'finalizada'} onClick={() => setFiltroEstado('finalizada')} />
              <div style={{ width: 1, background: 'var(--border)', margin: '0 2px' }} />
              <ChipFiltro label="Bola 8" activo={filtroModal === 'bola8'} onClick={() => setFiltroModal(filtroModal === 'bola8' ? 'todas' : 'bola8')} />
              <ChipFiltro label="Bola 9" activo={filtroModal === 'bola9'} onClick={() => setFiltroModal(filtroModal === 'bola9' ? 'todas' : 'bola9')} />
              {hayJugadores && (
                <button
                  onClick={() => setPanelJugadores(v => !v)}
                  style={{
                    padding: '5px 10px', borderRadius: 20, fontSize: '12px', fontWeight: 600,
                    border: filtrosJugadores.size > 0 ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: filtrosJugadores.size > 0 ? 'var(--accent-bg)' : 'var(--surface2)',
                    color: filtrosJugadores.size > 0 ? 'var(--accent)' : 'var(--text-dim)',
                    cursor: 'pointer', transition: 'all .15s',
                    display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1,
                  }}
                >
                  <span style={{ fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center' }}>👥</span>
                  {filtrosJugadores.size > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>{filtrosJugadores.size}</span>
                  )}
                  <span style={{ fontSize: '9px', opacity: .7 }}>{panelJugadores ? '▲' : '▼'}</span>
                </button>
              )}
            </div>

            {/* Panel jugadores desplegable */}
            {panelJugadores && hayJugadores && (
              <div style={{
                borderRadius: 10, overflow: 'hidden',
                background: 'var(--surface2)', border: '1px solid var(--border)',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 12px', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)' }}>
                    Filtrar por jugador
                  </span>
                  <button
                    onClick={() => setFiltrosJugadores(new Set())}
                    disabled={filtrosJugadores.size === 0}
                    title="Quitar filtros"
                    style={{
                      background: 'none', border: 'none', cursor: filtrosJugadores.size > 0 ? 'pointer' : 'default',
                      fontSize: '15px', lineHeight: 1, padding: '2px 4px', borderRadius: 4,
                      color: filtrosJugadores.size > 0 ? '#fca5a5' : 'var(--border)',
                      transition: 'color .15s',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1 2.5h14l-5.5 6.5V13l-3-1.5V9L1 2.5z" opacity=".55" />
                      <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px' }}>
                {jugadoresConPartidas.map(j => {
                  const sel = filtrosJugadores.has(j.id)
                  return (
                    <button
                      key={j.id}
                      onClick={() => toggleJugador(j.id)}
                      style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: '12px', fontWeight: 600,
                        border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: sel ? 'var(--accent-bg)' : 'transparent',
                        color: sel ? 'var(--accent)' : 'var(--text-dim)',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      {sel ? '✓ ' : ''}{j.nombre}
                    </button>
                  )
                })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Sin resultados con filtro activo */}
      {hayFiltroActivo && partidasFiltradas.length === 0 && (
        <p style={{ color: 'var(--text-dim)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
          Sin partidas con este filtro
        </p>
      )}

      {enCurso.length > 0 && (
        <section>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 8 }}>
            En curso
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enCurso.map(p => <PartidaCard key={p.id} p={p} jugadores={jugadores} onClick={() => navigate(`/partida/${p.id}`)} />)}
          </div>
        </section>
      )}

      {sesiones.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sesiones.map(s => {
            const colapsada = colapsadas.has(s.clave)
            return (
              <div key={s.clave}>
                <SesionHeader
                  etiqueta={etiquetaDia(s.fechaRef)}
                  count={s.partidas.length}
                  duracion={duracionSesion(s.partidas)}
                  colapsada={colapsada}
                  onClick={() => toggleSesion(s.clave)}
                />
                {!colapsada && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {s.partidas.map(p => (
                      <PartidaCard key={p.id} p={p} jugadores={jugadores} onClick={() => navigate(`/partida/${p.id}`)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

function jugadoresDeEquipo(ids, jugadores) {
  return ids.map(id => jugadores?.find(j => j.id === id)).filter(Boolean)
}

function PartidaCard({ p, jugadores, onClick }) {
  const finalizada = p.estado === 'finalizada'
  const eq1js = jugadoresDeEquipo(p.equipo1_jugadores, jugadores)
  const eq2js = jugadoresDeEquipo(p.equipo2_jugadores, jugadores)
  const eq1nombres = p.equipo1_nombre || p.equipo1_jugadores.map(id => nombreJugador(id, jugadores)).join(', ')
  const eq2nombres = p.equipo2_nombre || p.equipo2_jugadores.map(id => nombreJugador(id, jugadores)).join(', ')

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'var(--surface)', color: 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 14,
        transition: 'border-color .15s, transform .1s',
        animation: 'slideUp .2s ease both',
      }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(.985)'}
      onTouchEnd={e => e.currentTarget.style.transform = ''}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
            {p.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
            <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '13px' }}> · #{p.numero}</span>
          </span>
          {p.torneo_nombre && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
              background: 'rgba(234,179,8,.12)', color: '#fbbf24',
              border: '1px solid rgba(234,179,8,.25)', flexShrink: 0,
            }}>🏆 {p.torneo_nombre}</span>
          )}
        </div>
        <span className={`badge ${finalizada ? 'badge-fin' : 'badge-curso'}`}>
          {finalizada ? 'Finalizada' : 'En curso'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <EquipoInfo
          nombres={eq1nombres}
          jugadoresObj={eq1js}
          grupo={p.equipo1_grupo}
          ganador={finalizada && p.ganador_equipo === 1}
          align="left"
        />
        <span style={{ color: 'var(--text-dim)', fontSize: '12px', flexShrink: 0 }}>vs</span>
        <EquipoInfo
          nombres={eq2nombres}
          jugadoresObj={eq2js}
          grupo={p.equipo2_grupo}
          ganador={finalizada && p.ganador_equipo === 2}
          align="right"
        />
      </div>

      {!finalizada && p.siguiente_jugador_id && jugadores && (
        <p style={{ fontSize: '11px', marginTop: 6,
          color: p.equipo1_jugadores.includes(p.siguiente_jugador_id) ? 'var(--team1)' : 'var(--team2)' }}>
          Turno: {nombreJugador(p.siguiente_jugador_id, jugadores)}
        </p>
      )}
      {finalizada && p.fecha_fin && (
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 4 }}>
          {duracionMin(p.fecha, p.fecha_fin) && `⏱ ${duracionMin(p.fecha, p.fecha_fin)} · `}
          Fin: {new Date(p.fecha_fin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </button>
  )
}

function EquipoInfo({ nombres, jugadoresObj, grupo, ganador, align }) {
  const avatars = (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      {jugadoresObj.map((j, i) => (
        <div key={j.id} style={{ marginLeft: i > 0 ? -6 : 0 }}>
          <AvatarJugador nombre={j.nombre} color={j.color} size={22} />
        </div>
      ))}
    </div>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1,
      flexDirection: align === 'right' ? 'row-reverse' : 'row',
    }}>
      {jugadoresObj.length > 0 && avatars}
      <span style={{
        fontSize: '13px', fontWeight: ganador ? 700 : 600,
        color: ganador ? '#fcd34d' : 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {ganador ? '🏆 ' : ''}{nombres}
      </span>
      {grupo && <span className={`badge badge-${grupo}`} style={{ fontSize: '10px', padding: '1px 6px', flexShrink: 0 }}>{grupo.charAt(0).toUpperCase() + grupo.slice(1)}</span>}
    </div>
  )
}
