import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'
import { useSessionState } from '../hooks/useSessionState'
import { SkeletonList } from '../components/Skeleton'
import AvatarJugador from '../components/AvatarJugador'
import { agruparPorSesion, marcadorSesion, duracionSesion } from '../utils/sesiones'
import { useMediaQuery } from '../hooks/useMediaQuery'
import Chip from '../components/Chip'

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

function SesionHeader({ etiqueta, hora, count, duracion, colapsada, onClick }) {
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
        {etiqueta}{hora ? ` · ${hora}` : ''}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>
        {count} partida{count !== 1 ? 's' : ''}{duracion ? ` · ${duracion}` : ''}
      </span>
    </button>
  )
}

function MarcadorNoche({ sesion, jugadores, onVerJugador }) {
  const marcador = marcadorSesion(sesion.partidas, jugadores)
  if (marcador.length < 2) return null
  const maxV = marcador[0].victorias
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,.10), rgba(99,102,241,.03))',
      border: '1px solid rgba(99,102,241,.25)', borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#a5b4fc' }}>🌙 Marcador de la noche</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
          {etiquetaDia(sesion.fechaRef)} · {sesion.partidas.length} partidas
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {marcador.map((m, i) => {
          const lider = m.victorias === maxV && maxV > 0
          return (
            <button
              key={m.id}
              className="hoverable"
              onClick={() => m.jugador && onVerJugador(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'none', border: 'none', padding: '2px 0',
                cursor: m.jugador ? 'pointer' : 'default', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', width: 16, flexShrink: 0 }}>
                {i + 1}
              </span>
              {m.jugador
                ? <AvatarJugador nombre={m.jugador.nombre} color={m.jugador.color} size={24} />
                : <div style={{ width: 24, height: 24, flexShrink: 0 }} />}
              <span style={{
                flex: 1, minWidth: 0, fontSize: 14, fontWeight: lider ? 800 : 600,
                color: lider ? '#fcd34d' : 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {lider ? '🏆 ' : ''}{m.jugador?.nombre ?? `#${m.id}`}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', flexShrink: 0 }}>
                {m.victorias}
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)' }}>/{m.jugadas}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Inicio() {
  const { data: partidas, loading, error, reload } = useApi(api.getPartidas)
  const { data: jugadores } = useApi(api.getJugadores)
  const { data: torneos } = useApi(api.getTorneos)
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [filtroEstado, setFiltroEstado]   = useSessionState('inicio_filtro_estado', 'todas')
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
  const [colapsadas, setColapsadas]       = useState(new Set())

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

  const enCurso     = partidasFiltradas.filter(p => p.estado === 'en_curso')
  const finalizadas = partidasFiltradas.filter(p => p.estado === 'finalizada')
  const sesiones    = agruparPorSesion(finalizadas)

  // Marcador de la noche: sesión más reciente sobre TODAS las finalizadas (estable ante filtros).
  // Solo se muestra si la sesión es de hoy o anoche — un marcador "de la noche" de
  // hace días desfasa (jueves mostrando el del sábado).
  const sesionRecienteRaw = agruparPorSesion(todasLasPartidas.filter(p => p.estado === 'finalizada'))[0]
  const sesionEsReciente = sesionRecienteRaw && (() => {
    const d = new Date(sesionRecienteRaw.fechaRef)
    const hoy = new Date()
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
    const mismaFecha = (a, b) => a.toLocaleDateString('es-ES') === b.toLocaleDateString('es-ES')
    return mismaFecha(d, hoy) || mismaFecha(d, ayer)
  })()
  const sesionReciente = sesionEsReciente ? sesionRecienteRaw : null

  const hayFiltroActivo = filtroEstado !== 'todas'

  // Móvil: cards verticales. Desktop: filas horizontales densas (1 col).
  const gridCards = { display: 'grid', gap: 8, gridTemplateColumns: '1fr' }

  // ── Bloques (única fuente — móvil y desktop los disponen distinto) ──

  const bloqueTorneos = (torneos ?? []).filter(t => t.estado === 'en_curso').map(t => {
    const pct = t.total > 0 ? (t.jugados / t.total) * 100 : 0
    const pendientes = t.total - t.jugados
    return (
      <button key={t.id} className="hoverable" onClick={() => navigate(`/torneo/${t.id}`)} style={{
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
  })

  const bloqueMarcador = filtroEstado !== 'en_curso' && sesionReciente && (
    <MarcadorNoche sesion={sesionReciente} jugadores={jugadores} onVerJugador={() => navigate('/jugadores')} />
  )

  const bloqueFiltros = todasLasPartidas.length > 0 && (
    <div style={desktop
      ? { display: 'flex', gap: 6, flexWrap: 'wrap' }
      : {
          position: 'sticky', top: 'var(--nav-height)', zIndex: 50,
          background: 'var(--bg)', padding: '14px 16px 6px', margin: '0 -16px',
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }
    }>
      <Chip label="Todas"       activo={filtroEstado === 'todas'}      onClick={() => setFiltroEstado('todas')} />
      <Chip label="En curso"    activo={filtroEstado === 'en_curso'}   onClick={() => setFiltroEstado('en_curso')} />
      <Chip label="Finalizadas" activo={filtroEstado === 'finalizada'} onClick={() => setFiltroEstado('finalizada')} />
    </div>
  )

  const bloqueListado = (
    <>
      {hayFiltroActivo && partidasFiltradas.length === 0 && (
        <p style={{ color: 'var(--text-dim)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
          Sin partidas con este filtro
        </p>
      )}

      {enCurso.length > 0 && (
        <section>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--accent)', marginBottom: 8 }}>
            ▶ Continuar
          </p>
          <div style={gridCards}>
            {enCurso.map(p => <PartidaCard key={p.id} p={p} jugadores={jugadores} continuar horizontal={desktop} onClick={() => navigate(`/partida/${p.id}`)} />)}
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
                  hora={new Date(s.fechaInicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  count={s.partidas.length}
                  duracion={duracionSesion(s.partidas)}
                  colapsada={colapsada}
                  onClick={() => toggleSesion(s.clave)}
                />
                {!colapsada && (
                  <div style={gridCards}>
                    {s.partidas.map(p => (
                      <PartidaCard key={p.id} p={p} jugadores={jugadores} horizontal={desktop} onClick={() => navigate(`/partida/${p.id}`)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}
    </>
  )

  const vacio = todasLasPartidas.length === 0 && (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '48px', marginBottom: 12 }}>🎱</div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>Sin partidas todavía</p>
      <button className="btn btn-primary" onClick={() => navigate('/nueva')}>
        ▶ Crear primera partida
      </button>
    </div>
  )

  // ── Desktop: columna única centrada, mismo orden que móvil — sin aside que
  //    deje columnas medio vacías cuando hay poco contenido lateral ──
  if (desktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860, margin: '0 auto', width: '100%' }}>
        {vacio}
        {bloqueTorneos}
        {bloqueMarcador}
        {bloqueFiltros}
        {bloqueListado}
      </div>
    )
  }

  // ── Móvil: stack vertical con pull-to-refresh ──
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

      {vacio}
      {bloqueTorneos}
      {bloqueMarcador}
      {bloqueFiltros}
      {bloqueListado}
    </div>
  )
}

function jugadoresDeEquipo(ids, jugadores) {
  return ids.map(id => jugadores?.find(j => j.id === id)).filter(Boolean)
}

function PartidaCard({ p, jugadores, onClick, continuar = false, horizontal = false }) {
  const finalizada = p.estado === 'finalizada'
  const eq1js = jugadoresDeEquipo(p.equipo1_jugadores, jugadores)
  const eq2js = jugadoresDeEquipo(p.equipo2_jugadores, jugadores)
  const eq1nombres = p.equipo1_nombre || p.equipo1_jugadores.map(id => nombreJugador(id, jugadores)).join(', ')
  const eq2nombres = p.equipo2_nombre || p.equipo2_jugadores.map(id => nombreJugador(id, jugadores)).join(', ')

  const shellStyle = {
    width: '100%', textAlign: 'left', cursor: 'pointer',
    background: continuar ? 'var(--accent-bg)' : 'var(--surface)', color: 'var(--text)',
    border: continuar ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    transition: 'border-color .15s, transform .1s',
    animation: 'slideUp .2s ease both',
  }

  // ── Desktop: una sola línea densa — sin huecos de layout móvil estirado ──
  if (horizontal) {
    return (
      <button className="hoverable" onClick={onClick} style={{ ...shellStyle, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0, width: 86 }}>
            {p.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
            <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '12px' }}> #{p.numero}</span>
          </span>
          {p.torneo_nombre && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
              background: 'rgba(234,179,8,.12)', color: '#fbbf24',
              border: '1px solid rgba(234,179,8,.25)', flexShrink: 0,
              maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>🏆 {p.torneo_nombre}</span>
          )}
          {/* Equipos abrazando el vs, centrados en el espacio sobrante */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <EquipoInfo nombres={eq1nombres} jugadoresObj={eq1js} grupo={p.equipo1_grupo}
              ganador={finalizada && p.ganador_equipo === 1} align="left" compacto />
            <span style={{ color: 'var(--text-dim)', fontSize: '12px', flexShrink: 0 }}>vs</span>
            <EquipoInfo nombres={eq2nombres} jugadoresObj={eq2js} grupo={p.equipo2_grupo}
              ganador={finalizada && p.ganador_equipo === 2} align="right" compacto />
          </div>
          {finalizada && p.fecha_fin && (
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {duracionMin(p.fecha, p.fecha_fin) && `⏱ ${duracionMin(p.fecha, p.fecha_fin)} · `}
              {new Date(p.fecha_fin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!finalizada && p.siguiente_jugador_id && jugadores && (
            <span style={{ fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0,
              color: p.equipo1_jugadores.includes(p.siguiente_jugador_id) ? 'var(--team1)' : 'var(--team2)' }}>
              Turno: {nombreJugador(p.siguiente_jugador_id, jugadores)}
            </span>
          )}
          {continuar
            ? <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>Continuar →</span>
            : <span className={`badge ${finalizada ? 'badge-fin' : 'badge-curso'}`} style={{ flexShrink: 0 }}>
                {finalizada ? 'Finalizada' : 'En curso'}
              </span>}
        </div>
      </button>
    )
  }

  return (
    <button
      className="hoverable"
      onClick={onClick}
      style={{ ...shellStyle, padding: 14 }}
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

      {!finalizada && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          {p.siguiente_jugador_id && jugadores ? (
            <span style={{ fontSize: '11px',
              color: p.equipo1_jugadores.includes(p.siguiente_jugador_id) ? 'var(--team1)' : 'var(--team2)' }}>
              Turno: {nombreJugador(p.siguiente_jugador_id, jugadores)}
            </span>
          ) : <span />}
          {continuar && (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>Continuar →</span>
          )}
        </div>
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

function EquipoInfo({ nombres, jugadoresObj, grupo, ganador, align, compacto = false }) {
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
      display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
      // compacto: se encoge a su contenido (los nombres abrazan el "vs") en vez de estirarse
      flex: compacto ? '0 1 auto' : 1,
      maxWidth: compacto ? '45%' : undefined,
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
