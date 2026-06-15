import { parseFecha } from '../utils/fecha'

// Explicit colors — no CSS variables (html2canvas compatibility)
const BG = '#0f172a'
const SURFACE = '#1e293b'
const BORDER = 'rgba(255,255,255,.1)'
const TEXT = '#f1f5f9'
const DIM = '#64748b'
const GOLD = '#fcd34d'

function formatDate(fecha) {
  if (!fecha) return ''
  return parseFecha(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function ShareCardTorneo({ torneo }) {
  const clasif = [...(torneo.clasificacion || [])].sort((a, b) => b.puntos - a.puntos)
  const winner = clasif[0]
  const maxPts = winner?.puntos || 1

  return (
    <div style={{ background: BG, color: TEXT, width: '100%', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: SURFACE, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 800, color: TEXT,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          🏆 {torneo.nombre}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
          background: torneo.modalidad === 'bola8' ? 'rgba(255,255,255,.1)' : 'rgba(234,179,8,.2)',
          color: torneo.modalidad === 'bola8' ? '#94a3b8' : '#fbbf24',
          border: `1px solid ${torneo.modalidad === 'bola8' ? 'rgba(255,255,255,.15)' : 'rgba(234,179,8,.3)'}`,
        }}>
          {torneo.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
        </span>
      </div>

      {/* Winner */}
      {winner && (
        <div style={{
          padding: '20px 16px', textAlign: 'center',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: GOLD, marginBottom: 5 }}>
            Campeón · {winner.nombre}
          </div>
          <div style={{ fontSize: 12, color: DIM, marginTop: 6 }}>
            {winner.victorias}W · {winner.derrotas}L · {winner.puntos} pts
          </div>
          <div style={{ fontSize: 11, color: DIM, marginTop: 4 }}>
            {torneo.jugados} partidas jugadas
          </div>
        </div>
      )}

      {/* Clasificación table */}
      <div style={{ padding: '12px 16px', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '20px 1fr 28px 28px 36px',
          gap: 4, padding: '0 4px', marginBottom: 6, alignItems: 'center',
        }}>
          <span />
          <span style={{ fontSize: 10, color: DIM, textTransform: 'uppercase', letterSpacing: '.05em' }}>Jugador</span>
          <span style={{ fontSize: 10, textAlign: 'center', color: DIM }}>W</span>
          <span style={{ fontSize: 10, textAlign: 'center', color: DIM }}>L</span>
          <span style={{ fontSize: 10, textAlign: 'right', color: DIM }}>Pts</span>
        </div>

        {clasif.map((j, i) => {
          const barPct = maxPts > 0 ? j.puntos / maxPts : 0
          const isFirst = i === 0
          return (
            <div key={j.jugador_id} style={{
              display: 'grid', gridTemplateColumns: '20px 1fr 28px 28px 36px',
              gap: 4, padding: '7px 4px', alignItems: 'center',
              background: isFirst ? 'rgba(161,130,3,.18)' : 'transparent',
              borderRadius: 6, marginBottom: 2,
            }}>
              <span style={{ fontSize: 13, textAlign: 'center' }}>{MEDALS[i] || ''}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: j.color || DIM, flexShrink: 0 }} />
                <span style={{
                  fontSize: 13, fontWeight: isFirst ? 700 : 500,
                  color: isFirst ? GOLD : TEXT,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {j.nombre}
                </span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: j.victorias > 0 ? '#4ade80' : DIM }}>
                {j.victorias}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: j.derrotas > 0 ? '#fca5a5' : DIM }}>
                {j.derrotas}
              </span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isFirst ? GOLD : DIM, display: 'block' }}>{j.puntos}</span>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.1)', marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(barPct * 100)}%`, background: j.color || '#60a5fa', borderRadius: 2 }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px 14px', textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: DIM }}>{formatDate(torneo.fecha_fin || torneo.fecha)}</span>
      </div>
    </div>
  )
}
