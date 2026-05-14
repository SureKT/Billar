function SkeletonLine({ width = '100%', height = 12, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: 'var(--border)',
      animation: 'pulse 1.5s ease-in-out infinite',
      flexShrink: 0,
      ...style,
    }} />
  )
}

export function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonLine width="40%" height={14} />
        <SkeletonLine width="22%" height={20} style={{ borderRadius: 20 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SkeletonLine width="42%" height={12} />
        <SkeletonLine width="8%" height={10} />
        <SkeletonLine width="42%" height={12} />
      </div>
      <SkeletonLine width="28%" height={10} />
    </div>
  )
}

export function SkeletonList({ n = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: n }, (_, i) => (
        <SkeletonCard key={i} style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}

export function SkeletonPlayerCard() {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--border)',
        animation: 'pulse 1.5s ease-in-out infinite',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonLine width="45%" height={13} />
        <SkeletonLine width="65%" height={10} />
      </div>
    </div>
  )
}
