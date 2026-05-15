// Explicit colors — no CSS variables (html2canvas compatibility)
const BG = '#0f172a'
const SURFACE = '#1e293b'
const BORDER = 'rgba(255,255,255,.1)'
const TEXT = '#f1f5f9'
const DIM = '#64748b'
const GOLD = '#fcd34d'

function playerColor(jid, partida, jugadores) {
  const j = jugadores.find(x => x.id === jid)
  return j?.color || (partida.equipo1_jugadores.includes(jid) ? '#60a5fa' : '#fb923c')
}

function nombre(jid, jugadores) {
  return jugadores.find(j => j.id === jid)?.nombre ?? `#${jid}`
}

function duracion(fecha, fechaFin) {
  const ms = new Date(fechaFin) - new Date(fecha)
  const min = Math.floor(ms / 60_000)
  const seg = Math.floor((ms % 60_000) / 1_000)
  return `${min}' ${String(seg).padStart(2, '0')}"`
}

function formatDate(fecha) {
  return new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ShareCardPartida({ partida, turnos, jugadores }) {
  const bolasX = {}, faltasX = {}, turnosX = {}
  for (const t of turnos) {
    const jid = t.jugador_id
    bolasX[jid] = (bolasX[jid] ?? 0) + (t.bolas_metidas?.filter(b => b !== 0).length ?? 0)
    faltasX[jid] = (faltasX[jid] ?? 0) + (t.falta_id ? 1 : 0)
    turnosX[jid] = (turnosX[jid] ?? 0) + 1
  }

  const todosIds = [...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
  const mvpId = todosIds.reduce((best, id) =>
    (bolasX[id] ?? 0) > (bolasX[best] ?? 0) ? id : best, todosIds[0])
  const ganadores = partida.ganador_equipo === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores
  const equipoNombre = partida.ganador_equipo === 1
    ? (partida.equipo1_nombre || 'Equipo 1')
    : (partida.equipo2_nombre || 'Equipo 2')
  const sorted = [...todosIds].sort((a, b) => (bolasX[b] ?? 0) - (bolasX[a] ?? 0))

  return (
    <div style={{ background: BG, width: '100%', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: SURFACE, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>🎱 Billar Pool</span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: partida.modalidad === 'bola8' ? 'rgba(255,255,255,.1)' : 'rgba(234,179,8,.2)',
          color: partida.modalidad === 'bola8' ? '#94a3b8' : '#fbbf24',
          border: `1px solid ${partida.modalidad === 'bola8' ? 'rgba(255,255,255,.15)' : 'rgba(234,179,8,.3)'}`,
        }}>
          {partida.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
        </span>
      </div>

      {/* Winner */}
      <div style={{
        padding: '20px 16px', textAlign: 'center',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: GOLD, marginBottom: 5 }}>
          Gana {equipoNombre}
        </div>
        <div style={{ fontSize: 13, color: playerColor(ganadores[0], partida, jugadores) }}>
          {ganadores.map(jid => nombre(jid, jugadores)).join(' · ')}
        </div>
        {partida.fecha_fin && (
          <div style={{ fontSize: 12, color: DIM, marginTop: 8 }}>
            ⏱ {duracion(partida.fecha, partida.fecha_fin)}
          </div>
        )}
      </div>

      {/* Stats table */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 32px 32px 32px',
          gap: 4, padding: '0 4px', marginBottom: 6,
        }}>
          <span style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: '.05em' }}>Jugador</span>
          {[['🎱', 'Bolas'], ['⚠', 'Faltas'], ['↩', 'Turnos']].map(([icon, lbl]) => (
            <span key={lbl} style={{ fontSize: 12, textAlign: 'center', color: DIM }}>{icon}</span>
          ))}
        </div>

        {sorted.map(jid => {
          const isMvp = String(jid) === String(mvpId) && (bolasX[mvpId] ?? 0) > 0
          const color = playerColor(jid, partida, jugadores)
          return (
            <div key={jid} style={{
              display: 'grid', gridTemplateColumns: '1fr 32px 32px 32px',
              gap: 4, padding: '7px 4px',
              background: isMvp ? 'rgba(161,130,3,.18)' : 'transparent',
              borderRadius: 6, marginBottom: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{
                  fontSize: 13, fontWeight: isMvp ? 700 : 500,
                  color: isMvp ? GOLD : TEXT,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {isMvp ? '★ ' : ''}{nombre(jid, jugadores)}
                </span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: (bolasX[jid] ?? 0) > 0 ? '#93c5fd' : DIM }}>
                {bolasX[jid] ?? 0}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: (faltasX[jid] ?? 0) > 0 ? '#fca5a5' : DIM }}>
                {faltasX[jid] ?? 0}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: DIM }}>
                {turnosX[jid] ?? 0}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px 14px', textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: DIM }}>{formatDate(partida.fecha)}</span>
      </div>
    </div>
  )
}
