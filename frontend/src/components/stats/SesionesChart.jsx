// Victorias por jugador en las últimas N sesiones — barras apiladas por sesión.
// Reutiliza el criterio de sesión (<4h) y el marcador compartidos en utils/sesiones.
import { marcadorSesion } from '../../utils/sesiones'
import { colorJugador, fechaCorta } from './StatPrimitives'

export default function SesionesChart({ sesiones, jugadores, max = 8, altura = 130 }) {
  // sesiones llegan desc (más reciente primero) → mostrar cronológico izq→der
  const visibles = sesiones.slice(0, max).reverse()
  if (visibles.length === 0) return null

  const idxColor = new Map((jugadores ?? []).map((j, i) => [j.id, i]))

  const barras = visibles.map(s => {
    const marcador = marcadorSesion(s.partidas, jugadores)
    const segmentos = marcador
      .filter(m => m.victorias > 0)
      .map(m => ({
        id: m.id,
        nombre: m.jugador?.nombre ?? `#${m.id}`,
        victorias: m.victorias,
        color: colorJugador(m.jugador, idxColor.get(m.id) ?? 0),
      }))
    return {
      clave: s.clave,
      label: fechaCorta(s.fechaRef),
      total: segmentos.reduce((acc, seg) => acc + seg.victorias, 0),
      partidas: s.partidas.length,
      segmentos,
    }
  })

  const maxTotal = Math.max(...barras.map(b => b.total), 1)

  // Leyenda: jugadores que aparecen en alguna sesión visible
  const enJuego = new Map()
  for (const b of barras) for (const seg of b.segmentos) enJuego.set(seg.id, seg)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: altura + 34 }}>
        {barras.map(b => (
          <div key={b.clave} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1 }}>
              {b.partidas}p
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: altura, width: '100%', gap: 1 }}>
              {b.segmentos.map((seg, i) => (
                <div key={seg.id} title={`${seg.nombre}: ${seg.victorias}`} style={{
                  height: Math.max(Math.round((seg.victorias / maxTotal) * altura), 3),
                  background: seg.color, opacity: .85,
                  borderRadius: i === 0 ? '4px 4px 0 0' : 0,
                }} />
              ))}
            </div>
            <span style={{
              fontSize: 9.5, color: 'var(--text-dim)', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center',
            }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
        {[...enJuego.values()].map(seg => (
          <span key={seg.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            {seg.nombre}
          </span>
        ))}
      </div>
    </div>
  )
}
