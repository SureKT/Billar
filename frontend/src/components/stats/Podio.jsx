import { winrate, pct, colorJugador } from './StatPrimitives'

const MEDALLAS = ['🥇', '🥈', '🥉']

// Podio: responde "¿quién va ganando?" de un vistazo.
// jugadores: stats ya filtrados (≥1 partida); se exigen ≥2 jugadas para rankear.
export default function Podio({ jugadores, idxJugador }) {
  const ranked = [...jugadores]
    .filter(j => j.partidas_jugadas >= 2)
    .sort((a, b) => winrate(b) - winrate(a))

  if (ranked.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }} className="hide-scrollbar">
      {ranked.map((j, i) => {
        const lider = i === 0
        const wr = pct(j.partidas_ganadas, j.partidas_jugadas)
        const color = colorJugador(j, idxJugador?.get(j.id) ?? i)
        return (
          <div key={j.id} style={{
            flex: '1 0 110px', minWidth: 110, maxWidth: 180,
            padding: '12px 10px', borderRadius: 12, textAlign: 'center',
            background: lider ? 'var(--accent-bg)' : 'var(--surface)',
            border: lider ? '1px solid var(--accent)' : '1px solid var(--border)',
          }}>
            <div style={{
              fontSize: lider ? 30 : 24, fontWeight: 800, lineHeight: 1.1,
              color: lider ? 'var(--accent)' : 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {wr}%
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              marginTop: 4, minWidth: 0,
            }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{MEDALLAS[i] ?? `${i + 1}º`}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{j.nombre}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
              {j.partidas_ganadas}/{j.partidas_jugadas}
              {j.racha_actual !== 0 && (
                <span style={{
                  marginLeft: 5, fontWeight: 700,
                  color: j.racha_actual > 0 ? '#86efac' : '#fca5a5',
                }}>
                  {j.racha_actual > 0 ? `▲${j.racha_actual}` : `▼${Math.abs(j.racha_actual)}`}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
