// Colores oficiales de las bolas de billar pool
const COLORES = {
  1:  '#f5c800', // amarilla
  2:  '#1a5fa8', // azul
  3:  '#d62b2b', // roja
  4:  '#6b2f8a', // morada
  5:  '#e8620a', // naranja
  6:  '#1a7a3a', // verde
  7:  '#8b1a1a', // marrón
  8:  '#111111', // negra
  9:  '#f5c800', // amarilla rayada
  10: '#1a5fa8', // azul rayada
  11: '#d62b2b', // roja rayada
  12: '#6b2f8a', // morada rayada
  13: '#e8620a', // naranja rayada
  14: '#1a7a3a', // verde rayada
  15: '#8b1a1a', // marrón rayada
}

export function BolaPool({ numero, size = 40, seleccionada = false, dimmed = false, metida = false, onClick }) {
  const esRayada = numero >= 9 && numero <= 15
  const esBlanca = numero === 0
  const esOcho = numero === 8
  const color = esBlanca ? '#f0f0f0' : COLORES[numero] ?? '#888'
  const textColor = '#222'
  const r = size / 2
  const stripeH = size * 0.65

  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
        opacity: dimmed ? 0.45 : 1,
        transform: seleccionada ? 'scale(1.2)' : 'scale(1)',
        transition: 'transform .15s, opacity .15s, filter .15s',
        filter: seleccionada
          ? 'drop-shadow(0 0 6px rgba(255,255,255,.8))'
          : metida ? 'grayscale(1) opacity(0.5)' : 'none',
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <clipPath id={`clip-${numero}-${size}`}>
            <circle cx={r} cy={r} r={r - 1} />
          </clipPath>
          {/* Sombra interna para efecto 3D */}
          <radialGradient id={`grad-${numero}-${size}`} cx="38%" cy="32%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
          </radialGradient>
        </defs>

        {/* Fondo base: blanco para rayadas, color para lisas/especiales */}
        <circle cx={r} cy={r} r={r - 1} fill={esRayada ? '#f2f2f2' : color} />

        {/* Franja de color para rayadas (inverso: fondo blanco + raya de color) */}
        {esRayada && (
          <rect
            x={0} y={r - stripeH / 2}
            width={size} height={stripeH}
            fill={color}
            clipPath={`url(#clip-${numero}-${size})`}
          />
        )}

        {/* Círculo interior */}
        {!esBlanca && (
          <circle cx={r} cy={r} r={r * 0.5} fill={esRayada ? '#f2f2f2' : 'white'} />
        )}

        {/* Número */}
        {!esBlanca && (
          <text
            x={r} y={r}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={r * 0.70}
            fontWeight="700"
            fontFamily="-apple-system, sans-serif"
            fill={textColor}
          >
            {numero}
          </text>
        )}

        {/* Gradiente 3D encima */}
        <circle cx={r} cy={r} r={r - 1} fill={`url(#grad-${numero}-${size})`} />

        {/* Borde selección */}
        {seleccionada && (
          <circle cx={r} cy={r} r={r - 1.5} fill="none" stroke="white" strokeWidth={2.5} />
        )}
      </svg>
    </button>
  )
}
