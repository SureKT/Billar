import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { QRCodeSVG } from 'qrcode.react'
import { BolaPool } from '../components/Bola'

// ── Data ──────────────────────────────────────────────────────────────────────

function useTVData() {
  const [todasPartidas, setTodasPartidas] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [torneo, setTorneo] = useState([])
  const [estados, setEstados] = useState({})
  const [turnosPorPartida, setTurnosPorPartida] = useState({})
  const [faltas, setFaltas] = useState([])

  const cargar = useCallback(async () => {
    try {
      const [todas, jugs, torneos, faltasCatalog] = await Promise.all([
        api.getPartidas(), api.getJugadores(), api.getTorneos(), api.getFaltas(),
      ])
      const activas = todas.filter(p => p.estado === 'en_curso')
      setTodasPartidas(todas)
      setJugadores(jugs)
      setFaltas(faltasCatalog)
      setTorneo(torneos)
      const nuEst = {}, nuTur = {}
      await Promise.all(activas.map(async p => {
        const [est, turns] = await Promise.all([api.getEstadoPartida(p.id), api.getTurnos(p.id)])
        nuEst[p.id] = est
        nuTur[p.id] = Array.isArray(turns) ? turns : []
      }))
      // merge so finalized partidas keep their last snapshot
      setEstados(prev => ({ ...prev, ...nuEst }))
      setTurnosPorPartida(prev => ({ ...prev, ...nuTur }))
    } catch (e) { console.error('TV error:', e) }
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 5000)
    return () => clearInterval(t)
  }, [cargar])

  const activas = todasPartidas.filter(p => p.estado === 'en_curso')
  return { partidas: activas, todasPartidas, jugadores, torneo, estados, turnosPorPartida, faltas }
}

function useTimer(fecha) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!fecha) return
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(fecha)) / 1000))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [fecha])
  return elapsed
}

function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// Timer chip lives at top level so it can sit in main header
function TimerChip({ fecha }) {
  const elapsed = useTimer(fecha)
  return (
    <span style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>
      ⏱ {fmtElapsed(elapsed)}
    </span>
  )
}

// ── Turn history ──────────────────────────────────────────────────────────────

function HistorialEquipo({ jugadoresIds, jugadoresAll, turnos, faltas, color, esUno }) {
  const turnosEquipo = turnos
    .filter(t => jugadoresIds.includes(t.jugador_id))
    .slice(-9).reverse()

  if (!turnosEquipo.length) return (
    <div style={{ fontSize: 13, color: '#1e293b', fontStyle: 'italic', padding: '6px 0' }}>Sin turnos aún</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {turnosEquipo.map((t, i) => {
        const jugador = !esUno ? jugadoresAll.find(j => j.id === t.jugador_id) : null
        const falta = faltas.find(f => f.id === t.falta_id)
        const bolas = (t.bolas_metidas ?? []).filter(b => b !== 0)
        const esReciente = i === 0

        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 10px', borderRadius: 8,
            background: esReciente ? `${color}14` : i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent',
            border: esReciente ? `1px solid ${color}28` : '1px solid transparent',
            opacity: i > 6 ? 0.4 : 1,
          }}>
            {jugador && (
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: jugador.color || color, flexShrink: 0 }} />
            )}

            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', pointerEvents: 'none', alignItems: 'center', flex: 1, minWidth: 0 }}>
              {bolas.length > 0
                ? bolas.map(b => <BolaPool key={b} numero={b} size={24} />)
                : <span style={{ fontSize: 13, color: '#334155', letterSpacing: '.04em' }}>sin bolas</span>
              }
            </div>

            {falta && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#fca5a5',
                background: 'rgba(239,68,68,.15)', padding: '2px 7px', borderRadius: 4,
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                ⚠ {falta.nombre}
              </span>
            )}
            {t.bola_en_mano && !falta && (
              <span style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(251,191,36,.12)', padding: '2px 7px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
                bola en mano
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Team panel ────────────────────────────────────────────────────────────────

function EquipoPanel({ nombre, jugadoresIds, jugadoresAll, grupo, pendientes, esTurno, teamColor, modalidad, turnos, faltas, siguienteJugadorId }) {
  const players = jugadoresIds.map(jid => jugadoresAll.find(j => j.id === jid)).filter(Boolean)
  const esUno = players.length === 1
  const grupoLabel = grupo === 'lisas' ? 'LISAS · 1-7' : grupo === 'rayadas' ? 'RAYADAS · 9-15' : null
  const ballColor = grupo === 'lisas' ? '#3b82f6' : grupo === 'rayadas' ? '#f97316' : teamColor

  return (
    <div style={{
      flex: 1, width: 0,  // force equal width regardless of content
      display: 'flex', flexDirection: 'column', gap: 0,
      background: esTurno ? `${teamColor}10` : 'rgba(255,255,255,.02)',
      border: `2px solid ${esTurno ? teamColor : 'rgba(255,255,255,.06)'}`,
      borderRadius: 18, overflow: 'hidden',
      transition: 'border-color .4s, background .4s',
    }}>
      {/* Top section */}
      <div style={{ padding: '20px 22px 16px' }}>
        {/* Name + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: !esUno ? 14 : 0 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: esTurno ? teamColor : '#2d3748', lineHeight: 1 }}>
            {nombre}
          </div>
          {esTurno && (
            <div style={{ background: teamColor, color: '#000', padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: '.1em', flexShrink: 0 }}>
              ▶ TURNO
            </div>
          )}
        </div>

        {/* Players — always show unless team name already is the player name */}
        {!(esUno && players[0]?.nombre === nombre) && (
          <div style={{ display: 'flex', gap: 14, marginTop: esUno ? 6 : 0 }}>
            {players.map(p => {
              const esActivo = p.id === siguienteJugadorId
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || teamColor }} />
                  <span style={{
                    fontSize: 15, fontWeight: esActivo ? 800 : 600,
                    color: esActivo ? '#f1f5f9' : (esTurno ? '#64748b' : '#334155'),
                  }}>
                    {esActivo ? '▶ ' : ''}{p.nombre}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalidad === 'bola8' && (
        <>
          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '0 22px' }} />
          <div style={{ padding: '16px 22px' }}>
            {grupoLabel ? (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: ballColor, letterSpacing: '.12em', marginBottom: 10 }}>
                  {grupoLabel}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: esTurno ? '#f1f5f9' : '#1e293b', lineHeight: 1 }}>
                    {pendientes.length}
                  </span>
                  <span style={{ fontSize: 13, color: '#334155' }}>pendientes</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, pointerEvents: 'none' }}>
                  {pendientes.map(b => <BolaPool key={b} numero={b} size={38} />)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#1e293b', fontStyle: 'italic' }}>Sin grupo asignado</div>
            )}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '0 22px' }} />
        </>
      )}

      {modalidad === 'bola9' && (
        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '0 22px' }} />
      )}

      {/* History — fills remaining space */}
      <div style={{ flex: 1, padding: '14px 22px 18px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '.1em', marginBottom: 10 }}>
          HISTORIAL
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <HistorialEquipo
            jugadoresIds={jugadoresIds}
            jugadoresAll={jugadoresAll}
            turnos={turnos}
            faltas={faltas}
            color={teamColor}
            esUno={esUno}
          />
        </div>
      </div>
    </div>
  )
}

// ── Center stats ──────────────────────────────────────────────────────────────

function CentroStats({ partida, turnos, estado, jugadores }) {
  const eq1ids = partida.equipo1_jugadores
  const eq2ids = partida.equipo2_jugadores

  const calcStats = ids => {
    const ts = turnos.filter(t => ids.includes(t.jugador_id))
    return {
      turnos: ts.length,
      bolas: ts.reduce((s, t) => s + (t.bolas_metidas?.filter(b => b !== 0).length ?? 0), 0),
      faltas: ts.filter(t => t.falta_id).length,
    }
  }
  const s1 = calcStats(eq1ids)
  const s2 = calcStats(eq2ids)
  const eq1turno = eq1ids.includes(partida.siguiente_jugador_id)

  const rows = [
    { label: 'Turnos', v1: s1.turnos, v2: s2.turnos, higherBetter: true },
    { label: 'Bolas',  v1: s1.bolas,  v2: s2.bolas,  higherBetter: true },
    { label: 'Faltas', v1: s1.faltas, v2: s2.faltas,  higherBetter: false },
  ]

  return (
    <div style={{
      width: 160, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 22, padding: '0 4px',
    }}>
      {/* Stats */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(({ label, v1, v2, higherBetter }) => {
          const c1 = higherBetter
            ? (v1 > v2 ? '#3b82f6' : v1 === v2 ? '#475569' : '#334155')
            : (v1 < v2 ? '#3b82f6' : v1 === v2 ? '#475569' : '#334155')
          const c2 = higherBetter
            ? (v2 > v1 ? '#e94560' : v2 === v1 ? '#475569' : '#334155')
            : (v2 < v1 ? '#e94560' : v2 === v1 ? '#475569' : '#334155')
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: c1, width: 30, textAlign: 'right' }}>{v1}</span>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#334155', letterSpacing: '.08em' }}>
                {label.toUpperCase()}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: c2, width: 30, textAlign: 'left' }}>{v2}</span>
            </div>
          )
        })}
      </div>


      {/* Bola 9 */}
      {partida.modalidad === 'bola9' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {estado?.bola_objetivo && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 9, color: '#334155', letterSpacing: '.1em' }}>OBJETIVO</div>
              <div style={{ pointerEvents: 'none' }}><BolaPool numero={estado.bola_objetivo} size={44} /></div>
            </div>
          )}
          {estado?.bolas_pendientes_9?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', pointerEvents: 'none' }}>
              {estado.bolas_pendientes_9.map(b => (
                <BolaPool key={b} numero={b} size={26} seleccionada={b === estado.bola_objetivo} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* B8 ghost ball */}
      {partida.modalidad === 'bola8' && (
        <div style={{ pointerEvents: 'none', opacity: 0.12 }}>
          <BolaPool numero={8} size={56} />
        </div>
      )}
    </div>
  )
}

// ── Torneo standings ──────────────────────────────────────────────────────────

function ClasificacionTV({ torneo }) {
  const todos = [...(torneo?.clasificacion ?? [])].sort((a, b) => b.puntos - a.puntos)
  const hayDatos = todos.some(j => j.pj > 0)

  return (
    <div style={{
      flex: 1,
      background: 'rgba(234,179,8,.05)', border: '1px solid rgba(234,179,8,.15)',
      borderRadius: 12, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', letterSpacing: '.08em', flexShrink: 0, marginRight: 4 }}>
        🏆 {torneo.nombre}
      </span>
      {todos.map((j, i) => (
        <div key={j.jugador_id} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 12px', borderRadius: 20,
          background: i === 0 && hayDatos ? 'rgba(234,179,8,.1)' : 'rgba(255,255,255,.04)',
          border: `1px solid ${i === 0 && hayDatos ? 'rgba(234,179,8,.25)' : 'rgba(255,255,255,.06)'}`,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: j.color || '#475569' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 && hayDatos ? '#fcd34d' : '#64748b' }}>{j.nombre}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 && hayDatos ? '#fcd34d' : '#475569' }}>{j.puntos}pts</span>
          {hayDatos && (
            <>
              <span style={{ fontSize: 11, color: '#4ade80' }}>{j.victorias}W</span>
              <span style={{ fontSize: 11, color: '#f87171' }}>{j.derrotas}L</span>
            </>
          )}
        </div>
      ))}
      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#334155', flexShrink: 0 }}>
        {torneo.jugados}/{torneo.total}
      </span>
    </div>
  )
}

// ── Idle ──────────────────────────────────────────────────────────────────────

function IdleScreen({ url }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <div style={{ fontSize: 100, fontWeight: 900, color: 'rgba(255,255,255,.05)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div style={{ fontSize: 15, color: '#334155', fontWeight: 700, letterSpacing: '.06em' }}>SIN PARTIDAS EN CURSO</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ background: '#1e293b', padding: 10, borderRadius: 10 }}>
          <QRCodeSVG value={url} size={96} bgColor="#1e293b" fgColor="#475569" />
        </div>
        <span style={{ fontSize: 12, color: '#334155' }}>{url}</span>
      </div>
    </div>
  )
}

// ── Victory ───────────────────────────────────────────────────────────────────

function VictoryScreen({ partida, turnos, jugadores, countdown }) {
  const ganEq = partida.ganador_equipo
  const perEq = ganEq === 1 ? 2 : 1
  const ganNombre = ganEq === 1 ? (partida.equipo1_nombre || 'Equipo 1') : (partida.equipo2_nombre || 'Equipo 2')
  const perNombre = perEq === 1 ? (partida.equipo1_nombre || 'Equipo 1') : (partida.equipo2_nombre || 'Equipo 2')
  const ganIds = ganEq === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores
  const perIds = perEq === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores
  const ganColor = ganEq === 1 ? '#3b82f6' : '#e94560'
  const perColor = ganEq === 1 ? '#e94560' : '#3b82f6'
  const ganJugadores = ganIds.map(id => jugadores.find(j => j.id === id)).filter(Boolean)
  const perJugadores = perIds.map(id => jugadores.find(j => j.id === id)).filter(Boolean)

  const calcStats = ids => {
    const ts = turnos.filter(t => ids.includes(t.jugador_id))
    return {
      turnos: ts.length,
      bolas: ts.reduce((s, t) => s + (t.bolas_metidas?.filter(b => b !== 0).length ?? 0), 0),
      faltas: ts.filter(t => t.falta_id).length,
    }
  }
  const gs = calcStats(ganIds)
  const ps = calcStats(perIds)

  const durMs = partida.fecha_fin ? new Date(partida.fecha_fin) - new Date(partida.fecha) : 0
  const durMin = Math.floor(durMs / 60000)
  const durSeg = Math.floor((durMs % 60000) / 1000)

  const statRows = [
    { label: 'Turnos', gv: gs.turnos, pv: ps.turnos, higherBetter: true },
    { label: 'Bolas',  gv: gs.bolas,  pv: ps.bolas,  higherBetter: true },
    { label: 'Faltas', gv: gs.faltas, pv: ps.faltas,  higherBetter: false },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
      <div style={{ fontSize: 72, lineHeight: 1 }}>🏆</div>

      {/* Winner */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '.14em', marginBottom: 8 }}>GANA</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: ganColor, lineHeight: 1, marginBottom: 8 }}>{ganNombre}</div>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          {ganJugadores.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || ganColor }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>{p.nombre}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats comparison */}
      <div style={{
        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 16, padding: '16px 28px', minWidth: 320,
      }}>
        {/* Team headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: ganColor }}>{ganNombre}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {ganJugadores.map(p => (
                <span key={p.id} style={{ fontSize: 11, color: '#475569' }}>{p.nombre}</span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#334155', letterSpacing: '.08em', alignSelf: 'center' }}>
            {durMin > 0 ? `${durMin}'${String(durSeg).padStart(2,'0')}"` : ''}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: perColor }}>{perNombre}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
              {perJugadores.map(p => (
                <span key={p.id} style={{ fontSize: 11, color: '#475569' }}>{p.nombre}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', marginBottom: 12 }} />
        {/* Rows */}
        {statRows.map(({ label, gv, pv, higherBetter }) => {
          const ganWins = higherBetter ? gv > pv : gv < pv
          const perWins = higherBetter ? pv > gv : pv < gv
          return (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: ganWins ? ganColor : '#334155', textAlign: 'left' }}>{gv}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '.08em', textAlign: 'center', alignSelf: 'center' }}>{label.toUpperCase()}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: perWins ? perColor : '#334155', textAlign: 'right' }}>{pv}</span>
            </div>
          )
        })}
      </div>

      {/* Countdown */}
      {countdown !== null && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#475569', letterSpacing: '.1em', marginBottom: 6 }}>SIGUIENTE PARTIDA EN</div>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {countdown}
          </div>
          <div style={{
            marginTop: 10, height: 4, width: 200, borderRadius: 2,
            background: 'rgba(255,255,255,.08)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#06b6d4',
              width: `${(countdown / 10) * 100}%`,
              transition: 'width 1s linear',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TV() {
  const { partidas, todasPartidas, jugadores, torneo, estados, turnosPorPartida, faltas } = useTVData()
  const [selectedId, setSelectedId] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const url = window.location.origin

  // Initial selection: pick first active game
  useEffect(() => {
    if (!selectedId && partidas.length > 0) setSelectedId(partidas[0].id)
  }, [partidas, selectedId])

  // Resolve selected partida — may be finalized (kept from todasPartidas)
  const partida = todasPartidas.find(p => p.id === selectedId) ?? partidas[0] ?? null
  const esVictoria = partida?.estado === 'finalizada' && !!partida?.ganador_equipo

  // Countdown when victory is showing and other games exist
  // Dep on `hayActivas` (boolean) so effect re-fires when a new game starts
  const hayActivas = partidas.length > 0
  useEffect(() => {
    if (!esVictoria) { setCountdown(null); return }
    if (!hayActivas) { setCountdown(null); return }
    setCountdown(10)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          setSelectedId(partidas[0].id)
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [esVictoria, hayActivas, selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const eq1turno = partida ? partida.equipo1_jugadores.includes(partida.siguiente_jugador_id) : null
  const torneoActual = partida?.torneo_id ? torneo.find(t => t.id === partida.torneo_id) ?? null : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0e0e14',
      display: 'flex', flexDirection: 'column',
      padding: '12px 18px', gap: 10,
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', letterSpacing: '.05em' }}>🎱 BILLAR POOL</span>

        {partida && (
          <>
            <span style={{ color: '#1e293b', fontSize: 14 }}>·</span>
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 700 }}>
              Partida #{partida.numero_partida || partida.id}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: partida.modalidad === 'bola8' ? 'rgba(255,255,255,.07)' : 'rgba(234,179,8,.18)',
              color: partida.modalidad === 'bola8' ? '#64748b' : '#fbbf24',
            }}>
              {partida.modalidad === 'bola8' ? 'BOLA 8' : 'BOLA 9'}
            </span>
            {/* Multiple game selector — only active games */}
            {partidas.length > 1 && partidas.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)} style={{
                padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: p.id === selectedId ? 'rgba(6,182,212,.2)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${p.id === selectedId ? '#06b6d4' : 'rgba(255,255,255,.1)'}`,
                color: p.id === selectedId ? '#06b6d4' : '#475569',
              }}>
                {p.torneo_nombre ? '🏆 ' : ''}#{p.numero_partida || p.id}
              </button>
            ))}
            <span style={{ marginLeft: 'auto' }}>
              <TimerChip fecha={partida.fecha} />
            </span>
          </>
        )}
        {!partida && <span style={{ marginLeft: 'auto' }} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: partida ? 16 : 'auto' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, color: '#334155', fontWeight: 700, letterSpacing: '.1em' }}>EN VIVO</span>
        </div>
        <a href="/" style={{ fontSize: 12, color: '#334155', textDecoration: 'none' }}>← Volver</a>
      </div>

      {/* ── Content ── */}
      {!partida ? (
        <IdleScreen url={url} />
      ) : esVictoria ? (
        <VictoryScreen
          partida={partida}
          turnos={turnosPorPartida[partida.id] ?? []}
          jugadores={jugadores}
          countdown={countdown}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
          <EquipoPanel
            nombre={partida.equipo1_nombre || 'Equipo 1'}
            jugadoresIds={partida.equipo1_jugadores}
            jugadoresAll={jugadores}
            grupo={partida.equipo1_grupo}
            pendientes={estados[partida.id]?.equipo1_pendientes ?? []}
            esTurno={eq1turno}
            teamColor="#3b82f6"
            modalidad={partida.modalidad}
            turnos={turnosPorPartida[partida.id] ?? []}
            faltas={faltas}
            siguienteJugadorId={partida.siguiente_jugador_id}
          />

          <CentroStats
            partida={partida}
            turnos={turnosPorPartida[partida.id] ?? []}
            estado={estados[partida.id]}
            jugadores={jugadores}
          />

          <EquipoPanel
            nombre={partida.equipo2_nombre || 'Equipo 2'}
            jugadoresIds={partida.equipo2_jugadores}
            jugadoresAll={jugadores}
            grupo={partida.equipo2_grupo}
            pendientes={estados[partida.id]?.equipo2_pendientes ?? []}
            esTurno={!eq1turno}
            teamColor="#e94560"
            modalidad={partida.modalidad}
            turnos={turnosPorPartida[partida.id] ?? []}
            faltas={faltas}
            siguienteJugadorId={partida.siguiente_jugador_id}
          />
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 10, alignItems: 'stretch' }}>
        {torneoActual && <ClasificacionTV torneo={torneoActual} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.02)', borderRadius: 12, padding: '8px 12px', flexShrink: 0 }}>
          <div style={{ background: '#1e293b', padding: 5, borderRadius: 6 }}>
            <QRCodeSVG value={url} size={36} bgColor="#1e293b" fgColor="#475569" />
          </div>
          <span style={{ fontSize: 10, color: '#2d3748' }}>{url}</span>
        </div>
      </div>
    </div>
  )
}
