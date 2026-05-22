import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'

const NIVEL_STYLE = {
  bronce:  { bg: 'rgba(180,110,60,.2)',  color: '#cd7f32' },
  plata:   { bg: 'rgba(160,170,180,.2)', color: '#a0aab4' },
  oro:     { bg: 'rgba(251,191,36,.2)',  color: '#fbbf24' },
  platino: { bg: 'rgba(139,92,246,.2)',  color: '#a78bfa' },
}
const NIVEL_EMOJI = { bronce: '🥉', plata: '🥈', oro: '🥇', platino: '💎' }

function NivelBadge({ nivel, desbloqueado }) {
  const { bg, color } = NIVEL_STYLE[nivel]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
      background: desbloqueado ? bg : 'rgba(255,255,255,.04)',
      color: desbloqueado ? color : '#444',
      border: `1px solid ${desbloqueado ? color : '#333'}`,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {NIVEL_EMOJI[nivel]} {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
      {desbloqueado && <span style={{ fontSize: 9 }}>✓</span>}
    </span>
  )
}

function LogroRow({ logro }) {
  const bloqueado = !logro.desbloqueado
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', borderRadius: 8,
      background: bloqueado ? '#111' : 'rgba(6,182,212,.06)',
      border: `1px solid ${bloqueado ? '#222' : 'rgba(6,182,212,.25)'}`,
      marginBottom: 6,
      opacity: bloqueado ? 0.45 : 1,
    }}>
      <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0, marginTop: 2 }}>
        {logro.icono}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: bloqueado ? '#64748b' : '#e2e8f0', marginBottom: 2 }}>
          {logro.nombre}
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{logro.descripcion}</div>
        {logro.niveles.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
            {logro.niveles.map(n => (
              <NivelBadge
                key={n.nivel}
                nivel={n.nivel}
                desbloqueado={logro.niveles_desbloqueados?.includes(n.nivel)}
              />
            ))}
          </div>
        )}
      </div>
      {!bloqueado && logro.niveles.length === 0 && (
        <span style={{ color: '#06b6d4', fontSize: 16, alignSelf: 'center', flexShrink: 0 }}>✓</span>
      )}
    </div>
  )
}

export default function Logros() {
  const { data: jugadores } = useApi(api.getJugadores)
  const { data: catalogo } = useApi(api.getLogrosCatalogo)
  const [jugadorId, setJugadorId] = useState(null)
  const [logros, setLogros] = useState(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!jugadorId) { setLogros(null); return }
    let cancelled = false
    setCargando(true)
    api.getLogrosJugador(jugadorId)
      .then(data => { if (!cancelled) setLogros(data) })
      .catch(() => { if (!cancelled) setLogros(null) })
      .finally(() => { if (!cancelled) setCargando(false) })
    return () => { cancelled = true }
  }, [jugadorId])

  const lista = logros ?? catalogo?.map(c => ({ ...c, desbloqueado: false, niveles_desbloqueados: [] }))
  const jugadoresActivos = (jugadores ?? []).filter(j => j.activo)
  const desbloqueados = logros ? logros.filter(l => l.desbloqueado).length : null

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
          🏅 Logros
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
          {jugadorId && desbloqueados !== null
            ? `${desbloqueados} de ${lista?.length ?? 0} desbloqueados`
            : `${lista?.length ?? 0} logros en total`}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => setJugadorId(null)}
          style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: jugadorId === null ? 'var(--accent)' : 'var(--surface2)',
            color: jugadorId === null ? '#000' : 'var(--text-dim)',
            border: `1px solid ${jugadorId === null ? 'var(--accent)' : 'var(--border)'}`,
            cursor: 'pointer',
          }}
        >
          Todos
        </button>
        {jugadoresActivos.map(j => (
          <button
            key={j.id}
            onClick={() => setJugadorId(j.id === jugadorId ? null : j.id)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: jugadorId === j.id ? 'var(--accent)' : 'var(--surface2)',
              color: jugadorId === j.id ? '#000' : 'var(--text-dim)',
              border: `1px solid ${jugadorId === j.id ? 'var(--accent)' : 'var(--border)'}`,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            {j.color && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: j.color, flexShrink: 0 }} />
            )}
            {j.nombre}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32, fontSize: 13 }}>
          Calculando…
        </div>
      ) : !lista ? (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32, fontSize: 13 }}>
          Cargando…
        </div>
      ) : (
        <div>
          {lista.map(logro => <LogroRow key={logro.id} logro={logro} />)}
        </div>
      )}
    </div>
  )
}
