// Barras verticales simples con valor encima y etiqueta debajo. Sin dependencias.
// datos: [{ label, value, color? }]
export default function BarrasVerticales({ datos, altura = 130, color = 'var(--accent)' }) {
  if (datos.length === 0) return null
  const max = Math.max(...datos.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: altura + 34 }}>
      {datos.map((d, i) => {
        const h = Math.max(Math.round((d.value / max) * altura), d.value > 0 ? 3 : 0)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: d.value > 0 ? 'var(--text)' : 'var(--text-dim)', lineHeight: 1 }}>
              {d.value}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: altura, width: '100%' }}>
              <div style={{
                height: h, background: d.color ?? color, borderRadius: '4px 4px 0 0',
                opacity: .85, transition: 'height .4s ease',
              }} />
            </div>
            <span style={{
              fontSize: 9.5, color: 'var(--text-dim)', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center',
            }}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
