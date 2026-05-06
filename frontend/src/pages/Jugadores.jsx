import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'

function WinRate({ ganadas, jugadas }) {
  const pct = jugadas === 0 ? 0 : Math.round((ganadas / jugadas) * 100)
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: 4 }}>
        <span>Win rate</span>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: pct >= 50 ? '#16a34a' : 'var(--accent)',
          borderRadius: 3, transition: 'width .4s ease',
        }} />
      </div>
    </div>
  )
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ textAlign: 'center', flex: 1, padding: '8px 4px' }}>
      <div style={{ fontSize: '20px', fontWeight: 800, color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub != null && (
        <div style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600, marginTop: 1 }}>
          {sub} BM
        </div>
      )}
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function JugadorCard({ j, onReload }) {
  const [modo, setModo] = useState(null) // null | 'editar' | 'eliminar'
  const [nombreEdit, setNombreEdit] = useState(j.nombre)
  const [recursivoOk, setRecursivoOk] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const tienePartidas = j.partidas_jugadas > 0

  async function guardarEdicion() {
    if (!nombreEdit.trim() || nombreEdit.trim() === j.nombre) { setModo(null); return }
    setCargando(true); setError(null)
    try {
      await api.editarJugador(j.id, nombreEdit.trim())
      setModo(null)
      onReload()
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }

  async function confirmarEliminar() {
    setCargando(true); setError(null)
    try {
      await api.eliminarJugador(j.id)
      onReload()
    } catch (e) { setError(e.message); setCargando(false) }
  }

  function cancelar() {
    setModo(null); setNombreEdit(j.nombre)
    setRecursivoOk(false); setError(null)
  }

  return (
    <div className="card">
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: modo ? 12 : 0 }}>
        {modo === 'editar' ? (
          <input
            type="text"
            value={nombreEdit}
            onChange={e => setNombreEdit(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && guardarEdicion()}
            autoFocus
            style={{ flex: 1, marginRight: 8 }}
          />
        ) : (
          <span style={{ fontSize: '16px', fontWeight: 700 }}>{j.nombre}</span>
        )}

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {modo === null && (
            <>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => setModo('editar')}>Editar</button>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => setModo('eliminar')}>Eliminar</button>
            </>
          )}
          {modo === 'editar' && (
            <>
              <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '12px' }}
                onClick={guardarEdicion} disabled={cargando || !nombreEdit.trim()}>
                {cargando ? '…' : 'Guardar'}
              </button>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={cancelar}>Cancelar</button>
            </>
          )}
          {modo === 'eliminar' && (
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }}
              onClick={cancelar}>Cancelar</button>
          )}
        </div>
      </div>

      {/* Panel eliminar */}
      {modo === 'eliminar' && (
        <div style={{
          background: 'var(--surface2)', borderRadius: 8, padding: '12px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {tienePartidas ? (
            <>
              <p style={{ fontSize: '13px', color: '#fca5a5' }}>
                Este jugador tiene <strong>{j.partidas_jugadas}</strong> partida{j.partidas_jugadas > 1 ? 's' : ''} registrada{j.partidas_jugadas > 1 ? 's' : ''}.
                Se eliminarán también sus turnos y participaciones.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <div
                  onClick={() => setRecursivoOk(v => !v)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                    background: recursivoOk ? 'var(--accent)' : 'var(--border)',
                    position: 'relative', transition: 'background .2s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 9, background: '#fff',
                    position: 'absolute', top: 2,
                    left: recursivoOk ? 20 : 2,
                    transition: 'left .2s',
                  }} />
                </div>
                <span style={{ fontSize: '13px', color: recursivoOk ? 'var(--text)' : 'var(--text-dim)' }}>
                  Confirmo que quiero borrar todos sus datos
                </span>
              </label>
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
              ¿Eliminar a <strong style={{ color: 'var(--text)' }}>{j.nombre}</strong>?
            </p>
          )}
          {error && <p style={{ fontSize: '12px', color: '#fca5a5' }}>{error}</p>}
          <button
            className="btn btn-danger btn-full"
            onClick={confirmarEliminar}
            disabled={cargando || (tienePartidas && !recursivoOk)}
            style={{ padding: '10px' }}
          >
            {cargando ? 'Eliminando…' : 'Eliminar jugador'}
          </button>
        </div>
      )}

      {/* Stats — solo si no está en modo editar/eliminar */}
      {modo === null && (
        <>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', background: 'var(--surface2)', marginTop: 12 }}>
            <StatBox label="Jugadas" value={j.partidas_jugadas} />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <StatBox label="Ganadas" value={j.partidas_ganadas} color="#86efac" />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <StatBox
              label="Perdidas"
              value={j.partidas_jugadas - j.partidas_ganadas}
              color={j.partidas_jugadas - j.partidas_ganadas > 0 ? '#fca5a5' : 'var(--text)'}
            />
            <div style={{ width: 1, background: 'var(--border)' }} />
            <StatBox
              label="Bolas"
              value={j.bolas_metidas}
              color="#93c5fd"
              sub={j.turnos_con_bola_en_mano > 0 ? j.bolas_metidas_con_bola_en_mano : null}
            />
          </div>
          {j.turnos_con_bola_en_mano > 0 && (
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 6 }}>
              {j.turnos_con_bola_en_mano} turno{j.turnos_con_bola_en_mano > 1 ? 's' : ''} con bola en mano
              · {j.bolas_metidas_con_bola_en_mano} bola{j.bolas_metidas_con_bola_en_mano !== 1 ? 's' : ''} metida{j.bolas_metidas_con_bola_en_mano !== 1 ? 's' : ''} desde bola en mano
            </p>
          )}
          <WinRate ganadas={j.partidas_ganadas} jugadas={j.partidas_jugadas} />
        </>
      )}
    </div>
  )
}

export default function Jugadores() {
  const { data: stats, loading, reload } = useApi(api.getAllStats)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function crear(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true); setError(null)
    try {
      await api.crearJugador(nombre.trim())
      setNombre('')
      reload()
    } catch (err) { setError(err.message) }
    finally { setGuardando(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h2 style={{ fontSize: '20px' }}>Jugadores</h2>

      <form onSubmit={crear} style={{ display: 'flex', gap: 8 }}>
        <input type="text" placeholder="Nombre del jugador" value={nombre}
          onChange={e => setNombre(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
        <button type="submit" className="btn btn-primary" disabled={guardando || !nombre.trim()}>
          Añadir
        </button>
      </form>
      {error && <p style={{ color: 'var(--accent)', fontSize: '14px' }}>{error}</p>}

      {loading && <div className="spinner" />}
      {stats?.length === 0 && <p className="empty">Sin jugadores. ¡Añade el primero!</p>}
      {stats?.map(j => <JugadorCard key={j.id} j={j} onReload={reload} />)}
    </div>
  )
}
