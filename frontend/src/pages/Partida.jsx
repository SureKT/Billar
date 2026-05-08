import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [ultimoReload, setUltimoReload] = useState(null)

  const reload = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const [p, t, j, f] = await Promise.all([
        api.getPartida(id),
        api.getTurnos(id),
        api.getJugadores(),
        api.getFaltas(),
      ])
      setPartida(p)
      setTurnos(Array.isArray(t) ? t : [])
      setJugadores(Array.isArray(j) ? j : [])
      setFaltas(Array.isArray(f) ? f : [])
      if (p) {
        const e = await api.getEstadoPartida(id)
        setEstado(e)
      }
      setUltimoReload(new Date())
    } catch (err) {
      console.error('reload error:', err)
      throw err   // re-throw para que registrar() lo capture en su try/catch
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { reload(true) }, [reload])

  useEffect(() => {
    function onFocus() { reload().catch(console.error) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  // Polling ligero: resincroniza cada 15 s mientras la partida está en curso
  // (útil en multidispositivo o si alguien recarga desde otro móvil)
  useEffect(() => {
    if (!partida || partida.estado !== 'en_curso') return
    const timer = setInterval(() => { reload().catch(() => {}) }, 15_000)
    return () => clearInterval(timer)
  }, [partida?.estado, reload])

  return { partida, estado, turnos, jugadores, faltas, loading, reload, ultimoReload }
}

function nombre(id, jugadores) {
  return jugadores.find(j => j.id === id)?.nombre ?? `#${id}`
}

function duracion(fecha, fechaFin) {
  const ms = new Date(fechaFin ?? Date.now()) - new Date(fecha)
  const min = Math.floor(ms / 60_000)
  const seg = Math.floor((ms % 60_000) / 1_000)
  return min > 0 ? `${min} min ${seg} s` : `${seg} s`
}

// Colores por equipo
const TEAM = {
  1: { color: 'var(--team1)', bg: 'rgba(59,130,246,.09)', border: 'rgba(59,130,246,.38)' },
  2: { color: 'var(--team2)', bg: 'rgba(233,69,96,.09)',  border: 'rgba(233,69,96,.38)'  },
}

function BolasEquipo({ titulo, teamNum, pendientes, grupo, esActivo, ganador, jugadoresEquipo, siguienteJugadorId, modalidad }) {
  const t = TEAM[teamNum]
  const esBola9 = modalidad === 'bola9'
  return (
    <div style={{
      background: esActivo ? t.bg : 'var(--surface2)',
      border: `1px solid ${esActivo ? t.border : 'var(--border)'}`,
      borderRadius: 10,
      padding: '8px 10px',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
          color: esActivo ? t.color : 'var(--text-dim)',
        }}>
          {titulo} {ganador && '🏆'}
        </span>
        {!esBola9 && (grupo
          ? <span className={`badge badge-${grupo}`} style={{ fontSize: '10px', padding: '2px 7px' }}>{grupo}</span>
          : <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>—</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {jugadoresEquipo.map(j => (
          <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {j.id === siguienteJugadorId && !ganador && (
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
            )}
            <span style={{
              fontSize: '13px',
              fontWeight: j.id === siguienteJugadorId && !ganador ? 700 : 400,
              color: j.id === siguienteJugadorId && !ganador ? 'var(--text)' : 'var(--text-dim)',
              paddingLeft: j.id === siguienteJugadorId && !ganador ? 0 : 10,
            }}>{j.nombre}</span>
          </div>
        ))}
      </div>

      {!esBola9 && (pendientes.length === 0 && grupo
        ? <p style={{ fontSize: '11px', color: '#86efac' }}>¡Listas!</p>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {pendientes.map(n => <BolaPool key={n} numero={n} size={26} />)}
          </div>
        )
      )}
    </div>
  )
}


// Faltas gestionadas automáticamente (no aparecen en el selector manual)
const FALTAS_OCULTAS = [
  'Blanca dentro (Scratch)',
  'Bola 8 ilegal',
  'Tres faltas consecutivas',
]

// Faltas que siempre se muestran como botón visible, con independencia de su frecuencia
const FALTAS_FIJAS = ['No toca objetivo legal']

export default function Partida() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { partida, estado, turnos, jugadores, faltas, loading, reload, ultimoReload } = usePartidaData(id)

  const [bolas, setBolas] = useState([])
  const [faltasIds, setFaltasIds] = useState(new Set())
  const [faltasAutoIds, setFaltasAutoIds] = useState(new Set())
  const [registrando, setRegistrando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [flash, setFlash] = useState(null)
  const [mostrarTurnos, setMostrarTurnos] = useState(false)
  const [otrasFaltasOpen, setOtrasFaltasOpen] = useState(false)
  const wakeLockRef = useRef(null)

  useEffect(() => {
    if (!faltas?.length || !partida) return
    const nuevasAuto = new Set()

    // Scratch (blanca dentro):
    //  - No aplica cuando en bola9 entra la 9 también (caso respot, badge aparte)
    //  - No aplica cuando en bola8 es el saque con la 8 también (caso pierde, badge aparte)
    // IMPORTANTE: usar turnos.length (definido antes del early return) en lugar de
    // numeroTurnoSiguiente (declarada después — estaría en TDZ y petar la app en bola8)
    const saqueConOcho = partida.modalidad === 'bola8' && turnos.length === 0 && bolas.includes(8)
    if (bolas.includes(0) && !bolas.includes(9) && !saqueConOcho) {
      const f = faltas.find(f => f.nombre === 'Blanca dentro (Scratch)')
      if (f) nuevasAuto.add(f.id)
    }

    // Bola 8 ilegal — solo en Bola 8
    if (partida.modalidad === 'bola8') {
      const pendientesActuales = partida.equipo1_jugadores?.includes(partida.siguiente_jugador_id)
        ? (estado?.equipo1_pendientes ?? [])
        : (estado?.equipo2_pendientes ?? [])
      if (bolas.includes(8) && pendientesActuales.length > 0) {
        const f = faltas.find(f => f.nombre === 'Bola 8 ilegal')
        if (f) nuevasAuto.add(f.id)
      }
    }

    setFaltasAutoIds(nuevasAuto)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bolas, faltas, partida?.modalidad])

  useEffect(() => {
    if (!partida || partida.estado !== 'en_curso') return
    async function acquire() {
      try { wakeLockRef.current = await navigator.wakeLock?.request('screen') } catch {}
    }
    acquire()
    function onVisibility() { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      wakeLockRef.current?.release()
      wakeLockRef.current = null
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [partida?.estado])

  if (loading) return <div className="spinner" />
  if (!partida) return <p style={{ color: 'var(--team2)' }}>Partida no encontrada</p>

  const finalizada = partida.estado === 'finalizada'
  const equipoActual = partida.equipo1_jugadores.includes(partida.siguiente_jugador_id) ? 1 : 2
  const grupoPropio = equipoActual === 1 ? partida.equipo1_grupo : partida.equipo2_grupo
  const pendientesEq1 = estado?.equipo1_pendientes ?? []
  const pendientesEq2 = estado?.equipo2_pendientes ?? []
  const numeroTurnoSiguiente = turnos.length + 1

  const bolasYaMetidas = new Set(estado?.bolas_metidas ?? [])
  const bolasEnMesa = partida.modalidad === 'bola9'
    ? [1,2,3,4,5,6,7,8,9].filter(n => !bolasYaMetidas.has(n))
    : [1,2,3,4,5,6,7,9,10,11,12,13,14,15].filter(n => !bolasYaMetidas.has(n))
  const bolaObjetivo = estado?.bola_objetivo ?? null

  // Faltas manuales ordenadas por frecuencia de la modalidad activa
  // Así la falta más habitual en bola8 aparece arriba en bola8, y viceversa en bola9
  const freqKey = partida.modalidad === 'bola9' ? 'frecuencia_bola9' : 'frecuencia_bola8'
  const faltasManualesOrdenadas = (faltas ?? [])
    .filter(f => !FALTAS_OCULTAS.includes(f.nombre) && !FALTAS_FIJAS.includes(f.nombre))
    .sort((a, b) => (b[freqKey] ?? 0) - (a[freqKey] ?? 0))
  const faltasFijasVisibles = (faltas ?? []).filter(f => FALTAS_FIJAS.includes(f.nombre))
  const faltaPrincipal = faltasManualesOrdenadas[0] ?? null
  const faltasSecundarias = faltasManualesOrdenadas.slice(1)

  async function registrar() {
    setRegistrando(true)
    setFlash(null)
    try {
      const todasFaltasIds = [...faltasAutoIds, ...faltasIds]
      let faltaEfectivaId = null
      if (todasFaltasIds.length > 0) {
        const conPierde = todasFaltasIds.filter(
          fid => faltas.find(f => f.id === fid)?.penalizacion === 'pierde_partida'
        )
        faltaEfectivaId = conPierde.length > 0 ? conPierde[0] : todasFaltasIds[0]
      }
      await api.registrarTurno(id, {
        jugador_id: partida.siguiente_jugador_id,
        bolas_metidas: bolas,
        falta_id: faltaEfectivaId,
        bola_en_mano: partida.bola_en_mano,
      })
      setBolas([])
      setFaltasIds(new Set())
      setFaltasAutoIds(new Set())
      await reload()
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
    } catch (err) {
      setFlash({ texto: err.message, tipo: 'error' })
    }
  }

  async function eliminar() {
    await api.eliminarPartida(id)
    navigate('/')
  }

  function getSiguienteNoRepite() {
    const rivalesIds = equipoActual === 1 ? partida.equipo2_jugadores : partida.equipo1_jugadores
    if (!rivalesIds.length) return null
    if (rivalesIds.length === 1) return rivalesIds[0]
    const turnosRival = turnos.filter(t => rivalesIds.includes(t.jugador_id))
    if (!turnosRival.length) return rivalesIds[0]
    const lastId = turnosRival[turnosRival.length - 1].jugador_id
    const idx = rivalesIds.indexOf(lastId)
    return rivalesIds[(idx + 1) % rivalesIds.length]
  }

  function revancha() {
    navigate('/nueva', {
      state: {
        modalidad: partida.modalidad,
        equipo1: partida.equipo2_jugadores,
        equipo2: partida.equipo1_jugadores,
      }
    })
  }

  const siguienteNoRepite = !finalizada ? getSiguienteNoRepite() : null

  const equipoActualIds = equipoActual === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores
  const turnosEquipoDesc = [...turnos]
    .filter(t => equipoActualIds.includes(t.jugador_id))
    .sort((a, b) => b.numero - a.numero)
  let faltasConsecutivas = 0
  for (const t of turnosEquipoDesc) {
    if (t.falta_id) faltasConsecutivas++
    else break
  }

  function renderFaultBtn(f) {
    const sel = faltasIds.has(f.id)
    return (
      <button
        key={f.id}
        onClick={() => setFaltasIds(prev => {
          const s = new Set(prev)
          sel ? s.delete(f.id) : s.add(f.id)
          return s
        })}
        style={{
          padding: '7px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
          border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
          background: sel ? 'var(--accent-bg)' : 'var(--surface2)',
          color: sel ? 'var(--accent)' : 'var(--text)',
          cursor: 'pointer', transition: 'background .15s, border-color .15s',
        }}
      >{f.nombre}</button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: '20px', lineHeight: 1, flexShrink: 0,
              borderRadius: 6, transition: 'color .15s',
            }}
            title="Volver a partidas"
          >‹</button>
          <h2 style={{ fontSize: '17px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {partida.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
            <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> · #{id}</span>
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0, marginLeft: 8 }}>
          <span className={`badge ${finalizada ? 'badge-fin' : 'badge-curso'}`}>
            {finalizada ? 'Finalizada' : 'En curso'}
          </span>
          {!finalizada && ultimoReload && (
            <span style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '.03em' }}>
              sync {ultimoReload.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Estado de equipos */}
      <div style={{ display: 'flex', gap: 8 }}>
        <BolasEquipo
          titulo="Equipo 1" teamNum={1}
          pendientes={pendientesEq1}
          grupo={partida.equipo1_grupo}
          esActivo={!finalizada && equipoActual === 1}
          ganador={finalizada && partida.ganador_equipo === 1}
          jugadoresEquipo={partida.equipo1_jugadores.map(id => ({ id, nombre: nombre(id, jugadores) }))}
          siguienteJugadorId={partida.siguiente_jugador_id}
          modalidad={partida.modalidad}
        />
        <BolasEquipo
          titulo="Equipo 2" teamNum={2}
          pendientes={pendientesEq2}
          grupo={partida.equipo2_grupo}
          esActivo={!finalizada && equipoActual === 2}
          ganador={finalizada && partida.ganador_equipo === 2}
          jugadoresEquipo={partida.equipo2_jugadores.map(id => ({ id, nombre: nombre(id, jugadores) }))}
          siguienteJugadorId={partida.siguiente_jugador_id}
          modalidad={partida.modalidad}
        />
      </div>

      {/* Banner resultado final */}
      {finalizada && (() => {
        const bolasXJugador = {}
        const faltasXEquipo = { 1: 0, 2: 0 }
        for (const t of turnos) {
          bolasXJugador[t.jugador_id] = (bolasXJugador[t.jugador_id] ?? 0) + (t.bolas_metidas?.length ?? 0)
          const eq = partida.equipo1_jugadores.includes(t.jugador_id) ? 1 : 2
          if (t.falta_id) faltasXEquipo[eq]++
        }
        const mvpId = Object.entries(bolasXJugador).sort((a, b) => b[1] - a[1])[0]?.[0]
        const ganadores = partida.ganador_equipo === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores
        const ganadorTeam = TEAM[partida.ganador_equipo]

        return (
          <div style={{
            background: 'rgba(161,130,3,.15)', border: '1px solid #ca8a04',
            borderRadius: 12, padding: '18px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', marginBottom: 4 }}>🏆</div>
            <p style={{ fontSize: '20px', fontWeight: 800, color: '#fcd34d' }}>
              Gana Equipo {partida.ganador_equipo}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-dim)', marginTop: 4 }}>
              {ganadores.map(jid => nombre(jid, jugadores)).join(', ')}
            </p>

            {partida.fecha_fin && (
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: 6 }}>
                ⏱ {duracion(partida.fecha, partida.fecha_fin)}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
              {[
                { label: 'Turnos', value: turnos.length },
                { label: 'Faltas Eq1', value: faltasXEquipo[1], color: TEAM[1].color },
                { label: 'Faltas Eq2', value: faltasXEquipo[2], color: TEAM[2].color },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '8px 4px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: color ?? '#fcd34d' }}>{value}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
                .sort((a, b) => (bolasXJugador[b] ?? 0) - (bolasXJugador[a] ?? 0))
                .map(jid => {
                  const bolas = bolasXJugador[jid] ?? 0
                  const esMvp = String(jid) === String(mvpId) && bolas > 0
                  const esEq1 = partida.equipo1_jugadores.includes(jid)
                  return (
                    <div key={jid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 6, background: esMvp ? 'rgba(161,130,3,.15)' : 'transparent' }}>
                      <span style={{ fontSize: '13px', color: esMvp ? '#fcd34d' : TEAM[esEq1 ? 1 : 2].color, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {esMvp ? '★ ' : ''}{nombre(jid, jugadores)}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: esMvp ? '#fcd34d' : 'var(--text-dim)' }}>{bolas} bolas</span>
                    </div>
                  )
                })}
            </div>

            <button className="btn btn-primary" onClick={revancha}
              style={{ marginTop: 14, padding: '10px 28px', fontSize: '15px' }}>
              ↺ Revancha
            </button>
          </div>
        )
      })()}

      {/* Formulario de turno */}
      {!finalizada && partida.siguiente_jugador_id && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Cabecera: turno | bola en mano centrada | siguiente alineado a la derecha */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 4 }}>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Turno #{numeroTurnoSiguiente}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {partida.bola_en_mano && (
                <span className="badge" style={{ background: '#3d2c00', color: '#fcd34d', fontSize: '11px' }}>
                  Bola en mano
                </span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {siguienteNoRepite && (
                <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'right' }}>
                  siguiente → {nombre(siguienteNoRepite, jugadores)}
                </p>
              )}
            </div>
          </div>

          {/* Selector bolas — fila de preview con min-height fija para evitar saltos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: 34, marginBottom: 8 }}>
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
              modalidad={partida.modalidad}
              bolaObjetivo={bolaObjetivo}
            />
          </div>

          {/* Aviso faltas consecutivas */}
          {faltasConsecutivas >= 1 && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
              background: faltasConsecutivas >= 2 ? 'rgba(127,29,29,.5)' : 'rgba(124,45,18,.35)',
              border: `1px solid ${faltasConsecutivas >= 2 ? '#991b1b' : '#9a3412'}`,
              color: faltasConsecutivas >= 2 ? '#fca5a5' : '#fdba74',
            }}>
              {faltasConsecutivas >= 2
                ? '⚠ 2 faltas seguidas — la próxima pierde la partida'
                : '1 falta seguida — cuidado con la siguiente'}
            </div>
          )}

          {/* Faltas: auto-detectadas + manuales ordenadas por frecuencia */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* Auto-detectadas y badges informativos — min-height para evitar saltos */}
            <div style={{ minHeight: 36, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
              {/* Badges de faltas automáticas */}
              {[...faltasAutoIds].map(fid => (
                <span key={fid} style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
                  background: 'rgba(245,158,11,.14)', border: '1.5px solid rgba(245,158,11,.4)',
                  color: '#fbbf24',
                }}>
                  ⚡ {faltas.find(f => f.id === fid)?.nombre}
                </span>
              ))}
              {/* Golden Break — Bola 8 limpio (sin scratch) */}
              {partida.modalidad === 'bola8' && numeroTurnoSiguiente === 1 && bolas.includes(8) && !bolas.includes(0) && (
                <span style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 700,
                  background: 'rgba(161,130,3,.25)', border: '1.5px solid #ca8a04',
                  color: '#fcd34d',
                }}>
                  ✦ Golden Break · ¡Victoria!
                </span>
              )}
              {/* Golden Break + Scratch — Bola 8 (pierde) */}
              {partida.modalidad === 'bola8' && numeroTurnoSiguiente === 1 && bolas.includes(8) && bolas.includes(0) && (
                <span style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 700,
                  background: 'rgba(127,29,29,.5)', border: '1.5px solid #991b1b',
                  color: '#fca5a5',
                }}>
                  ✦ Scratch en el saque con la 8 · Pierde la partida
                </span>
              )}
              {/* Golden Break — Bola 9 (meter la 9 en el saque sin blanca) */}
              {partida.modalidad === 'bola9' && numeroTurnoSiguiente === 1 && bolas.includes(9) && !bolas.includes(0) && (
                <span style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 700,
                  background: 'rgba(161,130,3,.25)', border: '1.5px solid #ca8a04',
                  color: '#fcd34d',
                }}>
                  ✦ Golden Break · ¡Victoria!
                </span>
              )}
              {/* Respot de la 9: bola 9 + blanca juntas en Bola 9 */}
              {partida.modalidad === 'bola9' && bolas.includes(9) && bolas.includes(0) && (
                <span style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
                  background: 'rgba(245,158,11,.14)', border: '1.5px solid rgba(245,158,11,.4)',
                  color: '#fbbf24',
                }}>
                  ⚡ La 9 se respotea · bola en mano
                </span>
              )}
            </div>

            {/* Faltas fijas — siempre visibles independientemente de frecuencia */}
            {faltasFijasVisibles.map(f => renderFaultBtn(f))}

            {/* Falta principal (más frecuente) — siempre visible */}
            {faltaPrincipal && renderFaultBtn(faltaPrincipal)}

            {/* Otras faltas — colapsable */}
            {faltasSecundarias.length > 0 && (
              <>
                <button
                  onClick={() => setOtrasFaltasOpen(v => !v)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600,
                    textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.04em',
                    alignSelf: 'flex-start',
                  }}
                >
                  {otrasFaltasOpen ? '▲' : '▼'} Otras faltas
                </button>
                {otrasFaltasOpen && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {faltasSecundarias.map(f => renderFaultBtn(f))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Flash de error */}
          {flash && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: '14px', fontWeight: 600,
              background: 'rgba(127,29,29,.6)', border: '1px solid #991b1b',
              color: '#fca5a5', animation: 'fadeIn .2s ease',
            }}>
              {flash.texto}
            </div>
          )}

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-full"
              onClick={registrar}
              disabled={registrando}
              style={{ padding: '15px', fontSize: '17px', borderRadius: 10, flex: 1 }}
            >
              {registrando ? 'Registrando…' : '✓ Confirmar turno'}
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
            {[...turnos].reverse().map(t => {
              const esEq1 = partida.equipo1_jugadores.includes(t.jugador_id)
              const tColor = TEAM[esEq1 ? 1 : 2].color
              return (
                <div key={t.id} className="card" style={{
                  padding: '10px 14px', fontSize: '13px',
                  borderLeft: `3px solid ${tColor}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (t.bolas_metidas?.length ?? 0) > 0 ? 8 : 0 }}>
                    <span style={{ fontWeight: 700, color: tColor }}>
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
                  {(t.bolas_metidas?.length ?? 0) > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(t.bolas_metidas ?? []).map(n => <BolaPool key={n} numero={n} size={28} />)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!confirmarBorrar ? (
        <button
          className="btn btn-ghost btn-full"
          onClick={() => setConfirmarBorrar(true)}
          style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: '13px' }}
        >
          🗑 Eliminar partida
        </button>
      ) : (
        <div className="card" style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: '13px', color: '#fca5a5', textAlign: 'center' }}>
            ¿Eliminar esta partida? No se puede deshacer.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger btn-full" onClick={eliminar}>Sí, eliminar</button>
            <button className="btn btn-ghost btn-full" onClick={() => setConfirmarBorrar(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
