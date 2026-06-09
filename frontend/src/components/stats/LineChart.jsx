// Gráfica de líneas SVG multi-serie. Sin dependencias.
// series: [{ nombre, color, puntos: [{ t: timestamp_ms, y: number }] }]
// Pensada para evolución de win rate (y en 0-100) pero el dominio Y es configurable.

const PAD = { top: 10, right: 14, bottom: 22, left: 38 }

export default function LineChart({ series, height = 200, maxY = 100, formatY = v => `${v}%`, viewW = 600 }) {
  const W = viewW
  const H = height
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const todos = series.flatMap(s => s.puntos)
  if (todos.length === 0) return null
  const tMin = Math.min(...todos.map(p => p.t))
  const tMax = Math.max(...todos.map(p => p.t))
  const tSpan = Math.max(tMax - tMin, 1)

  const x = t => PAD.left + ((t - tMin) / tSpan) * innerW
  const y = v => PAD.top + (1 - v / maxY) * innerH

  const gridVals = [0, 25, 50, 75, 100].filter(v => v <= maxY)

  function fechaCorta(ms) {
    return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid horizontal */}
        {gridVals.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
              stroke="var(--border)" strokeWidth="1" strokeDasharray={v === 50 ? 'none' : '3 4'} opacity={v === 50 ? 0.9 : 0.5} />
            <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end"
              fontSize="10" fill="var(--text-dim)">{formatY(v)}</text>
          </g>
        ))}

        {/* Series */}
        {series.map(s => {
          if (s.puntos.length === 0) return null
          const pts = s.puntos.map(p => `${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
          const last = s.puntos[s.puntos.length - 1]
          return (
            <g key={s.nombre}>
              {s.puntos.length > 1 && (
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
              )}
              <circle cx={x(last.t)} cy={y(last.y)} r="3.5" fill={s.color} />
            </g>
          )
        })}

        {/* Etiquetas de fecha en los extremos */}
        <text x={PAD.left} y={H - 6} fontSize="10" fill="var(--text-dim)">{fechaCorta(tMin)}</text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="10" fill="var(--text-dim)">{fechaCorta(tMax)}</text>
      </svg>

      {/* Leyenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
        {series.map(s => {
          const last = s.puntos[s.puntos.length - 1]
          return (
            <span key={s.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {s.nombre}
              {last != null && <strong style={{ color: 'var(--text)' }}>{formatY(Math.round(last.y))}</strong>}
            </span>
          )
        })}
      </div>
    </div>
  )
}
