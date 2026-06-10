import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMediaQuery } from '../hooks/useMediaQuery'

function Seccion({ titulo, children, defaultOpen = false, siempreAbierta = false, id }) {
  const [open, setOpen] = useState(defaultOpen)
  const abierta = siempreAbierta || open
  return (
    <div id={id} style={{ borderBottom: '1px solid var(--border)', scrollMarginTop: 56 }}>
      <button
        onClick={() => !siempreAbierta && setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: siempreAbierta ? 'default' : 'pointer',
          padding: '13px 0', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{titulo}</span>
        {!siempreAbierta && (
          <span style={{ fontSize: 12, color: 'var(--text-dim)', transition: 'transform .15s', transform: abierta ? 'rotate(90deg)' : 'none' }}>▶</span>
        )}
      </button>
      {abierta && (
        <div style={{ paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Regla({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{children}</span>
    </div>
  )
}

function Tabla({ rows }) {
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 4 }}>
      {rows.map(([cond, result], i) => (
        <div key={i} style={{
          display: 'flex', gap: 10,
          padding: '8px 12px',
          background: i % 2 === 0 ? 'var(--surface2)' : 'transparent',
          borderTop: i > 0 ? '1px solid var(--border-dim)' : 'none',
        }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{cond}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, flexShrink: 0, alignSelf: 'center',
            color: result === 'Ganas' ? '#4ade80' : result === 'Pierdes' ? '#f87171' : 'var(--text-dim)',
          }}>{result}</span>
        </div>
      ))}
    </div>
  )
}

function ModoBola8({ abiertas }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 22 }}>⚫</span>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Bola 8</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '2px 0 0' }}>Pool americano — el clásico</p>
        </div>
      </div>

      <Seccion id="objetivo" titulo="Objetivo" defaultOpen siempreAbierta={abiertas}>
        <Regla label="🎯">
          Meter todas las bolas de tu grupo (lisas 1–7 o rayadas 9–15) y después la bola 8.
        </Regla>
        <Regla label="👥">
          Los grupos se asignan durante la partida, no antes del saque.
        </Regla>
      </Seccion>

      <Seccion id="saque" titulo="Saque (break)" siempreAbierta={abiertas}>
        <Regla label="✓">
          Si metes bolas en el saque, no se asignan grupos todavía — tienes que confirmarlos en un turno posterior.
        </Regla>
        <Regla label="✓">
          Si no metes nada, el turno pasa al rival.
        </Regla>
        <Regla label="✗">
          Si metes la bola 8 en el saque → <strong>pierdes la partida</strong>.
        </Regla>
        <Regla label="⚡">
          Falta en el saque → bola en mano para el rival (sin asignación de grupos).
        </Regla>
      </Seccion>

      <Seccion id="grupos" titulo="Asignación de grupos" siempreAbierta={abiertas}>
        <Regla label="📋">
          El grupo se asigna en el primer turno (post-saque) donde metes al menos una bola, todas son del mismo tipo (todas lisas o todas rayadas), ninguna es la 8, y no hay falta.
        </Regla>
        <Regla label="📋">
          El jugador que ejecuta ese turno recibe el tipo de bola que metió. El rival recibe el tipo contrario.
        </Regla>
        <Regla label="⚠️">
          Si metes bolas de tipos distintos en el mismo turno (sin falta), los grupos no se asignan ese turno.
        </Regla>
      </Seccion>

      <Seccion id="bola8" titulo="Bola 8" siempreAbierta={abiertas}>
        <Regla label="✓">
          Puedes intentar meter la 8 solo cuando no te queden bolas pendientes de tu grupo en la mesa.
        </Regla>
        <Regla label="✗">
          Meter la 8 con bolas pendientes → <strong>pierdes</strong>.
        </Regla>
        <Regla label="✗">
          Meter la 8 cometiendo cualquier falta → <strong>pierdes</strong>, aunque no te quedaran pendientes.
        </Regla>
        <Regla label="✗">
          Meter la 8 y la blanca en el mismo turno → <strong>pierdes</strong>.
        </Regla>
      </Seccion>

      <Seccion id="faltas" titulo="Faltas" siempreAbierta={abiertas}>
        <Regla label="⚡">
          Falta normal (no toca objetivo legal, blanca dentro…) → bola en mano para el rival.
        </Regla>
        <Regla label="⚡⚡">
          Tres faltas consecutivas del mismo equipo → <strong>pierde la partida</strong>.
        </Regla>
        <Regla label="⚡⚡">
          Bola 8 ilegal (meter la 8 con pendientes) → <strong>pierde la partida</strong>.
        </Regla>
      </Seccion>

      <Seccion id="tabla" titulo="Tabla de resultados" siempreAbierta={abiertas}>
        <Tabla rows={[
          ['Metes la 8 sin pendientes, sin falta', 'Ganas'],
          ['Metes la 8 con pendientes de tu grupo', 'Pierdes'],
          ['Metes la 8 + cualquier falta', 'Pierdes'],
          ['Metes la 8 + blanca en mismo turno', 'Pierdes'],
          ['Metes la 8 en el saque', 'Pierdes'],
          ['Falta "Bola 8 ilegal"', 'Pierdes'],
          ['Tres faltas consecutivas del equipo', 'Pierdes'],
        ]} />
      </Seccion>
    </div>
  )
}

function ModoBola9({ abiertas }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 22 }}>🟡</span>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Bola 9</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '2px 0 0' }}>Pool de 9 bolas — más rápido</p>
        </div>
      </div>

      <Seccion id="objetivo" titulo="Objetivo" defaultOpen siempreAbierta={abiertas}>
        <Regla label="🎯">
          Meter la bola 9. No hay grupos — cualquier jugador puede ganar en cualquier momento.
        </Regla>
        <Regla label="📋">
          Se juega con bolas 1–9. Siempre hay que golpear primero la bola de número más bajo en la mesa.
        </Regla>
      </Seccion>

      <Seccion id="saque" titulo="Saque (break)" siempreAbierta={abiertas}>
        <Regla label="✓">
          Si metes la 9 en el saque → <strong>Golden Break, ganas</strong>.
        </Regla>
        <Regla label="✓">
          Si metes otras bolas, repites turno.
        </Regla>
        <Regla label="⚡">
          Falta en el saque → bola en mano para el rival.
        </Regla>
      </Seccion>

      <Seccion id="durante" titulo="Durante la partida" siempreAbierta={abiertas}>
        <Regla label="📋">
          Debes golpear primero la bola de número más bajo. Puedes meter cualquier bola de carambola.
        </Regla>
        <Regla label="✓">
          Metes la 9 directa o de carambola (sin falta) → <strong>ganas</strong>.
        </Regla>
        <Regla label="✓">
          Metes cualquier bola 1–8 sin falta → repites turno.
        </Regla>
        <Regla label="✗">
          No metes nada → turno pasa al rival.
        </Regla>
      </Seccion>

      <Seccion id="respot" titulo="Bola 9 + blanca" siempreAbierta={abiertas}>
        <Regla label="⚡">
          Si metes la 9 y la blanca en el mismo turno → la 9 vuelve a la mesa (respot), bola en mano para el rival. No ganas.
        </Regla>
      </Seccion>

      <Seccion id="faltas" titulo="Faltas" siempreAbierta={abiertas}>
        <Regla label="⚡">
          Falta (no golpear bola más baja, blanca dentro, no toca banda…) → bola en mano para el rival.
        </Regla>
        <Regla label="⚡⚡">
          Tres faltas consecutivas del mismo equipo → <strong>pierde la partida</strong>.
        </Regla>
      </Seccion>

      <Seccion id="tabla" titulo="Tabla de resultados" siempreAbierta={abiertas}>
        <Tabla rows={[
          ['Metes la 9 sin falta (incluso en saque)', 'Ganas'],
          ['Metes la 9 + blanca simultáneas', 'Respot · bola en mano rival'],
          ['Falta normal', 'Bola en mano rival'],
          ['Tres faltas consecutivas del equipo', 'Pierdes'],
        ]} />
      </Seccion>
    </div>
  )
}

const SECCIONES = {
  bola8: [
    ['objetivo', 'Objetivo'], ['saque', 'Saque (break)'], ['grupos', 'Asignación de grupos'],
    ['bola8', 'Bola 8'], ['faltas', 'Faltas'], ['tabla', 'Tabla de resultados'],
  ],
  bola9: [
    ['objetivo', 'Objetivo'], ['saque', 'Saque (break)'], ['durante', 'Durante la partida'],
    ['respot', 'Bola 9 + blanca'], ['faltas', 'Faltas'], ['tabla', 'Tabla de resultados'],
  ],
}

export default function Reglas() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [modo, setModo] = useState(searchParams.get('modo') === 'bola9' ? 'bola9' : 'bola8')
  const desktop = useMediaQuery('(min-width: 1024px)')

  const cabecera = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
        >←</button>
        <h2 style={{ fontSize: 20, margin: 0 }}>Reglas</h2>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[['bola8', '⚫ Bola 8'], ['bola9', '🟡 Bola 9']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setModo(val)}
            style={{
              flex: 1, padding: '10px',
              borderRadius: 8, fontSize: 14, fontWeight: 700,
              border: modo === val ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: modo === val ? 'rgba(6,182,212,.13)' : 'var(--surface2)',
              color: modo === val ? 'var(--accent)' : 'var(--text)',
              transition: 'all .15s',
            }}
          >{label}</button>
        ))}
      </div>
    </>
  )

  const contenido = modo === 'bola8' ? <ModoBola8 abiertas={desktop} /> : <ModoBola9 abiertas={desktop} />

  if (desktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        {cabecera}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)',
          display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 0',
        }}>
          {SECCIONES[modo].map(([id, titulo]) => (
            <button
              key={id}
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 16,
                padding: '4px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', cursor: 'pointer',
              }}
              className="hoverable"
            >{titulo}</button>
          ))}
        </div>
        {contenido}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', maxWidth: 800, margin: '0 auto', width: '100%' }}>
      {cabecera}
      {contenido}
    </div>
  )
}
