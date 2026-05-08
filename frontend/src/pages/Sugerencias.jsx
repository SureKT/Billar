import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'

const FORMATO = [
  { label: '1 vs 1', value: 1 },
  { label: '2 vs 2', value: 2 },
]
const MODALIDADES = [
  { label: 'Bola 8', value: 'bola8' },
  { label: 'Bola 9', value: 'bola9' },
]

function Chip({ label, activo, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 20, fontSize: '13px', fontWeight: 600,
      border: activo ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      background: activo ? 'var(--accent-bg)' : 'var(--surface2)',
      color: activo ? 'var(--accent)' : 'var(--text-dim)',
      cursor: 'pointer', transition: 'all .15s',
    }}>{label}</button>
  )
}

function NombreJugador({ jugador }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {jugador.color && (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: jugador.color, flexShrink: 0,
          display: 'inline-block',
        }} />
      )}
      <span style={{ fontWeight: 600 }}>{jugador.nombre}</span>
    </span>
  )
}

function EquipoChip({ jugadores, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3, flex: 1,
    }}>
      {jugadores.map(j => (
        <div key={j.id} style={{ color }}>
          <NombreJugador jugador={j} />
        </div>
      ))}
    </div>
  )
}

function BadgeInteracciones({ enfrentamientos, interacciones }) {
  if (enfrentamientos === 0 && interacciones === 0) {
    return (
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '2px 7px',
        borderRadius: 10, background: 'rgba(134,239,172,.15)',
        color: '#86efac', border: '1px solid rgba(134,239,172,.3)',
      }}>⚡ Sin historial</span>
    )
  }
  if (enfrentamientos === 0) {
    return (
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '2px 7px',
        borderRadius: 10, background: 'rgba(251,191,36,.1)',
        color: '#fbbf24', border: '1px solid rgba(251,191,36,.25)',
      }}>🆕 Primer duelo</span>
    )
  }
  return (
    <span style={{
      fontSize: '10px', color: 'var(--text-dim)',
      padding: '2px 7px', borderRadius: 10,
      background: 'var(--surface2)', border: '1px solid var(--border)',
    }}>
      ⚔ {enfrentamientos}x enfrentados
    </span>
  )
}

function SugerenciaCard({ sug, modalidad, index, onCrear, creando }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 14px 12px',
      display: 'flex', flexDirection: 'column', gap: 10,
      animation: `slideUp .2s ease ${index * 0.05}s both`,
    }}>
      {/* Encabezado: badge de interacción */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
          #{index + 1}
        </span>
        <BadgeInteracciones
          enfrentamientos={sug.enfrentamientos}
          interacciones={sug.interacciones_totales}
        />
      </div>

      {/* Equipos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <EquipoChip jugadores={sug.equipo1} color="var(--team1)" />
        <span style={{
          fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', flexShrink: 0,
        }}>vs</span>
        <EquipoChip jugadores={sug.equipo2} color="var(--team2)" />
      </div>

      {/* Detalle interacciones */}
      {sug.interacciones_totales > 0 && (
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
          {sug.interacciones_totales} partida{sug.interacciones_totales !== 1 ? 's' : ''} juntos
          {sug.enfrentamientos > 0 && `, ${sug.enfrentamientos} como rivales`}
        </p>
      )}

      {/* Botón crear */}
      <button
        className="btn btn-primary"
        disabled={creando}
        onClick={() => onCrear(sug)}
        style={{ width: '100%', marginTop: 2 }}
      >
        {creando ? '…' : `▶ Crear partida ${modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}`}
      </button>
    </div>
  )
}

export default function Sugerencias() {
  const navigate = useNavigate()
  const [formato, setFormato] = useState(1)
  const [modalidad, setModalidad] = useState('bola8')
  const [creando, setCreando] = useState(null)
  const [error, setError] = useState(null)

  const { data: sugerencias, loading } = useApi(
    () => api.getSugerencias(formato),
    [formato],
  )

  async function handleCrear(sug) {
    setCreando(sug)
    setError(null)
    try {
      const partida = await api.crearPartida({
        modalidad,
        equipo1: { jugador_ids: sug.equipo1.map(j => j.id) },
        equipo2: { jugador_ids: sug.equipo2.map(j => j.id) },
      })
      navigate(`/partida/${partida.id}`)
    } catch (e) {
      setError(e.message)
      setCreando(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: 4 }}>
          🎲 Sugerencias de partida
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>
          Enfrentamientos que menos han ocurrido entre los jugadores
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {FORMATO.map(f => (
            <Chip key={f.value} label={f.label} activo={formato === f.value}
              onClick={() => setFormato(f.value)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {MODALIDADES.map(m => (
            <Chip key={m.value} label={m.label} activo={modalidad === m.value}
              onClick={() => setModalidad(m.value)} />
          ))}
        </div>
      </div>

      {error && (
        <p style={{ color: 'var(--accent)', fontSize: '13px', margin: 0 }}>⚠ {error}</p>
      )}

      {loading && <div className="spinner" />}

      {!loading && sugerencias?.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '36px', marginBottom: 10 }}>👤</div>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            Hacen falta al menos {formato * 2} jugadores para sugerir partidas
          </p>
        </div>
      )}

      {!loading && sugerencias && sugerencias.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sugerencias.map((sug, i) => (
            <SugerenciaCard
              key={i}
              sug={sug}
              modalidad={modalidad}
              index={i}
              onCrear={handleCrear}
              creando={creando === sug}
            />
          ))}
        </div>
      )}
    </div>
  )
}
