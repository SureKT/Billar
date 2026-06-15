// Gráfica de líneas SVG multi-serie. Sin dependencias.
// series: [{ nombre, color, puntos: [{ t: timestamp_ms, y: number }] }]
// Dominio Y dinámico: se ajusta a los datos (soporta valores negativos) con
// línea base en 0 destacada. Apto para métricas con signo (diferencial acumulado).

const PAD = { top: 10, right: 14, bottom: 22, left: 38 }

// Genera ~4-5 ticks enteros "redondos" que cubran [lo, hi], incluyendo el 0.
// La métrica es de valores enteros → el paso nunca baja de 1.
function ticksEnteros(lo, hi) {
  const span = Math.max(hi - lo, 1)
  const rawStep = span / 4
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const step = Math.max(1, Math.round((norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag))
  const start = Math.ceil(lo / step) * step
  const out = []
  for (let v = start; v <= hi + 1e-9; v += step) out.push(Math.round(v) || 0)  // || 0 normaliza -0
  if (!out.includes(0) && lo <= 0 && hi >= 0) out.push(0)
  return [...new Set(out)].sort((a, b) => a - b)
}

export default function LineChart({ series, height = 200, formatY = v => `${v}`, viewW = 600 }) {
  const W = viewW
  const H = height
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const todos = series.flatMap(s => s.puntos)
  if (todos.length === 0) return null
  const tMin = Math.min(...todos.map(p => p.t))
  const tMax = Math.max(...todos.map(p => p.t))
  const tSpan = Math.max(tMax - tMin, 1)

  // Dominio Y: cubre datos + el 0, con un 10% de margen arriba y abajo
  const yVals = todos.map(p => p.y)
  let loY = Math.min(0, ...yVals)
  let hiY = Math.max(0, ...yVals)
  const margen = Math.max((hiY - loY) * 0.1, 1)
  loY -= margen
  hiY += margen
  const ySpan = Math.max(hiY - loY, 1)

  const x = t => PAD.left + ((t - tMin) / tSpan) * innerW
  const y = v => PAD.top + (1 - (v - loY) / ySpan) * innerH

  const gridVals = ticksEnteros(loY, hiY)

  function fechaCorta(ms) {
    return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid horizontal — la línea del 0 (equilibrio) va destacada */}
        {gridVals.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
              stroke="var(--border)" strokeWidth="1" strokeDasharray={v === 0 ? 'none' : '3 4'} opacity={v === 0 ? 0.9 : 0.5} />
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
