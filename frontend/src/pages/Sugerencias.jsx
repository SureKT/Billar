import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import Chip from '../components/Chip'

const FORMATO = [
  { label: '1 vs 1', value: 1 },
  { label: '2 vs 2', value: 2 },
]
const MODALIDADES = [
  { label: 'Bola 8', value: 'bola8' },
  { label: 'Bola 9', value: 'bola9' },
]

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

function BadgeInteracciones({ enfrentamientos, partidas_juntos, formato }) {
  const esEquipo = formato === 2
  if (enfrentamientos === 0 && partidas_juntos === 0) {
    return (
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '2px 7px',
        borderRadius: 10, background: 'rgba(134,239,172,.15)',
        color: '#86efac', border: '1px solid rgba(134,239,172,.3)',
      }}>⚡ Sin historial {esEquipo ? '2v2' : '1v1'}</span>
    )
  }
  if (enfrentamientos === 0) {
    return (
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '2px 7px',
        borderRadius: 10, background: 'rgba(251,191,36,.1)',
        color: '#fbbf24', border: '1px solid rgba(251,191,36,.25)',
      }}>🆕 Primer duelo {esEquipo ? '2v2' : '1v1'}</span>
    )
  }
  return (
    <span style={{
      fontSize: '10px', color: 'var(--text-dim)',
      padding: '2px 7px', borderRadius: 10,
      background: 'var(--surface2)', border: '1px solid var(--border)',
    }}>
      ⚔ {enfrentamientos}x {esEquipo ? 'estos equipos' : 'directos'}
    </span>
  )
}

function SugerenciaCard({ sug, modalidad, formato, index, onCrear, creando }) {
  const esEquipo = formato === 2
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
          partidas_juntos={sug.partidas_juntos}
          formato={formato}
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

      {/* Detalle histórico */}
      {(sug.enfrentamientos > 0 || sug.partidas_juntos > 0) && (
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: 0 }}>
          {esEquipo ? (
            <>
              {sug.enfrentamientos > 0
                ? `${sug.enfrentamientos} vez${sug.enfrentamientos !== 1 ? 'ces' : ''} estos equipos exactos`
                : 'Nunca estos equipos exactos'}
              {sug.partidas_juntos > sug.enfrentamientos &&
                ` · ${sug.partidas_juntos} partida${sug.partidas_juntos !== 1 ? 's' : ''} juntos en 2v2`}
            </>
          ) : (
            `${sug.enfrentamientos} duelo${sug.enfrentamientos !== 1 ? 's' : ''} directo${sug.enfrentamientos !== 1 ? 's' : ''} 1v1`
          )}
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
    () => api.getSugerencias(formato, modalidad),
    [formato, modalidad],
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
      navigate(`/partida/${partida.id}`, { state: { logrosNuevos: partida.logros_nuevos } })
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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {FORMATO.map(f => (
          <Chip key={f.value} label={f.label} activo={formato === f.value}
            onClick={() => setFormato(f.value)} />
        ))}
        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
        {MODALIDADES.map(m => (
          <Chip key={m.value} label={m.label} activo={modalidad === m.value}
            onClick={() => setModalidad(m.value)} />
        ))}
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
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
          {sugerencias.map((sug, i) => (
            <SugerenciaCard
              key={i}
              sug={sug}
              modalidad={modalidad}
              formato={formato}
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
