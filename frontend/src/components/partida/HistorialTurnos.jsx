import { useState, useEffect } from 'react'
import { BolaPool } from '../Bola'
import { api } from '../../api/client'

const TEAM_COLOR = {
  1: 'var(--team1)',
  2: 'var(--team2)',
}

// Faltas que se gestionan automáticamente — no se muestran en el selector manual
const FALTAS_AUTO = ['Blanca dentro (Scratch)', 'Bola 8 ilegal', 'Tres faltas consecutivas']

function InsertarTurno({ despuesDe, partida, jugadores, equipo1Jugadores, equipo2Jugadores, faltas, onGuardar, onCancelar }) {
  const jugadoresPartida = jugadores.filter(j =>
    equipo1Jugadores.includes(j.id) || equipo2Jugadores.includes(j.id)
  )
  const [jugadorId, setJugadorId] = useState(jugadoresPartida[0]?.id ?? null)
  const [bolas, setBolas] = useState([])
  const [faltaId, setFaltaId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const esBola9 = partida?.modalidad === 'bola9'
  const bolaIds = esBola9
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
  const faltasVisibles = (faltas ?? []).filter(f => !FALTAS_AUTO.includes(f.nombre))

  function toggleBola(n) {
    setBolas(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
  }

  async function guardar() {
    if (!jugadorId) return
    setGuardando(true); setError(null)
    try {
      await onGuardar({ despues_de_numero: despuesDe, jugador_id: jugadorId, bolas_metidas: bolas, falta_id: faltaId })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <div style={{
      padding: '12px', borderRadius: 8, margin: '2px 0',
      background: 'var(--surface2)', border: '1px dashed var(--accent)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.04em', margin: 0 }}>
        ＋ Insertar turno entre #{despuesDe} y #{despuesDe + 1}
      </p>

      {/* Jugador */}
      <div>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Jugador</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {jugadoresPartida.map(j => {
            const esEq1 = equipo1Jugadores.includes(j.id)
            const col = TEAM_COLOR[esEq1 ? 1 : 2]
            const sel = jugadorId === j.id
            return (
              <button key={j.id} onClick={() => setJugadorId(j.id)} style={{
                padding: '5px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
                border: sel ? `1.5px solid ${col}` : '1px solid var(--border)',
                background: sel ? `${col}22` : 'var(--surface)',
                color: sel ? col : 'var(--text-dim)', cursor: 'pointer',
              }}>{j.nombre}</button>
            )
          })}
        </div>
      </div>

      {/* Bolas */}
      <div>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Bolas metidas</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {bolaIds.map(n => (
            <BolaPool key={n} numero={n} size={30} seleccionada={bolas.includes(n)} onClick={() => toggleBola(n)} />
          ))}
        </div>
      </div>

      {/* Falta */}
      <div>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Falta</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button onClick={() => setFaltaId(null)} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: '12px', fontWeight: 600,
            border: faltaId === null ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            background: faltaId === null ? 'var(--accent-bg)' : 'var(--surface)',
            color: faltaId === null ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer',
          }}>Sin falta</button>
          {faltasVisibles.map(f => (
            <button key={f.id} onClick={() => setFaltaId(f.id)} style={{
              padding: '4px 10px', borderRadius: 8, fontSize: '12px', fontWeight: 600,
              border: faltaId === f.id ? '1.5px solid #fca5a5' : '1px solid var(--border)',
              background: faltaId === f.id ? 'rgba(252,165,165,.1)' : 'var(--surface)',
              color: faltaId === f.id ? '#fca5a5' : 'var(--text-dim)', cursor: 'pointer',
            }}>{f.nombre}</button>
          ))}
        </div>
      </div>

      {error && <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0 }}>⚠ {error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando || !jugadorId}
          style={{ flex: 1, padding: '8px', fontSize: '13px' }}>
          {guardando ? '…' : '＋ Insertar'}
        </button>
        <button className="btn btn-ghost" onClick={onCancelar} disabled={guardando}
          style={{ padding: '8px 14px', fontSize: '13px' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function EditorTurno({ turno, faltas, partida, jugadores, equipo1Jugadores, equipo2Jugadores, onGuardar, onCancelar }) {
  const [jugadorId, setJugadorId] = useState(turno.jugador_id)
  const [bolas, setBolas] = useState([...(turno.bolas_metidas ?? [])])
  const [faltaId, setFaltaId] = useState(turno.falta_id ?? null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const jugadoresPartida = (jugadores ?? []).filter(j =>
    (equipo1Jugadores ?? []).includes(j.id) || (equipo2Jugadores ?? []).includes(j.id)
  )
  const esBola9 = partida?.modalidad === 'bola9'
  const bolaIds = esBola9
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

  const faltasVisibles = (faltas ?? []).filter(f => !FALTAS_AUTO.includes(f.nombre))

  function toggleBola(n) {
    setBolas(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    )
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await onGuardar(turno.id, { jugador_id: jugadorId, bolas_metidas: bolas, falta_id: faltaId })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <div style={{
      marginTop: 10, padding: '12px', borderRadius: 8,
      background: 'var(--surface2)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>

      {/* Selector de jugador */}
      {jugadoresPartida.length > 1 && (
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Jugador</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {jugadoresPartida.map(j => {
              const esEq1 = (equipo1Jugadores ?? []).includes(j.id)
              const col = TEAM_COLOR[esEq1 ? 1 : 2]
              const sel = jugadorId === j.id
              return (
                <button key={j.id} onClick={() => setJugadorId(j.id)} style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
                  border: sel ? `1.5px solid ${col}` : '1px solid var(--border)',
                  background: sel ? `${col}22` : 'var(--surface)',
                  color: sel ? col : 'var(--text-dim)', cursor: 'pointer',
                }}>{j.nombre}</button>
              )
            })}
          </div>
        </div>
      )}

      {/* Selector de bolas */}
      <div>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
          Bolas metidas
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {bolaIds.map(n => (
            <BolaPool
              key={n}
              numero={n}
              size={30}
              seleccionada={bolas.includes(n)}
              onClick={() => toggleBola(n)}
            />
          ))}
        </div>
      </div>

      {/* Selector de falta */}
      <div>
        <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
          Falta
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button
            onClick={() => setFaltaId(null)}
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: '12px', fontWeight: 600,
              border: faltaId === null ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: faltaId === null ? 'var(--accent-bg)' : 'var(--surface)',
              color: faltaId === null ? 'var(--accent)' : 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            Sin falta
          </button>
          {faltasVisibles.map(f => (
            <button
              key={f.id}
              onClick={() => setFaltaId(f.id)}
              style={{
                padding: '4px 10px', borderRadius: 8, fontSize: '12px', fontWeight: 600,
                border: faltaId === f.id ? '1.5px solid #fca5a5' : '1px solid var(--border)',
                background: faltaId === f.id ? 'rgba(252,165,165,.1)' : 'var(--surface)',
                color: faltaId === f.id ? '#fca5a5' : 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              {f.nombre}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0 }}>⚠ {error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={guardar}
          disabled={guardando}
          style={{ flex: 1, padding: '8px', fontSize: '13px' }}
        >
          {guardando ? '…' : '✓ Guardar'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={onCancelar}
          disabled={guardando}
          style={{ padding: '8px 14px', fontSize: '13px' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function HistorialTurnos({
  turnos, jugadores, faltas,
  equipo1Jugadores, equipo2Jugadores,
  partida, onReload, modoEdicion = false, onSalirEdicion,
  abiertoInicial = false,
}) {
  const [mostrar, setMostrar] = useState(abiertoInicial)
  const [editandoId, setEditandoId] = useState(null)
  const [insertandoDespuesDe, setInsertandoDespuesDe] = useState(null)
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null)

  // Al entrar en modo edición, abrir el historial: editar a ciegas (colapsado) confunde
  useEffect(() => { if (modoEdicion) setMostrar(true) }, [modoEdicion])

  // Cerrar editores abiertos si se desactiva el modo edición
  if (!modoEdicion && (editandoId !== null || insertandoDespuesDe !== null || confirmarEliminarId !== null)) {
    setEditandoId(null)
    setInsertandoDespuesDe(null)
    setConfirmarEliminarId(null)
  }

  async function handleGuardar(turnoId, datos) {
    await api.editarTurno(partida.id, turnoId, datos)
    setEditandoId(null)
    onReload?.()
  }

  async function handleEliminar(turnoId) {
    await api.eliminarTurno(partida.id, turnoId)
    setEditandoId(null)
    onReload?.()
  }

  async function handleInsertar(datos) {
    await api.insertarTurno(partida.id, datos)
    setInsertandoDespuesDe(null)
    onReload?.()
  }

  return (
    <div>
      <button
        className="btn btn-ghost btn-full"
        onClick={() => setMostrar(v => !v)}
        style={{ marginBottom: mostrar ? 8 : 0 }}
      >
        {mostrar ? '▲ Ocultar historial' : `▼ Historial (${turnos.length} turnos)`}
      </button>

      {mostrar && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {modoEdicion && (
            <div style={{
              position: 'sticky', top: 'var(--nav-height)', zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--accent-bg)', border: '1px solid var(--accent)',
            }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                ✎ Editando turnos
              </span>
              <button onClick={onSalirEdicion} className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 13 }}>
                ✓ Terminar
              </button>
            </div>
          )}
          {(() => {
            // Pre-calcular racha de faltas por equipo en cada turno
            const ordenados = [...turnos].sort((a, b) => a.numero - b.numero)
            const rachaFaltas = {}
            for (const t of ordenados) {
              const equipoIds = equipo1Jugadores.includes(t.jugador_id) ? equipo1Jugadores : equipo2Jugadores
              const turnosEquipo = ordenados.filter(x => equipoIds.includes(x.jugador_id) && x.numero <= t.numero)
              let streak = 0
              for (let i = turnosEquipo.length - 1; i >= 0; i--) {
                if (turnosEquipo[i].falta_id) streak++
                else break
              }
              rachaFaltas[t.id] = streak
            }
            return [...turnos].reverse().map((t, idx, arr) => {
            const esEq1 = equipo1Jugadores.includes(t.jugador_id)
            const tColor = TEAM_COLOR[esEq1 ? 1 : 2]
            const jNombre = jugadores.find(j => j.id === t.jugador_id)?.nombre ?? `#${t.jugador_id}`
            const editando = editandoId === t.id
            // En la lista invertida, arr[idx+1] es el turno cronológicamente anterior (mostrado debajo)
            const turnoAnteriorCronologico = arr[idx + 1]
            const insertandoAqui = insertandoDespuesDe === turnoAnteriorCronologico?.numero

            const turnoCard = (
              <div className="card" style={{
                padding: '10px 14px', fontSize: '13px',
                borderLeft: `3px solid ${tColor}`,
                // Historiales largos (40+ turnos): el navegador omite el render
                // de las filas fuera de viewport. contain-intrinsic-size reserva
                // el alto para que el scrollbar no salte.
                contentVisibility: 'auto',
                containIntrinsicSize: 'auto 48px',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: (t.bolas_metidas?.length ?? 0) > 0 && !editando ? 8 : 0,
                }}>
                  <span style={{ fontWeight: 700, color: tColor }}>
                    <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>#{t.numero} </span>
                    {jNombre}
                  </span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {t.bola_en_mano && (
                      <span className="badge" style={{ background: '#3d2c00', color: '#fcd34d', fontSize: '11px' }}>En mano</span>
                    )}
                    {t.repite && (
                      <span className="badge" style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: '11px' }}>Repite turno</span>
                    )}
                    {(() => {
                      const esRespot = !!t.es_respot
                      if (esRespot) return (
                        <span className="badge" style={{ background: 'rgba(127,29,29,.5)', border: '1px solid rgba(252,165,165,.3)', color: '#fca5a5', fontSize: '11px' }}>
                          ⚡ Respot · Bola 9 ilegal
                        </span>
                      )
                      if (t.falta_id) return (
                        <span className="badge" style={{ background: 'rgba(127,29,29,.5)', color: '#fca5a5', fontSize: '11px' }}>
                          {faltas.find(f => f.id === t.falta_id)?.nombre ?? 'falta'}
                        </span>
                      )
                      return null
                    })()}
                    {t.falta_id && rachaFaltas[t.id] === 2 && (
                      <span className="badge" style={{ background: 'rgba(245,158,11,.18)', color: '#fbbf24', fontSize: '10px' }}>
                        ⚠ 2 seguidas
                      </span>
                    )}
                    {modoEdicion && confirmarEliminarId === t.id && (
                      <>
                        <span style={{ fontSize: '11px', color: '#fca5a5' }}>¿Eliminar?</span>
                        <button
                          onClick={async () => { setConfirmarEliminarId(null); await handleEliminar(t.id) }}
                          style={{
                            background: 'rgba(252,165,165,.15)', border: '1px solid #fca5a5',
                            borderRadius: 6, color: '#fca5a5', fontSize: '11px',
                            cursor: 'pointer', padding: '2px 8px', lineHeight: 1.4,
                          }}
                        >Sí</button>
                        <button
                          onClick={() => setConfirmarEliminarId(null)}
                          style={{
                            background: 'none', border: '1px solid var(--border)',
                            borderRadius: 6, color: 'var(--text-dim)', fontSize: '11px',
                            cursor: 'pointer', padding: '2px 8px', lineHeight: 1.4,
                          }}
                        >No</button>
                      </>
                    )}
                    {modoEdicion && confirmarEliminarId !== t.id && (
                      <>
                        <button
                          onClick={() => { setEditandoId(editando ? null : t.id); setInsertandoDespuesDe(null); setConfirmarEliminarId(null) }}
                          title="Editar turno"
                          style={{
                            background: editando ? 'var(--accent-bg)' : 'none',
                            border: editando ? '1px solid var(--accent)' : '1px solid var(--border)',
                            borderRadius: 6, color: editando ? 'var(--accent)' : 'var(--text-dim)',
                            fontSize: '12px', cursor: 'pointer', padding: '2px 7px', lineHeight: 1.4,
                            transition: 'background-color .15s, border-color .15s, color .15s',
                          }}
                        >✎</button>
                        <button
                          onClick={() => { setConfirmarEliminarId(t.id); setEditandoId(null); setInsertandoDespuesDe(null) }}
                          title="Eliminar turno"
                          style={{
                            background: 'none', border: '1px solid var(--border)',
                            borderRadius: 6, color: 'var(--text-dim)', fontSize: '12px',
                            cursor: 'pointer', padding: '2px 7px', lineHeight: 1.4,
                            transition: 'background-color .15s, border-color .15s, color .15s',
                          }}
                        >❌</button>
                      </>
                    )}
                  </div>
                </div>

                {!editando && ((t.bolas_metidas?.length ?? 0) > 0 || t.es_respot) && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {t.es_respot && (
                      <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <div style={{ opacity: 0.8 }}>
                          <BolaPool numero={9} size={28} />
                        </div>
                        <svg
                          viewBox="0 0 28 28" width={28} height={28}
                          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', filter: 'drop-shadow(0 0 1px #000)' }}
                        >
                          <line x1="5" y1="5" x2="23" y2="23" stroke="#fca5a5" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      </div>
                    )}
                    {(t.bolas_metidas ?? []).map(n => <BolaPool key={n} numero={n} size={28} />)}
                  </div>
                )}

                {editando && (
                  <EditorTurno
                    turno={t} faltas={faltas} partida={partida}
                    jugadores={jugadores}
                    equipo1Jugadores={equipo1Jugadores}
                    equipo2Jugadores={equipo2Jugadores}
                    onGuardar={handleGuardar}
                    onCancelar={() => setEditandoId(null)}
                  />
                )}
              </div>
            )

            return (
              <div key={t.id}>
                {turnoCard}
                {modoEdicion && turnoAnteriorCronologico && (
                  insertandoAqui ? (
                    <InsertarTurno
                      despuesDe={turnoAnteriorCronologico.numero}
                      partida={partida}
                      jugadores={jugadores}
                      equipo1Jugadores={equipo1Jugadores}
                      equipo2Jugadores={equipo2Jugadores}
                      faltas={faltas}
                      onGuardar={handleInsertar}
                      onCancelar={() => setInsertandoDespuesDe(null)}
                    />
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                      <button
                        onClick={() => { setInsertandoDespuesDe(turnoAnteriorCronologico.numero); setEditandoId(null) }}
                        title={`Insertar turno entre #${turnoAnteriorCronologico.numero} y #${t.numero}`}
                        style={{
                          background: 'none', border: '1px dashed var(--border)',
                          borderRadius: 6, color: 'var(--text-dim)', fontSize: '11px',
                          cursor: 'pointer', padding: '2px 20px', lineHeight: 1.8,
                          transition: 'border-color .15s, color .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
                      >＋</button>
                    </div>
                  )
                )}
              </div>
            )
            })
          })()}
        </div>
      )}
    </div>
  )
}
