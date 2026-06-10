import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useSessionState } from '../hooks/useSessionState'
import { api } from '../api/client'
import { pct, WinRateBar, fechaCorta } from '../components/stats/StatPrimitives'
import Chip from '../components/Chip'

function NombresEquipoSection({ statsMap }) {
  const { data: nombres, reload } = useApi(api.getNombresEquipo)
  const [confirmDel, setConfirmDel] = useState(null)
  const [expanded, setExpanded] = useState(false)

  if (!nombres || nombres.length === 0) return null

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-dim)' }}>
          Nombres de equipo
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{nombres.length}</span>
      </button>
      {expanded && (
        <div className="card" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nombres.map(ne => {
            const jugadores = ne.jugadores_key.split(',').map(id => statsMap[parseInt(id)]?.nombre ?? `#${id}`)
            return (
              <div key={ne.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--border-dim)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{ne.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{jugadores.join(' · ')}</div>
                </div>
                {confirmDel === ne.id ? (
                  <span style={{ display: 'flex', gap: 4 }}>
                    <button onClick={async () => { await api.eliminarNombreEquipo(ne.id); setConfirmDel(null); reload() }}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✓</button>
                    <button onClick={() => setConfirmDel(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDel(ne.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>✕</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const PALETA = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16', '#6366f1', '#f43f5e',
]

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ textAlign: 'center', flex: 1, padding: '8px 4px' }}>
      <div style={{ fontSize: '20px', fontWeight: 800, color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub != null && (
        <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600, marginTop: 1 }}>
          {sub} x turno
        </div>
      )}
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ModalidadChip({ label, ganadas, jugadas, color, falta }) {
  const p = pct(ganadas, jugadas)
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 3,
      background: 'var(--surface2)', borderRadius: 8, padding: '6px 10px',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-dim)' }}>
          {label}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 700, color }}>
          {ganadas}/{jugadas} · {p}%
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 2, transition: 'width .4s ease' }} />
      </div>
      {falta && (
        <span style={{ fontSize: '10px', color: '#fca5a5', marginTop: 1 }}>
          ⚠ {falta}
        </span>
      )}
    </div>
  )
}

function JugadorCard({ j, onReload, todosStats }) {
  const navigate = useNavigate()
  const coloresTomados = new Set(
    (todosStats ?? []).filter(s => s.id !== j.id && s.color).map(s => s.color)
  )
  const [activoLocal, setActivoLocal] = useState(j.activo)
  const [expandido, setExpandido] = useState(false)
  const [modo, setModo] = useState(null) // null | 'editar' | 'eliminar'
  const [nombreEdit, setNombreEdit] = useState(j.nombre)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [mostrarUltimas, setMostrarUltimas] = useState(false)
  const [ultimas, setUltimas] = useState(null)
  const [cargandoUltimas, setCargandoUltimas] = useState(false)
  const [mostrarH2H, setMostrarH2H] = useState(false)
  const [h2h, setH2H] = useState(null)
  const [cargandoH2H, setCargandoH2H] = useState(false)
  const [mostrarTorneos, setMostrarTorneos] = useState(false)
  const [torneos, setTorneos] = useState(null)
  const [cargandoTorneos, setCargandoTorneos] = useState(false)
  const [mostrarLogros, setMostrarLogros] = useState(false)
  const [logrosJugador, setLogrosJugador] = useState(null)
  const [cargandoLogros, setCargandoLogros] = useState(false)

  async function elegirColor(color) {
    const nuevo = j.color === color ? null : color  // tap mismo color → quitar
    try {
      await api.editarColorJugador(j.id, nuevo)
      onReload()
    } catch {}
  }

  async function toggleUltimas() {
    if (mostrarUltimas) { setMostrarUltimas(false); return }
    setMostrarUltimas(true)
    if (ultimas !== null) return
    setCargandoUltimas(true)
    try { setUltimas(await api.getUltimasPartidas(j.id)) }
    catch { setUltimas([]) }
    finally { setCargandoUltimas(false) }
  }

  async function toggleH2H() {
    if (mostrarH2H) { setMostrarH2H(false); return }
    setMostrarH2H(true)
    if (h2h !== null) return
    setCargandoH2H(true)
    try { setH2H(await api.getH2H(j.id)) }
    catch { setH2H([]) }
    finally { setCargandoH2H(false) }
  }

  async function toggleTorneos() {
    if (mostrarTorneos) { setMostrarTorneos(false); return }
    setMostrarTorneos(true)
    if (torneos !== null) return
    setCargandoTorneos(true)
    try { setTorneos(await api.getTorneosJugador(j.id)) }
    catch { setTorneos([]) }
    finally { setCargandoTorneos(false) }
  }

  async function toggleLogros() {
    if (mostrarLogros) { setMostrarLogros(false); return }
    setMostrarLogros(true)
    if (logrosJugador !== null) return
    setCargandoLogros(true)
    try { setLogrosJugador(await api.getLogrosJugador(j.id)) }
    catch { setLogrosJugador([]) }
    finally { setCargandoLogros(false) }
  }

  const tienePartidas = j.partidas_jugadas > 0

  async function guardarEdicion() {
    if (!nombreEdit.trim() || nombreEdit.trim() === j.nombre) { setModo(null); return }
    setCargando(true); setError(null)
    try {
      await api.editarJugador(j.id, nombreEdit.trim())
      setModo(null)
      onReload()
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  async function confirmarEliminar() {
    setCargando(true); setError(null)
    try {
      await api.eliminarJugador(j.id)
      onReload()
    } catch (e) { setError(e.message); setCargando(false) }
  }

  async function toggleActivo() {
    const nuevo = !activoLocal
    setActivoLocal(nuevo)
    try {
      await api.toggleActivoJugador(j.id)
      onReload()
    } catch {
      setActivoLocal(!nuevo)
    }
  }

  function cancelar() {
    setModo(null); setNombreEdit(j.nombre); setError(null)
  }

  function handleExpand() {
    const next = !expandido
    setExpandido(next)
    if (next && ultimas === null && !cargandoUltimas) {
      setCargandoUltimas(true)
      api.getUltimasPartidas(j.id)
        .then(d => setUltimas(d))
        .catch(() => setUltimas([]))
        .finally(() => setCargandoUltimas(false))
    }
  }

  return (
    <div className="card" style={{ opacity: activoLocal ? 1 : 0.55, transition: 'opacity .2s' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (modo || expandido) ? 12 : 0 }}>
        {modo === 'editar' ? (
          <input
            type="text"
            value={nombreEdit}
            onChange={e => setNombreEdit(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && guardarEdicion()}
            autoFocus
            style={{ flex: 1, marginRight: 8 }}
          />
        ) : (
          <button
            onClick={handleExpand}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', flex: 1, textAlign: 'left', padding: 0, minWidth: 0 }}
          >
            {j.color && (
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: j.color, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{j.nombre}</span>
            {j.racha_actual !== 0 && (
              <span style={{ fontSize: '11px', fontWeight: 700, flexShrink: 0, color: j.racha_actual > 0 ? '#86efac' : '#fca5a5' }}>
                {j.racha_actual > 0 ? `▲${j.racha_actual}` : `▼${Math.abs(j.racha_actual)}`}
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: 2 }}>{expandido ? '▲' : '▼'}</span>
          </button>
        )}

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {modo === null && (
            <>
              <div
                onClick={toggleActivo}
                title={activoLocal ? 'Desactivar jugador' : 'Activar jugador'}
                style={{
                  width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                  background: activoLocal ? 'var(--accent)' : 'var(--border)',
                  position: 'relative', transition: 'background .2s', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 8, background: '#fff',
                  position: 'absolute', top: 2,
                  left: activoLocal ? 18 : 2,
                  transition: 'left .2s',
                }} />
              </div>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => setModo('editar')}>Editar</button>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => setModo('eliminar')}>Eliminar</button>
            </>
          )}
          {modo === 'editar' && (
            <>
              <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }}
                onClick={guardarEdicion} disabled={cargando || !nombreEdit.trim()}>
                {cargando ? '…' : 'Guardar'}
              </button>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={cancelar}>Cancelar</button>
            </>
          )}
          {modo === 'eliminar' && (
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
              onClick={cancelar}>Cancelar</button>
          )}
        </div>
      </div>

      {/* Picker de color — solo en modo editar */}
      {modo === 'editar' && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>Color</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PALETA.map(c => {
              const esMio  = j.color === c
              const tomado = coloresTomados.has(c)
              return (
                <button
                  key={c}
                  onClick={() => !tomado && elegirColor(c)}
                  disabled={tomado}
                  title={tomado ? 'Color en uso' : c}
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: tomado ? 'var(--surface2)' : c,
                    border: esMio ? '2.5px solid #fff' : tomado ? `1px solid ${c}44` : '2px solid transparent',
                    cursor: tomado ? 'not-allowed' : 'pointer',
                    opacity: tomado ? 0.3 : 1, padding: 0, flexShrink: 0,
                    boxShadow: esMio ? `0 0 0 1px ${c}` : 'none',
                    transition: 'opacity .15s, border .15s',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Panel eliminar */}
      {modo === 'eliminar' && (
        <div style={{
          background: 'var(--surface2)', borderRadius: 8, padding: '12px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {tienePartidas ? (
            <p style={{ fontSize: '13px', color: '#fca5a5', lineHeight: 1.5 }}>
              ¿Eliminar a <strong style={{ color: 'var(--text)' }}>{j.nombre}</strong>?{' '}
              Tiene <strong>{j.partidas_jugadas}</strong> partida{j.partidas_jugadas > 1 ? 's' : ''}: se borrarán sus turnos y se quitará de ellas —{' '}
              <strong>las partidas se conservan</strong> en el historial.
            </p>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              ¿Eliminar a <strong style={{ color: 'var(--text)' }}>{j.nombre}</strong>?{' '}
              Sin partidas registradas, no se perderán datos.
            </p>
          )}
          {error && <p style={{ fontSize: '12px', color: '#fca5a5' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-danger btn-full"
              onClick={confirmarEliminar}
              disabled={cargando}
              style={{ padding: '10px' }}
            >
              {cargando ? 'Eliminando…' : 'Eliminar'}
            </button>
            <button
              className="btn btn-ghost btn-full"
              onClick={cancelar}
              disabled={cargando}
              style={{ padding: '10px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Stats — solo si expandido y sin modo activo */}
      {modo === null && expandido && (
        <>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', background: 'var(--surface2)', marginTop: 12 }}>
            <StatBox label="Jugadas" value={j.partidas_jugadas} />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <StatBox label="Ganadas" value={j.partidas_ganadas} color="#86efac" />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <StatBox
              label="Perdidas"
              value={j.partidas_jugadas - j.partidas_ganadas}
              color={j.partidas_jugadas - j.partidas_ganadas > 0 ? '#fca5a5' : 'var(--text)'}
            />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <StatBox
              label="Bolas"
              value={j.bolas_metidas}
              color="#93c5fd"
              sub={j.partidas_jugadas > 0 ? j.bolas_por_turno : null}
            />
          </div>
          {j.duracion_promedio_min != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Media partida:</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#c4b5fd' }}>
                {j.duracion_promedio_min >= 60
                  ? `${Math.floor(j.duracion_promedio_min / 60)}h ${Math.round(j.duracion_promedio_min % 60)}'`
                  : `${Math.round(j.duracion_promedio_min)}'`}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <WinRateBar ganadas={j.partidas_ganadas} jugadas={j.partidas_jugadas} />
            </div>
            {j.racha_actual !== 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 700, flexShrink: 0,
                color: j.racha_actual > 0 ? '#86efac' : '#fca5a5',
              }}>
                {j.racha_actual > 0 ? `▲${j.racha_actual}` : `▼${Math.abs(j.racha_actual)}`}
              </span>
            )}
          </div>

          {/* Sparkline dots */}
          {ultimas && ultimas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginRight: 2, flexShrink: 0 }}>Forma:</span>
              {[...ultimas].reverse().slice(0, 12).map((p, i) => (
                <div key={i} style={{
                  width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                  background: p.gano ? '#16a34a' : 'var(--team2)', opacity: 0.85,
                }} title={p.gano ? 'Victoria' : 'Derrota'} />
              ))}
            </div>
          )}

          {/* Tendencia bolas por turno */}
          {j.bolas_por_turno_reciente != null && j.partidas_jugadas >= 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tendencia:</span>
              {j.bolas_por_turno_reciente > j.bolas_por_turno ? (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#86efac' }}>
                  ▲ mejorando ({j.bolas_por_turno_reciente} vs {j.bolas_por_turno} global)
                </span>
              ) : j.bolas_por_turno_reciente < j.bolas_por_turno ? (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fca5a5' }}>
                  ▼ bajando ({j.bolas_por_turno_reciente} vs {j.bolas_por_turno} global)
                </span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>→ estable</span>
              )}
            </div>
          )}

          {/* Desglose por modalidad */}
          {(j.partidas_jugadas_bola8 > 0 || j.partidas_jugadas_bola9 > 0) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {j.partidas_jugadas_bola8 > 0 && (
                <ModalidadChip
                  label="Bola 8"
                  ganadas={j.partidas_ganadas_bola8}
                  jugadas={j.partidas_jugadas_bola8}
                  color="#93c5fd"
                  falta={j.falta_frecuente_bola8_nombre}
                />
              )}
              {j.partidas_jugadas_bola9 > 0 && (
                <ModalidadChip
                  label="Bola 9"
                  ganadas={j.partidas_ganadas_bola9}
                  jugadas={j.partidas_jugadas_bola9}
                  color="#c4b5fd"
                  falta={j.falta_frecuente_bola9_nombre}
                />
              )}
            </div>
          )}

          {/* Últimas partidas */}
          {j.partidas_jugadas > 0 && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={toggleUltimas}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.04em',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {mostrarUltimas ? '▲' : '▼'} Últimas partidas
              </button>

              {mostrarUltimas && (
                <div style={{ marginTop: 8 }}>
                  {cargandoUltimas && <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Cargando…</div>}
                  {ultimas?.length === 0 && !cargandoUltimas && (
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Sin partidas finalizadas</p>
                  )}
                  {ultimas?.map(p => (
                    <button key={p.id} onClick={() => navigate(`/partida/${p.id}`)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 0',
                      width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, minWidth: 22, textAlign: 'center',
                        padding: '2px 5px', borderRadius: 4,
                        background: p.gano ? 'rgba(22,163,74,.18)' : 'rgba(220,38,38,.18)',
                        color: p.gano ? '#86efac' : '#fca5a5',
                      }}>
                        {p.gano ? 'W' : 'L'}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: 'var(--surface2)', color: 'var(--text-dim)',
                        border: '1px solid var(--border)', flexShrink: 0,
                      }}>
                        {p.modalidad === 'bola8' ? 'B8' : 'B9'}
                      </span>
                      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        vs {p.rival_nombres.join(', ')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>
                        {fechaCorta(p.fecha)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Torneos */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={toggleTorneos}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.04em',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {mostrarTorneos ? '▲' : '▼'} Torneos
            </button>
            {mostrarTorneos && (
              <div style={{ marginTop: 8 }}>
                {cargandoTorneos && <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Cargando…</div>}
                {torneos?.length === 0 && !cargandoTorneos && (
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Sin torneos</p>
                )}
                {torneos?.map(t => {
                  const gano = t.posicion === 1
                  const podio = t.posicion <= 3
                  const medal = t.posicion === 1 ? '🥇' : t.posicion === 2 ? '🥈' : t.posicion === 3 ? '🥉' : `#${t.posicion}`
                  return (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: t.posicion <= 3 ? '15px' : '11px', minWidth: 22, textAlign: 'center', color: 'var(--text-dim)', fontWeight: 700 }}>{medal}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: gano ? '#fcd34d' : podio ? 'var(--text)' : 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.nombre}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: 1 }}>
                          {t.victorias}W · {t.derrotas}L · {t.puntos}pts · {t.total_jugadores} jugadores
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)',
                        }}>
                          {t.modalidad === 'bola8' ? 'B8' : 'B9'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{fechaCorta(t.fecha)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Logros */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={toggleLogros}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '.04em',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {mostrarLogros ? '▲' : '▼'} Logros
              {logrosJugador && (
                <span style={{ marginLeft: 4, color: '#06b6d4' }}>
                  {logrosJugador.filter(l => l.desbloqueado).length}/{logrosJugador.length}
                </span>
              )}
            </button>
            {mostrarLogros && (
              <div style={{ marginTop: 8 }}>
                {cargandoLogros && (
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Cargando…</div>
                )}
                {logrosJugador?.filter(l => l.desbloqueado).length === 0 && !cargandoLogros && (
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Sin logros aún</p>
                )}
                {logrosJugador?.filter(l => l.desbloqueado).map(l => (
                  <div key={l.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{l.icono}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{l.nombre}</div>
                      {l.nivel_actual && (
                        <div style={{ fontSize: 10, color: '#06b6d4', marginTop: 1 }}>
                          Nivel: {l.nivel_actual}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cara a cara */}
          {j.partidas_jugadas > 0 && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={toggleH2H}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.04em',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {mostrarH2H ? '▲' : '▼'} Cara a cara
              </button>

              {mostrarH2H && (
                <div style={{ marginTop: 8 }}>
                  {cargandoH2H && <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Cargando…</div>}
                  {h2h?.length === 0 && !cargandoH2H && (
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Sin enfrentamientos registrados</p>
                  )}
                  {h2h?.map(r => {
                    const pct = r.jugadas === 0 ? 0 : Math.round((r.ganadas / r.jugadas) * 100)
                    const ganando = pct >= 50
                    return (
                      <div key={r.jugador_id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', borderBottom: '1px solid var(--border)',
                      }}>
                        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{r.nombre}</span>
                        <span style={{ fontSize: '12px', color: ganando ? '#86efac' : '#fca5a5', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
                          {r.ganadas}–{r.jugadas - r.ganadas}
                        </span>
                        <div style={{ width: 44, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: ganando ? '#16a34a' : 'var(--team2)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: ganando ? '#86efac' : '#fca5a5', minWidth: 30, textAlign: 'right' }}>
                          {pct}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const ORDENES = [
  { key: 'nombre',   label: 'Nombre',   fn: (a, b) => a.nombre.localeCompare(b.nombre) },
  { key: 'winrate',  label: 'Win rate',  fn: (a, b) => {
    const ra = a.partidas_jugadas ? a.partidas_ganadas / a.partidas_jugadas : 0
    const rb = b.partidas_jugadas ? b.partidas_ganadas / b.partidas_jugadas : 0
    return rb - ra || b.partidas_jugadas - a.partidas_jugadas
  }},
  { key: 'bolas',    label: 'Bolas',    fn: (a, b) => b.bolas_metidas - a.bolas_metidas },
  { key: 'jugadas',  label: 'Partidas', fn: (a, b) => b.partidas_jugadas - a.partidas_jugadas },
]

export default function Jugadores() {
  const navigate = useNavigate()
  const { data: stats, loading, reload } = useApi(() => api.getAllStats(true))
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [orden, setOrden] = useSessionState('jugadores_orden', 'nombre')
  const [inactivosExpand, setInactivosExpand] = useSessionState('jugadores_inactivos_expand', false)

  async function crear(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true); setError(null)
    try {
      await api.crearJugador(nombre.trim())
      setNombre('')
      reload()
    } catch (err) { setError(err.message) }
    finally { setGuardando(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ fontSize: '20px' }}>Jugadores</h2>
        {stats != null && (
          <span style={{ fontSize: '13px', color: 'var(--text-dim)', fontWeight: 400 }}>
            {stats.length} registrado{stats.length !== 1 ? 's' : ''}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/stats')}
          style={{
            padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', fontSize: 12, fontWeight: 600, flexShrink: 0,
          }}
        >📊 Estadísticas globales →</button>
      </div>

      {/* Formulario de nuevo jugador */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', marginBottom: 8 }}>
          ＋ Nuevo jugador
        </p>
        <form onSubmit={crear} style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Nombre" value={nombre}
            onChange={e => setNombre(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
          <button type="submit" className="btn btn-primary" disabled={guardando || !nombre.trim()}>
            Añadir
          </button>
        </form>
        {error && <p style={{ color: 'var(--accent)', fontSize: '13px', marginTop: 8 }}>{error}</p>}
      </div>

      {loading && !stats && <div className="spinner" />}
      {stats?.length === 0 && <p className="empty">Sin jugadores. ¡Añade el primero!</p>}

      {/* Ordenar */}
      {stats?.length > 1 && (
        <div style={{
          position: 'sticky', top: 'var(--nav-height)', zIndex: 50,
          background: 'var(--bg)', padding: '10px 16px 6px', margin: '0 -16px',
          display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)' }}>
            Ordenar:
          </span>
          {ORDENES.map(o => (
            <Chip key={o.key} label={o.label} activo={orden === o.key} onClick={() => setOrden(o.key)} />
          ))}
        </div>
      )}

      {(() => {
        const sorter = ORDENES.find(o => o.key === orden)?.fn
        const activos   = [...(stats ?? [])].filter(j => j.activo).sort(sorter)
        const inactivos = [...(stats ?? [])].filter(j => !j.activo).sort(sorter)
        return (
          <>
            {activos.map(j => (
              <JugadorCard key={j.id} j={j} onReload={reload} todosStats={stats ?? []} />
            ))}
            {inactivos.length > 0 && (
              <div>
                <button
                  onClick={() => setInactivosExpand(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1 }}>
                    {inactivosExpand ? '▼' : '▶'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-dim)' }}>
                    Inactivos
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{inactivos.length}</span>
                </button>
                {inactivosExpand && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
                    {inactivos.map(j => (
                      <JugadorCard key={j.id} j={j} onReload={reload} todosStats={stats ?? []} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )
      })()}

      <NombresEquipoSection statsMap={Object.fromEntries((stats ?? []).map(s => [s.id, s]))} />
    </div>
  )
}
