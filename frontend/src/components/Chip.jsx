// Chip de filtro/selección — fuente única. El mismo control se ve igual
// en Inicio, Stats, Sugerencias y Jugadores (coherencia total).
export default function Chip({ label, activo, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: '12px', fontWeight: 600,
      border: activo ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      background: activo ? 'var(--accent-bg)' : 'var(--surface2)',
      color: activo ? 'var(--accent)' : 'var(--text-dim)',
      cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )
}
