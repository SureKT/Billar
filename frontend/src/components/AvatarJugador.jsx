export default function AvatarJugador({ nombre, color, size = 28 }) {
  const initials = (nombre || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color ? `${color}28` : 'var(--surface2)',
      border: `1.5px solid ${color || 'var(--border)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize: Math.round(size * 0.37),
      fontWeight: 700,
      color: color || 'var(--text-dim)',
      letterSpacing: '-0.01em',
      userSelect: 'none',
    }}>
      {initials}
    </div>
  )
}
