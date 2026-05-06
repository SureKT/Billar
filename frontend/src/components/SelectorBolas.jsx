import { BolaPool } from './Bola'

// bolasEnMesa: números que siguen en la mesa (no metidas aún)
// grupoPropio: 'lisas' | 'rayadas' | null — para atenuar bolas del rival
export default function SelectorBolas({ seleccionadas, onChange, grupoPropio, bolasEnMesa }) {
  const enMesaSet = bolasEnMesa ? new Set(bolasEnMesa) : null

  function isDisabled(n) {
    // La blanca (0) y la 8 nunca se filtran — siempre seleccionables
    if (n === 0 || n === 8) return false
    // Si tenemos info de la mesa, solo permitir bolas que siguen en ella
    return enMesaSet !== null && !enMesaSet.has(n)
  }

  function isDimmed(n) {
    if (!grupoPropio || n === 8 || n === 0) return false
    if (grupoPropio === 'lisas') return n >= 9 && n <= 15
    if (grupoPropio === 'rayadas') return n >= 1 && n <= 7
    return false
  }

  function toggle(n) {
    if (isDisabled(n)) return
    onChange(
      seleccionadas.includes(n)
        ? seleccionadas.filter(x => x !== n)
        : [...seleccionadas, n]
    )
  }

  const filas = [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 0],
    [9, 10, 11, 12, 13, 14, 15],
  ]
  const etiquetas = ['Lisas (1–7)', 'Especiales', 'Rayadas (9–15)']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {filas.map((grupo, i) => (
        <div key={i}>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {etiquetas[i]}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {grupo.map(n => {
              const disabled = isDisabled(n)
              return (
                <div key={n} style={{ position: 'relative' }}>
                  <BolaPool
                    numero={n}
                    size={44}
                    seleccionada={seleccionadas.includes(n)}
                    dimmed={disabled || isDimmed(n)}
                    onClick={disabled ? undefined : () => toggle(n)}
                  />
                  {/* Tachado visual para bolas ya metidas */}
                  {disabled && (
                    <svg
                      width={44} height={44}
                      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                    >
                      <line x1="10" y1="10" x2="34" y2="34" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="34" y1="10" x2="10" y2="34" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
