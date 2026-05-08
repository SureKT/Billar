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

export default function ResultadoBanner({ partida, turnos, jugadores, onRevancha, onRepetir }) {
  const bolasXJugador = {}
  const faltasXEquipo = { 1: 0, 2: 0 }
  for (const t of turnos) {
    bolasXJugador[t.jugador_id] = (bolasXJugador[t.jugador_id] ?? 0) + (t.bolas_metidas?.length ?? 0)
    const eq = partida.equipo1_jugadores.includes(t.jugador_id) ? 1 : 2
    if (t.falta_id) faltasXEquipo[eq]++
  }
  const mvpId = Object.entries(bolasXJugador).sort((a, b) => b[1] - a[1])[0]?.[0]
  const ganadores = partida.ganador_equipo === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores

  return (
    <div style={{
      background: 'rgba(161,130,3,.15)', border: '1px solid #ca8a04',
      borderRadius: 12, padding: '18px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '28px', marginBottom: 4 }}>🏆</div>
      <p style={{ fontSize: '20px', fontWeight: 800, color: '#fcd34d' }}>
        Gana Equipo {partida.ganador_equipo}
      </p>
      <p style={{ fontSize: '14px', color: 'var(--text-dim)', marginTop: 4 }}>
        {ganadores.map(jid => nombre(jid, jugadores)).join(', ')}
      </p>

      {partida.fecha_fin && (
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: 6 }}>
          ⏱ {duracion(partida.fecha, partida.fecha_fin)}
        </p>
      )}

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
        {[
          { label: 'Turnos',    value: turnos.length },
          { label: 'Faltas Eq1', value: faltasXEquipo[1], color: TEAM[1].color },
          { label: 'Faltas Eq2', value: faltasXEquipo[2], color: TEAM[2].color },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '8px 4px' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: color ?? '#fcd34d' }}>{value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Ranking de bolas por jugador */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
          .sort((a, b) => (bolasXJugador[b] ?? 0) - (bolasXJugador[a] ?? 0))
          .map(jid => {
            const bolas = bolasXJugador[jid] ?? 0
            const esMvp = String(jid) === String(mvpId) && bolas > 0
            const esEq1 = partida.equipo1_jugadores.includes(jid)
            return (
              <div key={jid} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 8px', borderRadius: 6,
                background: esMvp ? 'rgba(161,130,3,.15)' : 'transparent',
              }}>
                <span style={{ fontSize: '13px', color: esMvp ? '#fcd34d' : TEAM[esEq1 ? 1 : 2].color }}>
                  {esMvp ? '★ ' : ''}{nombre(jid, jugadores)}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: esMvp ? '#fcd34d' : 'var(--text-dim)' }}>
                  {bolas} bolas
                </span>
              </div>
            )
          })}
      </div>

      {/* Botones */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
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
