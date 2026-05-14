import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'

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
  const { data: partidas, loading, error } = useApi(api.getPartidas)
  const { data: jugadores } = useApi(api.getJugadores)
  const navigate = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [filtroModal, setFiltroModal]   = useState('todas')
  const [colapsadas, setColapsadas]     = useState(new Set())

  function toggleSesion(clave) {
    setColapsadas(prev => {
      const next = new Set(prev)
      next.has(clave) ? next.delete(clave) : next.add(clave)
      return next
    })
  }

  if (loading) return <div className="spinner" />
  if (error) return <p style={{ color: 'var(--accent)', padding: '20px 0' }}>Error: {error}</p>

  const todasLasPartidas = partidas ?? []

  const partidasFiltradas = todasLasPartidas
    .filter(p => filtroEstado === 'todas' || p.estado === filtroEstado)
    .filter(p => filtroModal  === 'todas' || p.modalidad === filtroModal)

  const enCurso     = partidasFiltradas.filter(p => p.estado === 'en_curso')
  const finalizadas = partidasFiltradas.filter(p => p.estado === 'finalizada')
  const sesiones    = agruparPorDia(finalizadas)

  const hayFiltroActivo = filtroEstado !== 'todas' || filtroModal !== 'todas'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {todasLasPartidas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: 12 }}>🎱</div>
          <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>Sin partidas todavía</p>
          <button className="btn btn-primary" onClick={() => navigate('/nueva')}>
            ▶ Crear primera partida
          </button>
        </div>
      )}

      {/* Filtros — solo cuando hay partidas */}
      {todasLasPartidas.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ChipFiltro label="Todas"      activo={filtroEstado === 'todas'}      onClick={() => setFiltroEstado('todas')} />
          <ChipFiltro label="En curso"   activo={filtroEstado === 'en_curso'}   onClick={() => setFiltroEstado('en_curso')} />
          <ChipFiltro label="Finalizadas" activo={filtroEstado === 'finalizada'} onClick={() => setFiltroEstado('finalizada')} />
          <div style={{ width: 1, background: 'var(--border)', margin: '0 2px' }} />
          <ChipFiltro label="Bola 8" activo={filtroModal === 'bola8'} onClick={() => setFiltroModal(filtroModal === 'bola8' ? 'todas' : 'bola8')} />
          <ChipFiltro label="Bola 9" activo={filtroModal === 'bola9'} onClick={() => setFiltroModal(filtroModal === 'bola9' ? 'todas' : 'bola9')} />
        </div>
      )}

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

function PartidaCard({ p, jugadores, onClick }) {
  const finalizada = p.estado === 'finalizada'
  const eq1nombres = p.equipo1_jugadores.map(id => nombreJugador(id, jugadores)).join(', ')
  const eq2nombres = p.equipo2_jugadores.map(id => nombreJugador(id, jugadores)).join(', ')

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
        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
          {p.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
          <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '13px' }}> · #{p.numero}</span>
        </span>
        <span className={`badge ${finalizada ? 'badge-fin' : 'badge-curso'}`}>
          {finalizada ? 'Finalizada' : 'En curso'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <EquipoInfo
          nombres={eq1nombres}
          grupo={p.equipo1_grupo}
          ganador={finalizada && p.ganador_equipo === 1}
          teamColor="var(--team1)"
        />
        <span style={{ color: 'var(--text-dim)', fontSize: '12px', flexShrink: 0 }}>vs</span>
        <EquipoInfo
          nombres={eq2nombres}
          grupo={p.equipo2_grupo}
          ganador={finalizada && p.ganador_equipo === 2}
          teamColor="var(--team2)"
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

function EquipoInfo({ nombres, grupo, ganador, teamColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: ganador ? '#fcd34d' : teamColor ?? 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ganador ? '🏆 ' : ''}{nombres}
      </span>
      {grupo && <span className={`badge badge-${grupo}`} style={{ fontSize: '10px', padding: '1px 6px', flexShrink: 0 }}>{grupo.charAt(0).toUpperCase() + grupo.slice(1)}</span>}
    </div>
  )
}
