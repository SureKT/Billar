import { BolaPool } from './Bola'

// bolasEnMesa: números que siguen en la mesa (no metidas aún)
// grupoPropio: 'lisas' | 'rayadas' | null — para atenuar bolas del rival
// modalidad: 'bola8' | 'bola9'
// bolaObjetivo: número que se debe golpear primero (solo bola9)
export default function SelectorBolas({ seleccionadas, onChange, grupoPropio, bolasEnMesa, modalidad, bolaObjetivo }) {
  const enMesaSet = bolasEnMesa ? new Set(bolasEnMesa) : null

  function isDisabled(n) {
    if (n === 0) return false  // blanca siempre seleccionable
    if (modalidad === 'bola9') return enMesaSet !== null && !enMesaSet.has(n)
    if (n === 8) return false  // en bola8 la 8 siempre seleccionable
    return enMesaSet !== null && !enMesaSet.has(n)
  }

  function isDimmed(n) {
    if (modalidad === 'bola9') return false  // no hay grupos en bola9
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

  // ── Bola 9 layout ───────────────────────────────────────────────────────────
  if (modalidad === 'bola9') {
    const filas = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [0]]
    const etiquetas = ['Bolas (1–9)', 'Blanca']

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
                const esObjetivo = n === bolaObjetivo && n !== 0
                return (
                  <div key={n} style={{
                    display: 'inline-flex',
                    filter: (esObjetivo && !seleccionadas.includes(n))
                      ? 'drop-shadow(0 0 5px rgba(6,182,212,.8))'
                      : 'none',
                  }}>
                    <BolaPool
                      numero={n}
                      size={44}
                      seleccionada={seleccionadas.includes(n)}
                      dimmed={false}
                      metida={disabled}
                      onClick={disabled ? undefined : () => toggle(n)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Bola 8 layout (original) ─────────────────────────────────────────────────
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
                    dimmed={isDimmed(n)}
                    metida={disabled}
                    onClick={disabled ? undefined : () => toggle(n)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
