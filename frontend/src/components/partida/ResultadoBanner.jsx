const TEAM = {
  1: { color: 'var(--team1)' },
  2: { color: 'var(--team2)' },
}

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

export default function ResultadoBanner({ partida, turnos, jugadores, onRevancha, onRepetir }) {
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

      {/* ── Botones ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={onRevancha}
          style={{ flex: 1, padding: '10px', fontSize: '14px' }}>
          ↺ Revancha
        </button>
        <button className="btn btn-ghost" onClick={onRepetir}
          style={{ flex: 1, padding: '10px', fontSize: '14px', borderColor: 'var(--border)' }}>
          = Mismos equipos
        </button>
      </div>
    </div>
  )
}
