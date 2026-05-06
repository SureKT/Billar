import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'

function SelectorEquipo({ titulo, jugadores, seleccionados, onChange, excluidos }) {
  function toggle(id) {
    onChange(
      seleccionados.includes(id)
        ? seleccionados.filter(x => x !== id)
        : [...seleccionados, id]
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontWeight: 700, fontSize: '15px' }}>{titulo}</p>
        <span style={{ fontSize: '13px', color: seleccionados.length > 0 ? '#86efac' : 'var(--text-dim)' }}>
          {seleccionados.length === 0 ? 'Sin jugadores' : `${seleccionados.length} seleccionado${seleccionados.length > 1 ? 's' : ''}`}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {jugadores.map(j => {
          const excluido = excluidos.includes(j.id)
          const sel = seleccionados.includes(j.id)
          return (
            <button
              key={j.id}
              disabled={excluido}
              onClick={() => toggle(j.id)}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                fontSize: '14px',
                fontWeight: 600,
                border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: sel ? 'rgba(233,69,96,.15)' : excluido ? 'transparent' : 'var(--surface2)',
                color: sel ? 'var(--accent)' : excluido ? 'var(--text-dim)' : 'var(--text)',
                opacity: excluido ? .35 : 1,
                cursor: excluido ? 'not-allowed' : 'pointer',
                transition: 'background .15s, border-color .15s, color .15s',
              }}
            >
              {sel ? '✓ ' : ''}{j.nombre}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function NuevaPartida() {
  const { data: jugadores, loading } = useApi(api.getJugadores)
  const [modalidad, setModalidad] = useState('bola8')
  const [equipo1, setEquipo1] = useState([])
  const [equipo2, setEquipo2] = useState([])
  const [error, setError] = useState(null)
  const [creando, setCreando] = useState(false)
  const navigate = useNavigate()

  async function crear() {
    if (equipo1.length === 0 || equipo2.length === 0) {
      setError('Cada equipo necesita al menos un jugador')
      return
    }
    setError(null)
    setCreando(true)
    try {
      const p = await api.crearPartida({
        modalidad,
        equipo1: { jugador_ids: equipo1 },
        equipo2: { jugador_ids: equipo2 },
      })
      navigate(`/partida/${p.id}`)
    } catch (err) {
      setError(err.message)
      setCreando(false)
    }
  }

  if (loading) return <div className="spinner" />

  const jList = jugadores || []
  const listo = equipo1.length > 0 && equipo2.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h2 style={{ fontSize: '20px' }}>Nueva partida</h2>

      {/* Modalidad */}
      <div className="card">
        <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', marginBottom: 10 }}>
          Modalidad
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['bola8', 'Bola 8'], ['bola9', 'Bola 9']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setModalidad(val)}
              style={{
                flex: 1, padding: '10px',
                borderRadius: 8, fontSize: '15px', fontWeight: 700,
                border: modalidad === val ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: modalidad === val ? 'rgba(233,69,96,.15)' : 'var(--surface2)',
                color: modalidad === val ? 'var(--accent)' : 'var(--text)',
                transition: 'all .15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {jList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 16px' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 12 }}>Primero añade jugadores</p>
          <button className="btn btn-primary" onClick={() => navigate('/jugadores')}>
            Ir a Jugadores
          </button>
        </div>
      ) : (
        <>
          <SelectorEquipo
            titulo="Equipo 1"
            jugadores={jList}
            seleccionados={equipo1}
            onChange={setEquipo1}
            excluidos={equipo2}
          />
          <SelectorEquipo
            titulo="Equipo 2"
            jugadores={jList}
            seleccionados={equipo2}
            onChange={setEquipo2}
            excluidos={equipo1}
          />
        </>
      )}

      {error && (
        <p style={{ color: 'var(--accent)', fontSize: '14px', textAlign: 'center' }}>{error}</p>
      )}

      <button
        className="btn btn-primary btn-full"
        onClick={crear}
        disabled={creando || !listo}
        style={{ padding: '15px', fontSize: '17px', marginTop: 4, borderRadius: 10 }}
      >
        {creando ? 'Creando…' : listo ? '¡Empezar partida!' : 'Selecciona los equipos'}
      </button>
    </div>
  )
}
