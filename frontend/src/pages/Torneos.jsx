import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import AvatarJugador from '../components/AvatarJugador'

function ModalidadChip({ modalidad }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
      background: modalidad === 'bola8' ? 'rgba(255,255,255,.1)' : 'rgba(234,179,8,.15)',
      color: modalidad === 'bola8' ? '#d1d5db' : '#fbbf24',
      border: `1px solid ${modalidad === 'bola8' ? 'rgba(255,255,255,.15)' : 'rgba(234,179,8,.3)'}`,
    }}>
      {modalidad === 'bola8' ? 'B8' : 'B9'}
    </span>
  )
}

function TorneoCard({ torneo, onClick }) {
  const pct = torneo.total > 0 ? (torneo.jugados / torneo.total) * 100 : 0
  const top2 = torneo.clasificacion.slice(0, 2)

  return (
    <div className="hoverable" onClick={onClick} style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🏆</span>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{torneo.nombre}</span>
        <ModalidadChip modalidad={torneo.modalidad} />
        {torneo.estado === 'finalizado' && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)', background: 'rgba(255,255,255,.06)', padding: '2px 6px', borderRadius: 5 }}>
            Finalizado
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)' }}>
          <span>{torneo.jugados}/{torneo.total} partidas</span>
          <span>{torneo.jugadores.length} jugadores</span>
        </div>
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: torneo.estado === 'finalizado' ? '#22c55e' : 'var(--accent)', borderRadius: 2, transition: 'width .3s' }} />
        </div>
      </div>

      {top2.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          {top2.map((e, i) => (
            <div key={e.jugador_id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <span>{i === 0 ? '🥇' : '🥈'}</span>
              <AvatarJugador nombre={e.nombre} color={e.color} size={20} />
              <span style={{ color: 'var(--text)' }}>{e.nombre}</span>
              <span style={{ color: 'var(--text-dim)' }}>{e.puntos}pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Torneos() {
  const navigate = useNavigate()
  const [torneos, setTorneos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({ nombre: '', modalidad: 'bola8', jugador_ids: [] })
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    api.getTorneos().then(setTorneos).catch(() => {})
    api.getJugadores().then(js => setJugadores(js.filter(j => j.activo))).catch(() => {})
  }, [])

  function toggleJugador(id) {
    setForm(f => ({
      ...f,
      jugador_ids: f.jugador_ids.includes(id)
        ? f.jugador_ids.filter(x => x !== id)
        : [...f.jugador_ids, id],
    }))
  }

  async function handleCrear() {
    if (form.jugador_ids.length < 3) return setError('Mínimo 3 jugadores')
    setCargando(true)
    setError(null)
    try {
      const nombre = form.nombre.trim() || `Torneo ${torneos.length + 1}`
      const t = await api.crearTorneo({ ...form, nombre })
      setTorneos(prev => [t, ...prev])
      setCreando(false)
      setForm({ nombre: '', modalidad: 'bola8', jugador_ids: [] })
      navigate(`/torneo/${t.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  const nPartidas = (form.jugador_ids.length * (form.jugador_ids.length - 1)) / 2

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Torneos</h2>
        {!creando && (
          <button onClick={() => setCreando(true)} style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '7px 14px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            ＋ Nuevo
          </button>
        )}
      </div>

      {creando && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Nuevo torneo</div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Nombre (opcional)</div>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder={`Torneo ${torneos.length + 1}`}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 14,
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Modalidad</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['bola8', 'bola9'].map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, modalidad: m }))} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  border: `2px solid ${form.modalidad === m ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.modalidad === m ? 'rgba(6,182,212,.1)' : 'var(--bg)',
                  color: form.modalidad === m ? 'var(--accent)' : 'var(--text-dim)',
                }}>
                  {m === 'bola8' ? '⚫ Bola 8' : '🟡 Bola 9'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
              Jugadores {form.jugador_ids.length >= 3 && <span style={{ color: 'var(--accent)' }}>· {nPartidas} partidas</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {jugadores.map(j => {
                const sel = form.jugador_ids.includes(j.id)
                return (
                  <button key={j.id} onClick={() => toggleJugador(j.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${sel ? (j.color || 'var(--accent)') : 'var(--border)'}`,
                    background: sel ? `${j.color || 'var(--accent)'}22` : 'var(--bg)',
                    color: 'var(--text)', fontSize: 13, fontWeight: sel ? 700 : 400,
                  }}>
                    <AvatarJugador nombre={j.nombre} color={j.color} size={20} />
                    {j.nombre}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setCreando(false); setError(null) }} style={{
              flex: 1, padding: '9px 0', borderRadius: 8, background: 'var(--bg)',
              border: '1px solid var(--border)', color: 'var(--text-dim)', fontWeight: 600, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button onClick={handleCrear} disabled={cargando || form.jugador_ids.length < 3} style={{
              flex: 2, padding: '9px 0', borderRadius: 8,
              background: form.jugador_ids.length >= 3 ? 'var(--accent)' : 'var(--border)',
              border: 'none', color: '#fff', fontWeight: 700, cursor: form.jugador_ids.length >= 3 ? 'pointer' : 'default',
            }}>
              {cargando ? '...' : `Generar torneo`}
            </button>
          </div>
        </div>
      )}

      {torneos.length === 0 && !creando ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 14 }}>Sin torneos. Crea el primero.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', alignItems: 'start' }}>
          {torneos.map(t => (
            <TorneoCard key={t.id} torneo={t} onClick={() => navigate(`/torneo/${t.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
