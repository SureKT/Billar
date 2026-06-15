// Primitivas de estadísticas compartidas entre Jugadores y Estadísticas.
// Fuente única → el mismo dato se muestra igual en todos los contextos.

import { parseFecha } from '../../utils/fecha'

// Paleta de respaldo cuando el jugador no tiene color asignado
export const COLORES_FALLBACK = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16']

export function colorJugador(jugador, i) {
  return jugador?.color ?? COLORES_FALLBACK[i % COLORES_FALLBACK.length]
}

export function pct(ganadas, jugadas) {
  return jugadas === 0 ? 0 : Math.round((ganadas / jugadas) * 100)
}

export function winrate(j) {
  return j.partidas_jugadas > 0 ? j.partidas_ganadas / j.partidas_jugadas : -1
}

export function fechaCorta(isoStr) {
  return parseFecha(isoStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Tile centrado: número grande + sub opcional + etiqueta.
export function StatTile({ label, value, sub, color, compact }) {
  return (
    <div style={{
      flex: 1, background: 'var(--surface2)', borderRadius: 10,
      padding: '12px 8px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      minWidth: 0,
    }}>
      <span style={{
        fontSize: compact ? '15px' : '22px', fontWeight: 800,
        color: color ?? 'var(--text)', lineHeight: 1, whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
      {sub != null && (
        <span style={{ fontSize: '10px', color: color ? `${color}99` : 'var(--accent)', fontWeight: 600, lineHeight: 1 }}>
          {sub}
        </span>
      )}
      <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', marginTop: 1 }}>
        {label}
      </span>
    </div>
  )
}

// Barra de win rate con etiqueta y porcentaje.
export function WinRateBar({ ganadas, jugadas, label = 'Win rate' }) {
  const p = pct(ganadas, jugadas)
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{p}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${p}%`,
          background: p >= 50 ? '#16a34a' : 'var(--accent)',
          borderRadius: 3, transition: 'width .4s ease',
        }} />
      </div>
    </div>
  )
}
