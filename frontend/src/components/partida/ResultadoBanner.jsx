import { useState } from 'react'
import SharePreview from '../SharePreview'
import ShareCardPartida from '../ShareCardPartida'

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

const TEAM = {
  1: { color: 'var(--team1)' },
  2: { color: 'var(--team2)' },
}

const NIVEL_STYLE = {
  bronce:  { bg: 'rgba(180,110,60,.2)',  color: '#cd7f32', border: 'rgba(180,110,60,.5)' },
  plata:   { bg: 'rgba(160,170,180,.2)', color: '#a0aab4', border: 'rgba(160,170,180,.5)' },
  oro:     { bg: 'rgba(251,191,36,.2)',  color: '#fbbf24', border: 'rgba(251,191,36,.5)' },
  platino: { bg: 'rgba(139,92,246,.2)',  color: '#a78bfa', border: 'rgba(139,92,246,.5)' },
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

function nombre(id, jugadores) {
  return jugadores.find(j => j.id === id)?.nombre ?? `#${id}`
}

function duracion(fecha, fechaFin) {
  const ms = new Date(fechaFin) - new Date(fecha)
  const min = Math.floor(ms / 60_000)
  const seg = Math.floor((ms % 60_000) / 1_000)
  return `${min}' ${String(seg).padStart(2, '0')}"`
}

// Barra horizontal proporcional
function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s ease' }} />
    </div>
  )
}

export default function ResultadoBanner({ partida, turnos, jugadores, onRevancha, onRepetir, torneoId, logrosPartida }) {
  const [sharing, setSharing] = useState(false)
  const [logrosAbierto, setLogrosAbierto] = useState(true)
  // Derivar estadísticas por jugador
  const bolasXJugador  = {}
  const faltasXJugador = {}
  const turnosXJugador = {}
  const faltasXEquipo  = { 1: 0, 2: 0 }

  for (const t of turnos) {
    const jid = t.jugador_id
    bolasXJugador[jid]  = (bolasXJugador[jid]  ?? 0) + (t.bolas_metidas?.filter(b => b !== 0).length ?? 0)
    faltasXJugador[jid] = (faltasXJugador[jid] ?? 0) + (t.falta_id ? 1 : 0)
    turnosXJugador[jid] = (turnosXJugador[jid] ?? 0) + 1
    const eq = partida.equipo1_jugadores.includes(jid) ? 1 : 2
    if (t.falta_id) faltasXEquipo[eq]++
  }

  const todosIds  = [...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
  const mvpId     = todosIds.reduce((best, id) =>
    (bolasXJugador[id] ?? 0) > (bolasXJugador[best] ?? 0) ? id : best, todosIds[0])
  const esMvp     = (id) => String(id) === String(mvpId) && (bolasXJugador[mvpId] ?? 0) > 0
  const ganadores = partida.ganador_equipo === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores

  // Máximos para las barras
  const maxBolas  = Math.max(...todosIds.map(id => bolasXJugador[id]  ?? 0), 1)
  const maxFaltas = Math.max(...todosIds.map(id => faltasXJugador[id] ?? 0), 1)
  const maxTurnos = Math.max(...todosIds.map(id => turnosXJugador[id] ?? 0), 1)

  return (
    <div style={{
      background: 'rgba(161,130,3,.15)', border: '1px solid #ca8a04',
      borderRadius: 12, padding: '18px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>

      {/* ── Ganador ── */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: 4 }}>🏆</div>
        <p style={{ fontSize: '20px', fontWeight: 800, color: '#fcd34d' }}>
          Gana {partida.ganador_equipo === 1
            ? (partida.equipo1_nombre || 'Equipo 1')
            : (partida.equipo2_nombre || 'Equipo 2')}
        </p>
        <p style={{ fontSize: '14px', color: 'var(--text-dim)', marginTop: 4 }}>
          {ganadores.map(jid => nombre(jid, jugadores)).join(', ')}
        </p>
        {partida.fecha_fin && (
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: 6 }}>
            ⏱ {duracion(partida.fecha, partida.fecha_fin)}
          </p>
        )}
      </div>

      {/* ── Cifras globales ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'Turnos',      value: turnos.length,    color: '#fcd34d' },
          { label: 'Faltas Eq1',  value: faltasXEquipo[1], color: TEAM[1].color },
          { label: 'Faltas Eq2',  value: faltasXEquipo[2], color: TEAM[2].color },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Stats por jugador ── */}
      <div style={{ background: 'rgba(0,0,0,.2)', borderRadius: 10, overflow: 'hidden' }}>
        {/* cabecera con iconos + tooltip */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px',
          gap: 6, padding: '6px 10px',
          borderBottom: '1px solid rgba(255,255,255,.07)',
        }}>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Jugador</span>
          {[['🎱','Bolas'],['⚠','Faltas'],['↩','Turnos']].map(([icon, label]) => (
            <span key={label} title={label} style={{ fontSize: '13px', textAlign: 'center', cursor: 'default' }}>{icon}</span>
          ))}
        </div>

        {/* filas ordenadas por bolas desc */}
        {[...todosIds]
          .sort((a, b) => (bolasXJugador[b] ?? 0) - (bolasXJugador[a] ?? 0))
          .map(jid => {
            const esEq1   = partida.equipo1_jugadores.includes(jid)
            const color   = TEAM[esEq1 ? 1 : 2].color
            const mvp     = esMvp(jid)
            const bolas   = bolasXJugador[jid]  ?? 0
            const faltas  = faltasXJugador[jid] ?? 0
            const turnos_ = turnosXJugador[jid] ?? 0
            return (
              <div key={jid} style={{
                display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px',
                gap: 6, padding: '8px 10px', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,.04)',
                background: mvp ? 'rgba(161,130,3,.12)' : 'transparent',
              }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: mvp ? 700 : 600, color: mvp ? '#fcd34d' : color,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {mvp ? '★ ' : ''}{nombre(jid, jugadores)}
                  </span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                    <MiniBar value={bolas} max={maxBolas} color={color} />
                  </div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, textAlign: 'center',
                  color: bolas > 0 ? '#93c5fd' : 'var(--text-dim)' }}>{bolas}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, textAlign: 'center',
                  color: faltas > 0 ? '#fca5a5' : 'var(--text-dim)' }}>{faltas}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, textAlign: 'center',
                  color: 'var(--text-dim)' }}>{turnos_}</span>
              </div>
            )
          })}
      </div>

      {/* ── Logros desbloqueados en esta partida ── */}
      {logrosPartida?.length > 0 && (
        <div style={{
          background: 'rgba(88,28,135,.15)',
          border: '1px solid rgba(168,85,247,.3)',
          borderRadius: 10, padding: '12px 14px',
        }}>
          <button
            onClick={() => setLogrosAbierto(o => !o)}
            style={{
              width: '100%', background: 'none', border: 'none', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', marginBottom: logrosAbierto ? 10 : 0,
            }}
          >
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#c4b5fd', fontWeight: 700 }}>
              🏅 Logros desbloqueados · {logrosPartida.length}
            </span>
            <span style={{ fontSize: 12, color: '#c4b5fd' }}>{logrosAbierto ? '▲' : '▼'}</span>
          </button>
          {logrosAbierto && (() => {
            // Agrupar por jugador manteniendo orden de aparición
            const grupos = []
            const seen = new Map()
            for (const logro of logrosPartida) {
              if (!seen.has(logro.jugador_id)) {
                seen.set(logro.jugador_id, [])
                grupos.push({ jid: logro.jugador_id, logros: seen.get(logro.jugador_id) })
              }
              seen.get(logro.jugador_id).push(logro)
            }
            return grupos.map(({ jid, logros: grupoLogros }) => (
              <div key={jid} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
                  {nombre(jid, jugadores)}
                </div>
                {grupoLogros.map(logro => {
                  const tieneNiveles = logro.niveles?.length > 0
                  const nd = logro.niveles_desbloqueados ?? []
                  const nivelesOrdenados = tieneNiveles
                    ? [...logro.niveles].sort((a, b) => a.umbral - b.umbral)
                    : []
                  const nextNivel = nivelesOrdenados.find(n => !nd.includes(n.nivel))
                  return (
                    <div key={logro.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)',
                    }}>
                      <span style={{ fontSize: 17, width: 24, textAlign: 'center', flexShrink: 0, marginTop: 1 }}>
                        {logro.icono}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{logro.nombre}</span>
                          {logro.descripcion && (
                            <span style={{ fontSize: 11, color: 'rgba(148,163,184,.65)', fontStyle: 'italic' }}>
                              {logro.descripcion}
                            </span>
                          )}
                        </div>
                        {tieneNiveles && (
                          <>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                              {nivelesOrdenados.map(n => {
                                const unlocked = nd.includes(n.nivel)
                                const st = NIVEL_STYLE[n.nivel] ?? {}
                                return (
                                  <span key={n.nivel} style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                                    background: unlocked ? st.bg : 'rgba(255,255,255,.04)',
                                    color: unlocked ? st.color : '#555',
                                    border: `1px solid ${unlocked ? st.border : '#333'}`,
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                  }}>
                                    {n.emoji} {cap(n.nivel)}
                                    {unlocked && <span style={{ fontSize: 9 }}>✓</span>}
                                  </span>
                                )
                              })}
                            </div>
                            {logro.progreso != null && nextNivel && (
                              <div style={{ marginTop: 4 }}>
                                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>
                                  {logro.progreso.toLocaleString()} / {nextNivel.umbral.toLocaleString()} para {nextNivel.emoji} {cap(nextNivel.nivel)}
                                </div>
                                <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 4, height: 3, overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (logro.progreso / nextNivel.umbral) * 100)}%`,
                                    background: NIVEL_STYLE[nextNivel.nivel]?.color ?? 'var(--accent)',
                                    borderRadius: 4,
                                  }} />
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          })()}
        </div>
      )}

      {/* ── Botones ── */}
      {!torneoId ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={onRevancha}
            style={{ flex: 1, padding: '10px', fontSize: '14px' }}>
            ↺ Revancha
          </button>
          <button
            onClick={() => setSharing(true)}
            style={{
              flex: 1, padding: '10px', fontSize: '14px',
              background: 'rgba(168,85,247,.18)', border: '1px solid rgba(255,255,255,.2)',
              borderRadius: 8, color: '#fff', cursor: 'pointer',
            }}
          >
            <ShareIcon />Compartir
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSharing(true)}
          style={{
            background: 'rgba(168,85,247,.18)', border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 8, padding: '9px', fontSize: 13, color: '#fff',
            cursor: 'pointer', width: '100%',
          }}
        >
          <ShareIcon />Compartir resultado
        </button>
      )}

      <SharePreview open={sharing} onClose={() => setSharing(false)} filename="billar-resultado">
        <ShareCardPartida partida={partida} turnos={turnos} jugadores={jugadores} />
      </SharePreview>
    </div>
  )
}
