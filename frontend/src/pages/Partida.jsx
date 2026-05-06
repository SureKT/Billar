import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { BolaPool } from '../components/Bola'
import SelectorBolas from '../components/SelectorBolas'

function usePartidaData(id) {
  const [partida, setPartida] = useState(null)
  const [estado, setEstado] = useState(null)
  const [turnos, setTurnos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [faltas, setFaltas] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    const [p, t, j, f] = await Promise.all([
      api.getPartida(id),
      api.getTurnos(id),
      api.getJugadores(),
      api.getFaltas(),
    ])
    setPartida(p)
    setTurnos(t)
    setJugadores(j)
    setFaltas(f)
    if (p) {
      const e = await api.getEstadoPartida(id)
      setEstado(e)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { reload(true) }, [reload])

  // Refresco al volver al foco (útil en móvil)
  useEffect(() => {
    function onFocus() { reload() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  return { partida, estado, turnos, jugadores, faltas, loading, reload }
}

function nombre(id, jugadores) {
  return jugadores.find(j => j.id === id)?.nombre ?? `#${id}`
}

// Panel que muestra las bolas pendientes de un equipo
function BolasEquipo({ titulo, pendientes, grupo, esActivo, ganador }) {
  return (
    <div style={{
      background: esActivo ? 'rgba(233,69,96,.08)' : 'var(--surface2)',
      border: `1px solid ${esActivo ? 'rgba(233,69,96,.4)' : 'var(--border)'}`,
      borderRadius: 10,
      padding: '10px 12px',
      flex: 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: esActivo ? 'var(--accent)' : 'var(--text-dim)' }}>
          {titulo} {ganador && '🏆'}
        </span>
        {grupo
          ? <span className={`badge badge-${grupo}`}>{grupo}</span>
          : <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>sin grupo</span>
        }
      </div>
      {pendientes.length === 0 && grupo
        ? <p style={{ fontSize: '12px', color: '#86efac', textAlign: 'center' }}>¡Listas!</p>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {pendientes.map(n => <BolaPool key={n} numero={n} size={32} />)}
          </div>
        )
      }
    </div>
  )
}

export default function Partida() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { partida, estado, turnos, jugadores, faltas, loading, reload } = usePartidaData(id)

  const [bolas, setBolas] = useState([])
  // faltasIds: Set de IDs de faltas manuales seleccionadas
  const [faltasIds, setFaltasIds] = useState(new Set())
  // faltasAutoIds: Set de IDs de faltas auto-detectadas por bolas
  const [faltasAutoIds, setFaltasAutoIds] = useState(new Set())
  const [registrando, setRegistrando] = useState(false)
  const [flash, setFlash] = useState(null)
  const [mostrarTurnos, setMostrarTurnos] = useState(false)

  // Auto-detección de faltas según bolas seleccionadas
  useEffect(() => {
    if (!faltas?.length) return
    const pendientesActuales = partida
      ? (partida.equipo1_jugadores?.includes(partida.siguiente_jugador_id)
          ? (estado?.equipo1_pendientes ?? [])
          : (estado?.equipo2_pendientes ?? []))
      : []

    const nuevasAuto = new Set()
    if (bolas.includes(0)) {
      const f = faltas.find(f => f.nombre === 'Blanca dentro (Scratch)')
      if (f) nuevasAuto.add(f.id)
    }
    if (bolas.includes(8) && pendientesActuales.length > 0) {
      const f = faltas.find(f => f.nombre === 'Bola 8 ilegal')
      if (f) nuevasAuto.add(f.id)
    }
    setFaltasAutoIds(nuevasAuto)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bolas, faltas])

  if (loading) return <div className="spinner" />
  if (!partida) return <p style={{ color: 'var(--accent)' }}>Partida no encontrada</p>

  const finalizada = partida.estado === 'finalizada'
  const equipoActual = partida.equipo1_jugadores.includes(partida.siguiente_jugador_id) ? 1 : 2
  const grupoPropio = equipoActual === 1 ? partida.equipo1_grupo : partida.equipo2_grupo
  const pendientesEq1 = estado?.equipo1_pendientes ?? []
  const pendientesEq2 = estado?.equipo2_pendientes ?? []
  const numeroTurnoSiguiente = turnos.length + 1

  // Bolas que siguen en la mesa: todas (1-15) menos las ya metidas en turnos previos
  const bolasYaMetidas = new Set(estado?.bolas_metidas ?? [])
  const bolasEnMesa = [1,2,3,4,5,6,7,9,10,11,12,13,14,15].filter(n => !bolasYaMetidas.has(n))

  async function registrar() {
    setRegistrando(true)
    setFlash(null)
    try {
      // Calcular falta efectiva: la más grave entre auto-detectadas y manuales
      const todasFaltasIds = [...faltasAutoIds, ...faltasIds]
      let faltaEfectivaId = null
      if (todasFaltasIds.length > 0) {
        const conPierde = todasFaltasIds.filter(
          fid => faltas.find(f => f.id === fid)?.penalizacion === 'pierde_partida'
        )
        faltaEfectivaId = conPierde.length > 0 ? conPierde[0] : todasFaltasIds[0]
      }

      const res = await api.registrarTurno(id, {
        jugador_id: partida.siguiente_jugador_id,
        bolas_metidas: bolas,
        falta_id: faltaEfectivaId,
        bola_en_mano: partida.bola_en_mano,
      })

      setBolas([])
      setFaltasIds(new Set())
      setFaltasAutoIds(new Set())
      await reload()

      if (res.partida_finalizada) {
        setFlash({ texto: `¡Gana Equipo ${res.ganador_equipo}!`, tipo: 'win' })
      } else {
        const partes = []
        if (res.grupos_asignados) partes.push('¡Grupos asignados!')
        if (res.repite) partes.push('Repite turno')
        else partes.push('Turno pasado')
        if (res.bola_en_mano_siguiente) partes.push('Bola en mano')
        setFlash({ texto: partes.join(' · '), tipo: 'ok' })
      }
    } catch (err) {
      setFlash({ texto: err.message, tipo: 'error' })
    } finally {
      setRegistrando(false)
    }
  }

  async function deshacer() {
    if (turnos.length === 0) return
    setFlash(null)
    try {
      await api.deshacerUltimoTurno(id)
      setBolas([])
      setFaltasIds(new Set())
      setFaltasAutoIds(new Set())
      await reload()
      setFlash({ texto: `Turno #${turnos.length} deshecho`, tipo: 'warn' })
    } catch (err) {
      setFlash({ texto: err.message, tipo: 'error' })
    }
  }

  async function eliminar() {
    if (!confirm('¿Eliminar esta partida?')) return
    await api.eliminarPartida(id)
    navigate('/')
  }

  const flashColors = {
    ok:    { bg: 'rgba(20,83,45,.6)',   border: '#166534', text: '#86efac' },
    win:   { bg: 'rgba(161,130,3,.25)', border: '#ca8a04', text: '#fcd34d' },
    warn:  { bg: 'rgba(124,45,18,.5)',  border: '#9a3412', text: '#fdba74' },
    error: { bg: 'rgba(127,29,29,.6)',  border: '#991b1b', text: '#fca5a5' },
    info:  { bg: 'rgba(15,52,96,.6)',   border: '#1e40af', text: '#93c5fd' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700 }}>
            {partida.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
            <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> · Partida #{id}</span>
          </h2>
        </div>
        <span className={`badge ${finalizada ? 'badge-fin' : 'badge-curso'}`}>
          {finalizada ? 'Finalizada' : 'En curso'}
        </span>
      </div>

      {/* Estado de equipos + bolas */}
      <div style={{ display: 'flex', gap: 8 }}>
        <BolasEquipo
          titulo="Equipo 1"
          pendientes={pendientesEq1}
          grupo={partida.equipo1_grupo}
          esActivo={!finalizada && equipoActual === 1}
          ganador={finalizada && partida.ganador_equipo === 1}
        />
        <BolasEquipo
          titulo="Equipo 2"
          pendientes={pendientesEq2}
          grupo={partida.equipo2_grupo}
          esActivo={!finalizada && equipoActual === 2}
          ganador={finalizada && partida.ganador_equipo === 2}
        />
      </div>

      {/* Jugadores de cada equipo */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 14px' }}>
        {[1, 2].map(eq => {
          const ids = eq === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores
          return (
            <div key={eq}>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Equipo {eq}</p>
              {ids.map(jid => (
                <div key={jid} style={{
                  fontSize: '14px',
                  fontWeight: !finalizada && partida.siguiente_jugador_id === jid ? 700 : 500,
                  color: !finalizada && partida.siguiente_jugador_id === jid ? 'var(--accent)' : 'var(--text)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  marginBottom: 2,
                }}>
                  {!finalizada && partida.siguiente_jugador_id === jid && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
                  )}
                  {nombre(jid, jugadores)}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Banner resultado final */}
      {finalizada && (
        <div style={{
          background: 'rgba(161,130,3,.15)',
          border: '1px solid #ca8a04',
          borderRadius: 12,
          padding: '18px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', marginBottom: 4 }}>🏆</div>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#fcd34d' }}>
            Gana Equipo {partida.ganador_equipo}
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-dim)', marginTop: 4 }}>
            {(partida.ganador_equipo === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores)
              .map(jid => nombre(jid, jugadores)).join(', ')}
          </p>
        </div>
      )}

      {/* Formulario de turno */}
      {!finalizada && partida.siguiente_jugador_id && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Turno actual */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
                Turno #{numeroTurnoSiguiente}
              </p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>
                {nombre(partida.siguiente_jugador_id, jugadores)}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {partida.bola_en_mano && (
                <span className="badge" style={{ background: '#3d2c00', color: '#fcd34d', fontSize: '12px' }}>
                  Bola en mano
                </span>
              )}
              {grupoPropio && (
                <span className={`badge badge-${grupoPropio}`}>{grupoPropio}</span>
              )}
            </div>
          </div>

          {/* Selector bolas */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Bolas metidas</p>
              {bolas.length > 0 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {bolas.map(n => <BolaPool key={n} numero={n} size={26} />)}
                  <button
                    onClick={() => setBolas([])}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
                  >×</button>
                </div>
              )}
            </div>
            <SelectorBolas
              seleccionadas={bolas}
              onChange={setBolas}
              grupoPropio={grupoPropio}
              bolasEnMesa={bolasEnMesa}
            />
          </div>

          {/* Selector falta */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Faltas</p>
              {(faltasIds.size > 0 || faltasAutoIds.size > 0) && (
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Se aplica la más grave
                </span>
              )}
            </div>

            {/* Faltas auto-detectadas */}
            {faltasAutoIds.size > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {[...faltasAutoIds].map(fid => (
                  <span key={fid} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
                    background: 'rgba(233,69,96,.15)', border: '1.5px solid rgba(233,69,96,.6)',
                    color: 'var(--accent)',
                  }}>
                    ⚡ {faltas.find(f => f.id === fid)?.nombre}
                  </span>
                ))}
              </div>
            )}

            {/* Faltas manuales */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {faltas
                .filter(f => !['Blanca dentro (Scratch)', 'Bola 8 ilegal', 'Tres faltas consecutivas'].includes(f.nombre))
                .map(f => {
                  const sel = faltasIds.has(f.id)
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFaltasIds(prev => {
                          const s = new Set(prev)
                          sel ? s.delete(f.id) : s.add(f.id)
                          return s
                        })
                      }}
                      style={{
                        padding: '7px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
                        border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        background: sel ? 'rgba(233,69,96,.15)' : 'var(--surface2)',
                        color: sel ? 'var(--accent)' : 'var(--text)',
                        cursor: 'pointer',
                        transition: 'background .15s, border-color .15s',
                      }}
                    >
                      {f.nombre}
                    </button>
                  )
                })
              }
            </div>
          </div>

          {/* Flash message */}
          {flash && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '14px',
              fontWeight: 600,
              background: flashColors[flash.tipo].bg,
              border: `1px solid ${flashColors[flash.tipo].border}`,
              color: flashColors[flash.tipo].text,
              animation: 'fadeIn .2s ease',
            }}>
              {flash.texto}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-full"
              onClick={registrar}
              disabled={registrando}
              style={{ padding: '15px', fontSize: '17px', borderRadius: 10, flex: 1 }}
            >
              {registrando ? 'Registrando…' : 'Confirmar turno'}
            </button>
            {turnos.length > 0 && (
              <button
                className="btn btn-ghost"
                onClick={deshacer}
                disabled={registrando}
                title="Deshacer último turno"
                style={{ padding: '15px 16px', borderRadius: 10, fontSize: '18px', flexShrink: 0 }}
              >
                ↩
              </button>
            )}
          </div>
        </div>
      )}

      {/* Historial de turnos */}
      <div>
        <button
          className="btn btn-ghost btn-full"
          onClick={() => setMostrarTurnos(v => !v)}
          style={{ marginBottom: 8 }}
        >
          {mostrarTurnos ? '▲ Ocultar historial' : `▼ Historial (${turnos.length} turnos)`}
        </button>

        {mostrarTurnos && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...turnos].reverse().map(t => (
              <div key={t.id} className="card" style={{ padding: '10px 14px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.bolas_metidas.length > 0 ? 8 : 0 }}>
                  <span style={{ fontWeight: 700 }}>
                    <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>#{t.numero} </span>
                    {nombre(t.jugador_id, jugadores)}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.bola_en_mano && (
                      <span className="badge" style={{ background: '#3d2c00', color: '#fcd34d', fontSize: '11px' }}>mano</span>
                    )}
                    {t.repite && (
                      <span className="badge" style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: '11px' }}>repitió</span>
                    )}
                    {t.falta_id && (
                      <span className="badge" style={{ background: 'rgba(127,29,29,.5)', color: '#fca5a5', fontSize: '11px' }}>
                        {faltas.find(f => f.id === t.falta_id)?.nombre ?? 'falta'}
                      </span>
                    )}
                  </div>
                </div>
                {t.bolas_metidas.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {t.bolas_metidas.map(n => <BolaPool key={n} numero={n} size={28} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className="btn btn-danger btn-full"
        onClick={eliminar}
        style={{ marginTop: 4 }}
      >
        Eliminar partida
      </button>
    </div>
  )
}
