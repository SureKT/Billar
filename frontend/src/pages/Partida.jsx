import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { usePartidaData } from '../hooks/usePartidaData'
import BolasEquipo from '../components/partida/BolasEquipo'
import ResultadoBanner from '../components/partida/ResultadoBanner'
import FormularioTurno from '../components/partida/FormularioTurno'
import HistorialTurnos from '../components/partida/HistorialTurnos'

export default function Partida() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { partida, estado, turnos, jugadores, faltas, stats, loading, reload, ultimoReload } = usePartidaData(id)

  const [bolas, setBolas]             = useState([])
  const [faltasIds, setFaltasIds]     = useState(new Set())
  const [faltasAutoIds, setFaltasAutoIds] = useState(new Set())
  const [registrando, setRegistrando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [flash, setFlash]             = useState(null)
  const [editandoTiempos, setEditandoTiempos] = useState(false)
  const [fechaEdit, setFechaEdit]     = useState('')
  const [fechaFinEdit, setFechaFinEdit] = useState('')
  const [guardandoTiempos, setGuardandoTiempos] = useState(false)
  const wakeLockRef = useRef(null)

  // ── Auto-detect faltas según bolas seleccionadas ─────────────────────────────
  useEffect(() => {
    if (!faltas?.length || !partida) return
    const nuevasAuto = new Set()
    const esBola8 = partida.modalidad === 'bola8'
    const esBola9 = partida.modalidad === 'bola9'
    const esBreak = turnos.length === 0

    // Bola 8 ilegal (fuera del break)
    if (esBola8 && bolas.includes(8) && !esBreak) {
      const sinGrupos = !partida.equipo1_grupo
      const pendientesActuales = partida.equipo1_jugadores?.includes(partida.siguiente_jugador_id)
        ? (estado?.equipo1_pendientes ?? [])
        : (estado?.equipo2_pendientes ?? [])
      if (sinGrupos || pendientesActuales.length > 0) {
        const f = faltas.find(f => f.nombre === 'Bola 8 ilegal')
        if (f) nuevasAuto.add(f.id)
      }
    }

    // Scratch (blanca dentro) — omitido cuando la 8 o la 9 también entran
    const omitirScratch = (esBola8 && bolas.includes(8)) || (esBola9 && bolas.includes(9))
    if (bolas.includes(0) && !omitirScratch) {
      const f = faltas.find(f => f.nombre === 'Blanca dentro (Scratch)')
      if (f) nuevasAuto.add(f.id)
    }

    setFaltasAutoIds(nuevasAuto)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bolas, faltas, partida?.modalidad, partida?.equipo1_grupo, estado, turnos.length])

  // ── Wake lock: pantalla encendida mientras la partida está en curso ───────────
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

  // ── Aviso al salir si hay bolas seleccionadas ─────────────────────────────────
  useEffect(() => {
    if (bolas.length === 0) return
    function onBeforeUnload(e) { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [bolas.length])

  // ── Guards ────────────────────────────────────────────────────────────────────
  if (loading) return <div className="spinner" />
  if (!partida) return <p style={{ color: 'var(--team2)' }}>Partida no encontrada</p>

  // ── Valores derivados ────────────────────────────────────────────────────────
  const finalizada   = partida.estado === 'finalizada'
  const equipoActual = partida.equipo1_jugadores.includes(partida.siguiente_jugador_id) ? 1 : 2
  const pendientesEq1 = estado?.equipo1_pendientes ?? []
  const pendientesEq2 = estado?.equipo2_pendientes ?? []

  // Mapa id→stats para rachas
  const statsMap = Object.fromEntries((stats ?? []).map(s => [s.id, s]))

  function buildEquipo(ids) {
    return ids.map(jid => ({
      id:     jid,
      nombre: jugadores.find(j => j.id === jid)?.nombre ?? `#${jid}`,
      racha:  statsMap[jid]?.racha_actual ?? 0,
    }))
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleBack() {
    if (bolas.length > 0 && !window.confirm('¿Salir? Perderás las bolas seleccionadas.')) return
    navigate('/')
  }

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
        jugador_id:   partida.siguiente_jugador_id,
        bolas_metidas: bolas,
        falta_id:     faltaEfectivaId,
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

  function revancha() {
    navigate('/nueva', {
      state: {
        modalidad: partida.modalidad,
        equipo1:   partida.equipo2_jugadores,
        equipo2:   partida.equipo1_jugadores,
      }
    })
  }

  function toDatetimeLocal(isoStr) {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    const p = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  function abrirEditarTiempos() {
    setFechaEdit(toDatetimeLocal(partida.fecha))
    setFechaFinEdit(toDatetimeLocal(partida.fecha_fin))
    setEditandoTiempos(true)
  }

  async function guardarTiempos() {
    setGuardandoTiempos(true)
    try {
      const datos = {}
      if (fechaEdit)    datos.fecha     = new Date(fechaEdit).toISOString()
      if (fechaFinEdit) datos.fecha_fin = new Date(fechaFinEdit).toISOString()
      await api.actualizarTiempos(id, datos)
      setEditandoTiempos(false)
      await reload()
    } catch (err) {
      setFlash({ texto: err.message, tipo: 'error' })
    } finally {
      setGuardandoTiempos(false)
    }
  }

  function repetir() {
    navigate('/nueva', {
      state: {
        modalidad: partida.modalidad,
        equipo1:   partida.equipo1_jugadores,
        equipo2:   partida.equipo2_jugadores,
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={handleBack}
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
          jugadoresEquipo={buildEquipo(partida.equipo1_jugadores)}
          siguienteJugadorId={partida.siguiente_jugador_id}
          modalidad={partida.modalidad}
        />
        <BolasEquipo
          titulo="Equipo 2" teamNum={2}
          pendientes={pendientesEq2}
          grupo={partida.equipo2_grupo}
          esActivo={!finalizada && equipoActual === 2}
          ganador={finalizada && partida.ganador_equipo === 2}
          jugadoresEquipo={buildEquipo(partida.equipo2_jugadores)}
          siguienteJugadorId={partida.siguiente_jugador_id}
          modalidad={partida.modalidad}
        />
      </div>

      {/* Banner de resultado */}
      {finalizada && (
        <ResultadoBanner
          partida={partida}
          turnos={turnos}
          jugadores={jugadores}
          onRevancha={revancha}
          onRepetir={repetir}
        />
      )}

      {/* Formulario del turno */}
      {!finalizada && partida.siguiente_jugador_id && (
        <FormularioTurno
          partida={partida}
          estado={estado}
          turnos={turnos}
          jugadores={jugadores}
          faltas={faltas}
          bolas={bolas}
          setBolas={setBolas}
          faltasIds={faltasIds}
          setFaltasIds={setFaltasIds}
          faltasAutoIds={faltasAutoIds}
          registrando={registrando}
          flash={flash}
          onRegistrar={registrar}
          onDeshacer={deshacer}
        />
      )}

      {/* Historial de turnos */}
      <HistorialTurnos
        turnos={turnos}
        jugadores={jugadores}
        faltas={faltas}
        equipo1Jugadores={partida.equipo1_jugadores}
        equipo2Jugadores={partida.equipo2_jugadores}
      />

      {/* Editar tiempos */}
      {!editandoTiempos ? (
        <button
          className="btn btn-ghost btn-full"
          onClick={abrirEditarTiempos}
          style={{ color: 'var(--text-dim)', fontSize: '13px' }}
        >
          ✎ Editar tiempos
        </button>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)' }}>
            Editar tiempos
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Inicio</span>
              <input
                type="datetime-local"
                value={fechaEdit}
                onChange={e => setFechaEdit(e.target.value)}
                style={{ fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Fin</span>
              <input
                type="datetime-local"
                value={fechaFinEdit}
                onChange={e => setFechaFinEdit(e.target.value)}
                style={{ fontSize: '14px' }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-full"
              onClick={guardarTiempos}
              disabled={guardandoTiempos}
            >
              {guardandoTiempos ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              className="btn btn-ghost btn-full"
              onClick={() => setEditandoTiempos(false)}
              disabled={guardandoTiempos}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Eliminar partida */}
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
