import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import AvatarJugador from '../components/AvatarJugador'
import { SkeletonList } from '../components/Skeleton'
import SharePreview from '../components/SharePreview'
import ShareCardTorneo from '../components/ShareCardTorneo'

const ENF_ORDEN = { null: 0, undefined: 0, en_curso: 1, finalizada: 2 }

function ListaEnfrentamientos({ clasificacion, enfrentamientos, estado, onJugar, onVer }) {
  const jugMap = {}
  for (const j of clasificacion) jugMap[j.jugador_id] = j

  const sorted = [...enfrentamientos].sort((a, b) =>
    (ENF_ORDEN[a.partida_estado] ?? 0) - (ENF_ORDEN[b.partida_estado] ?? 0)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map(enf => {
        const j1 = jugMap[enf.jugador1_id]
        const j2 = jugMap[enf.jugador2_id]
        if (!j1 || !j2) return null

        const finalizada = enf.partida_estado === 'finalizada'
        const enCurso = enf.partida_estado === 'en_curso'
        const pendiente = !enf.partida_id

        const ganadorId = enf.ganador_jugador_id
        const j1gano = finalizada && ganadorId === j1.jugador_id
        const j2gano = finalizada && ganadorId === j2.jugador_id

        return (
          <div key={enf.id} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {/* Jugador 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <AvatarJugador nombre={j1.nombre} color={j1.color} size={26} />
              <span style={{
                fontSize: 13, fontWeight: j1gano ? 700 : 500,
                color: j1gano ? '#4ade80' : j2gano ? 'var(--text-dim)' : 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{j1.nombre}</span>
              {j1gano && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>W</span>}
            </div>

            {/* Centro: accion o estado */}
            <div style={{ flexShrink: 0 }}>
              {pendiente && estado !== 'finalizado' ? (
                <button onClick={() => onJugar(enf.id)} style={{
                  padding: '5px 14px', borderRadius: 7, border: '1px dashed var(--border)',
                  background: 'transparent', color: 'var(--accent)', fontSize: 13,
                  fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>Jugar</button>
              ) : enCurso ? (
                <button onClick={() => onVer(enf.partida_id)} style={{
                  padding: '5px 14px', borderRadius: 7, border: 'none',
                  background: 'rgba(234,179,8,.18)', color: '#fbbf24', fontSize: 12,
                  fontWeight: 700, cursor: 'pointer',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}>▶ En curso</button>
              ) : finalizada ? (
                <button onClick={() => onVer(enf.partida_id)} style={{
                  padding: '5px 14px', borderRadius: 7, border: 'none',
                  background: 'rgba(255,255,255,.06)', color: 'var(--text-dim)', fontSize: 12,
                  cursor: 'pointer',
                }}>Ver</button>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>vs</span>
              )}
            </div>

            {/* Jugador 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
              {j2gano && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>W</span>}
              <span style={{
                fontSize: 13, fontWeight: j2gano ? 700 : 500,
                color: j2gano ? '#4ade80' : j1gano ? 'var(--text-dim)' : 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{j2.nombre}</span>
              <AvatarJugador nombre={j2.nombre} color={j2.color} size={26} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const MEDALLAS = ['🥇', '🥈', '🥉']

export default function TorneoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [torneo, setTorneo] = useState(null)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null) // null | { eliminarPartidas: bool }
  const [confirmFin, setConfirmFin] = useState(false)
  const [pickEnf, setPickEnf] = useState(null)
  const [showClasif, setShowClasif] = useState(true)
  const [showEnfs, setShowEnfs] = useState(true)
  const [sharingTorneo, setSharingTorneo] = useState(false)

  const cargar = useCallback(() => {
    api.getTorneo(id).then(setTorneo).catch(e => setError(e.message))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [cargar])

  function handleJugar(enfId) {
    const enf = torneo.enfrentamientos.find(e => e.id === enfId)
    if (!enf) return
    const jugMap = Object.fromEntries(torneo.clasificacion.map(j => [j.jugador_id, j]))
    setPickEnf({ enfId, j1: jugMap[enf.jugador1_id], j2: jugMap[enf.jugador2_id] })
  }

  async function confirmarJugar(primerJugadorId) {
    if (!pickEnf) return
    setPickEnf(null)
    try {
      const { partida_id, logros_nuevos } = await api.jugarEnfrentamiento(id, pickEnf.enfId, primerJugadorId)
      navigate(`/partida/${partida_id}`, { state: { logrosNuevos: logros_nuevos } })
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleFinalizar() {
    try {
      const t = await api.finalizarTorneo(id)
      setTorneo(t)
      setConfirmFin(false)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleEliminar(eliminarPartidas) {
    if (pendingDelete === null) {
      setPendingDelete({ eliminarPartidas })
      return
    }
    try {
      await api.eliminarTorneo(id, pendingDelete.eliminarPartidas)
      navigate('/torneos')
    } catch (e) {
      setError(e.message)
      setPendingDelete(null)
    }
  }

  useEffect(() => {
    if (torneo?.estado === 'finalizado') { setShowClasif(false); setShowEnfs(false) }
  }, [torneo?.estado])

  if (error) return (
    <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>
      {error}
      <div><button onClick={() => navigate('/torneos')} style={{ marginTop: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>← Volver</button></div>
    </div>
  )

  if (!torneo) return <div style={{ maxWidth: 480, margin: '0 auto' }}><SkeletonList n={5} /></div>

  const pct = torneo.total > 0 ? (torneo.jugados / torneo.total) * 100 : 0
  const todoJugado = torneo.jugados === torneo.total && torneo.total > 0
  const finalizado = torneo.estado === 'finalizado'
  const podio = finalizado ? torneo.clasificacion.slice(0, 3) : null

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate('/torneos')} style={{
          background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1,
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{torneo.nombre}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
              background: torneo.modalidad === 'bola8' ? 'rgba(255,255,255,.1)' : 'rgba(234,179,8,.15)',
              color: torneo.modalidad === 'bola8' ? '#d1d5db' : '#fbbf24',
              border: `1px solid ${torneo.modalidad === 'bola8' ? 'rgba(255,255,255,.15)' : 'rgba(234,179,8,.3)'}`,
            }}>
              {torneo.modalidad === 'bola8' ? 'B8' : 'B9'}
            </span>
            {torneo.estado === 'finalizado' && (
              <span style={{ fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,.1)', padding: '2px 7px', borderRadius: 6 }}>Finalizado</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {torneo.jugados}/{torneo.total} partidas · {torneo.jugadores.length} jugadores
          </div>
        </div>
        <button onClick={cargar} style={{
          background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer',
        }} title="Actualizar">↻</button>
      </div>

      {/* Progreso */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: torneo.estado === 'finalizado' ? '#22c55e' : 'var(--accent)',
            borderRadius: 3, transition: 'width .3s',
          }} />
        </div>
      </div>

      {/* Podio */}
      {podio && podio.length > 0 && (
        <div style={{
          background: 'rgba(234,179,8,.07)', border: '1px solid rgba(234,179,8,.25)',
          borderRadius: 14, padding: '16px 12px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textAlign: 'center', letterSpacing: '.08em', marginBottom: 14 }}>
            RESULTADO FINAL
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
            {/* 2º */}
            {podio[1] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
                <AvatarJugador nombre={podio[1].nombre} color={podio[1].color} size={36} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{podio[1].nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{podio[1].puntos}pts</span>
                <div style={{ width: '100%', background: 'rgba(255,255,255,.1)', borderRadius: '6px 6px 0 0', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22 }}>🥈</span>
                </div>
              </div>
            )}
            {/* 1º */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
              <span style={{ fontSize: 20 }}>🏆</span>
              <AvatarJugador nombre={podio[0].nombre} color={podio[0].color} size={44} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', textAlign: 'center' }}>{podio[0].nombre}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{podio[0].puntos}pts · {podio[0].victorias}W</span>
              <div style={{ width: '100%', background: 'rgba(234,179,8,.2)', borderRadius: '6px 6px 0 0', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 26 }}>🥇</span>
              </div>
            </div>
            {/* 3º */}
            {podio[2] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
                <AvatarJugador nombre={podio[2].nombre} color={podio[2].color} size={32} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{podio[2].nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{podio[2].puntos}pts</span>
                <div style={{ width: '100%', background: 'rgba(255,255,255,.07)', borderRadius: '6px 6px 0 0', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 18 }}>🥉</span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setSharingTorneo(true)}
            style={{
              marginTop: 14, width: '100%', padding: '9px',
              background: 'rgba(168,85,247,.18)', border: '1px solid rgba(255,255,255,.2)',
              borderRadius: 8, fontSize: 13, color: '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Compartir resultado
          </button>
        </div>
      )}

      <SharePreview open={sharingTorneo} onClose={() => setSharingTorneo(false)} filename={`torneo-${torneo.nombre}`}>
        <ShareCardTorneo torneo={torneo} />
      </SharePreview>

      {/* Stats del torneo — solo finalizado */}
      {finalizado && (() => {
        const totalBolas = torneo.clasificacion.reduce((s, j) => s + j.bolas, 0)
        const bolasPorPartida = torneo.jugados > 0 ? (totalBolas / torneo.jugados).toFixed(1) : 0
        const topBolas = [...torneo.clasificacion].sort((a, b) => b.bolas - a.bolas)[0]
        const topWinRate = [...torneo.clasificacion]
          .filter(j => j.pj > 0)
          .sort((a, b) => (b.victorias / b.pj) - (a.victorias / a.pj))[0]
        const perfecto = torneo.clasificacion.find(j => j.derrotas === 0 && j.victorias > 0)
        const durMs = torneo.fecha_fin && torneo.fecha
          ? new Date(torneo.fecha_fin) - new Date(torneo.fecha) : null
        const durStr = durMs ? (() => {
          const h = Math.floor(durMs / 3_600_000)
          const m = Math.floor((durMs % 3_600_000) / 60_000)
          return h > 0 ? `${h}h ${m}m` : `${m}m`
        })() : null
        const statCard = (value, label, color) => (
          <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 3 }}>{label}</div>
          </div>
        )
        const playerCard = (icon, label, nombre, sub) => (
          <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nombre}{sub && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> {sub}</span>}
              </div>
            </div>
          </div>
        )
        return (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '.05em' }}>RESUMEN</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {statCard(torneo.jugados, 'Partidas', 'var(--accent)')}
              {statCard(totalBolas, 'Bolas', '#93c5fd')}
              {statCard(bolasPorPartida, 'Bolas/pda', '#86efac')}
              {durStr && statCard(durStr, 'Duración', '#c4b5fd')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {topBolas?.bolas > 0 && playerCard('🎱', 'Más bolas', topBolas.nombre, `${topBolas.bolas}`)}
              {perfecto
                ? playerCard('⭐', 'Sin derrotas', perfecto.nombre, `${perfecto.victorias}W`)
                : topWinRate?.pj > 0 && playerCard('📈', 'Mejor ratio', topWinRate.nombre,
                    `${Math.round((topWinRate.victorias / topWinRate.pj) * 100)}%`)
              }
            </div>
          </div>
        )
      })()}

      {/* Clasificación */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setShowClasif(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginBottom: showClasif ? 10 : 0,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{showClasif ? '▼' : '▶'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '.05em' }}>CLASIFICACIÓN</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </button>
        {showClasif && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {torneo.clasificacion.map((e, i) => (
              <div key={e.jugador_id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: i < torneo.clasificacion.length - 1 ? '1px solid var(--border)' : 'none',
                background: i === 0 && finalizado ? 'rgba(234,179,8,.05)' : 'transparent',
              }}>
                <span style={{ fontSize: i < 3 ? 16 : 13, width: 20, textAlign: 'center', color: 'var(--text-dim)', fontWeight: 700 }}>
                  {i < 3 ? MEDALLAS[i] : i + 1}
                </span>
                <AvatarJugador nombre={e.nombre} color={e.color} size={22} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{e.nombre}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(74,222,128,.15)', color: '#4ade80' }}>{e.victorias}W</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(248,113,113,.12)', color: '#f87171' }}>{e.derrotas}L</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 36, textAlign: 'right' }}>{e.puntos}pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enfrentamientos */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setShowEnfs(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginBottom: showEnfs ? 10 : 0,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{showEnfs ? '▼' : '▶'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '.05em' }}>ENFRENTAMIENTOS</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </button>
        {showEnfs && (
          <ListaEnfrentamientos
            clasificacion={torneo.clasificacion}
            enfrentamientos={torneo.enfrentamientos}
            estado={torneo.estado}
            onJugar={handleJugar}
            onVer={id => navigate(`/partida/${id}`)}
          />
        )}
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* Acciones */}
      {torneo.estado === 'en_curso' && todoJugado && (
        <div style={{ marginBottom: 8 }}>
          {!confirmFin ? (
            <button onClick={() => setConfirmFin(true)} style={{
              width: '100%', padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', color: '#22c55e',
            }}>
              Finalizar torneo
            </button>
          ) : (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#86efac', textAlign: 'center' }}>
                ¿Finalizar el torneo? Se cerrará la clasificación.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleFinalizar} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, fontWeight: 700, fontSize: 14,
                  background: '#22c55e', border: 'none', color: '#fff', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>Sí, finalizar</button>
                <button onClick={() => setConfirmFin(false)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, fontWeight: 600, fontSize: 14,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!confirmDelete ? (
        <button className="btn btn-ghost btn-full" onClick={() => setConfirmDelete(true)}
          style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          ❌ Eliminar torneo
        </button>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!pendingDelete && (
            <p style={{ fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>
              ¿Qué quieres eliminar?
            </p>
          )}
          {!pendingDelete ? (
            <>
              <button onClick={() => handleEliminar(false)} style={{
                padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5',
                textAlign: 'left',
              }}>
                <div style={{ fontWeight: 700 }}>Solo el torneo</div>
                <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)', marginTop: 2 }}>
                  Las partidas jugadas se conservan en el historial
                </div>
              </button>
              <button onClick={() => handleEliminar(true)} style={{
                padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: 'rgba(239,68,68,.18)', border: '1px solid rgba(239,68,68,.4)', color: '#f87171',
                textAlign: 'left',
              }}>
                <div style={{ fontWeight: 700 }}>Torneo + todas las partidas</div>
                <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)', marginTop: 2 }}>
                  Se borran {torneo.jugados} partida{torneo.jugados !== 1 ? 's' : ''} y sus turnos
                </div>
              </button>
            </>
          ) : (
            <button onClick={handleEliminar} className="btn btn-danger btn-full" style={{ padding: '10px', fontSize: 13 }}>
              ⚠ Confirmar: eliminar {pendingDelete.eliminarPartidas ? 'torneo y partidas' : 'solo el torneo'}
            </button>
          )}
          <button className="btn btn-ghost btn-full" style={{ fontSize: 13 }} onClick={() => { setConfirmDelete(false); setPendingDelete(null) }}>Cancelar</button>
        </div>
      )}

      {/* Picker: ¿quién empieza? */}
      {pickEnf && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 100, padding: '0 16px 24px',
        }} onClick={() => setPickEnf(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 20, width: '100%', maxWidth: 440,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, textAlign: 'center' }}>¿Quién empieza?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[pickEnf.j1, pickEnf.j2].map(j => j && (
                <button
                  key={j.jugador_id}
                  onClick={() => confirmarJugar(j.jugador_id)}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${j.color || 'var(--border)'}`,
                    background: j.color ? `${j.color}18` : 'var(--bg)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  }}
                >
                  <AvatarJugador nombre={j.nombre} color={j.color} size={40} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{j.nombre}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Empieza</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPickEnf(null)} style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              fontSize: 13, cursor: 'pointer', padding: '4px 0',
            }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
