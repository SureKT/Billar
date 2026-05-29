import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { usePartidaData } from '../hooks/usePartidaData'
import BolasEquipo from '../components/partida/BolasEquipo'
import ResultadoBanner from '../components/partida/ResultadoBanner'
import FormularioTurno from '../components/partida/FormularioTurno'
import HistorialTurnos from '../components/partida/HistorialTurnos'
import { toastLogrosNuevos } from '../utils/toast'

export default function Partida() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { partida, estado, turnos, jugadores, faltas, stats, loading, reload, ultimoReload } = usePartidaData(id)

  const [bolas, setBolas]             = useState([])
  const [faltasIds, setFaltasIds]     = useState(new Set())
  const [faltasAutoIds, setFaltasAutoIds] = useState(new Set())
  const [registrando, setRegistrando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [borrando, setBorrando]       = useState(false)
  const pendingDelRef = useRef(null)
  const [confirmarSalir, setConfirmarSalir]   = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [flash, setFlash]             = useState(null)
  const [editandoTiempos, setEditandoTiempos] = useState(false)
  const [editandoTurnos, setEditandoTurnos] = useState(false)
  const [fechaEdit, setFechaEdit]     = useState('')
  const [fechaFinEdit, setFechaFinEdit] = useState('')
  const [guardandoTiempos, setGuardandoTiempos] = useState(false)
  const [duracionActiva, setDuracionActiva] = useState('')
  const [logrosPartida, setLogrosPartida] = useState(null)
  const wakeLockRef = useRef(null)

  // Desmontaje con borrado diferido pendiente → confirmar (usuario navegó sin deshacer). Sin loose ends.
  useEffect(() => () => {
    const pd = pendingDelRef.current
    if (pd) { clearTimeout(pd.timer); api.eliminarPartida(id).catch(() => {}) }
  }, [id])

  // ── Cronómetro partida activa ─────────────────────────────────────────────────
  useEffect(() => {
    if (!partida || partida.estado !== 'en_curso') { setDuracionActiva(''); return }
    function tick() {
      const ms = Date.now() - new Date(partida.fecha).getTime()
      const min = Math.floor(ms / 60_000)
      const seg = Math.floor((ms % 60_000) / 1_000)
      setDuracionActiva(`${min}' ${String(seg).padStart(2, '0')}"`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [partida?.fecha, partida?.estado])

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

  // ── Toast de logros de creación (vienen por navigate state desde NuevaPartida) ─
  useEffect(() => {
    const ln = location.state?.logrosNuevos
    if (ln?.length) {
      toastLogrosNuevos(ln)
      navigate(location.pathname, { replace: true, state: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Logros desbloqueados en esta partida (para ResultadoBanner) ───────────────
  useEffect(() => {
    if (!partida || partida.estado !== 'finalizada') return
    const ids = [...partida.equipo1_jugadores, ...partida.equipo2_jugadores]
    Promise.all(ids.map(jid => api.getLogrosJugador(jid)))
      .then(results => {
        const encontrados = []
        const ORDEN_NIVELES = ['bronce', 'plata', 'oro', 'platino']
        ids.forEach((jid, i) => {
          for (const logro of results[i]) {
            const pid = parseInt(id)
            if (logro.desbloqueado && logro.partida_id === pid) {
              encontrados.push({ jugador_id: jid, ...logro })
            } else if (logro.niveles_partida_id) {
              const nivelesAqui = Object.entries(logro.niveles_partida_id)
                .filter(([, npid]) => npid === pid)
                .map(([nivel]) => nivel)
              if (nivelesAqui.length > 0) {
                const nivelMasAlto = nivelesAqui.sort(
                  (a, b) => ORDEN_NIVELES.indexOf(a) - ORDEN_NIVELES.indexOf(b)
                ).at(-1)
                encontrados.push({ jugador_id: jid, ...logro, nivel_actual: nivelMasAlto })
              }
            }
          }
        })
        setLogrosPartida(encontrados)
      })
      .catch(() => setLogrosPartida([]))
  }, [partida?.estado, partida?.id, id])

  // ── Guards ────────────────────────────────────────────────────────────────────
  if (loading) return <div className="spinner" />
  if (!partida) return <p style={{ color: 'var(--team2)' }}>Partida no encontrada</p>

  // ── Valores derivados ────────────────────────────────────────────────────────
  const finalizada   = partida.estado === 'finalizada'
  const equipoActual = partida.equipo1_jugadores.includes(partida.siguiente_jugador_id) ? 1 : 2
  const pendientesEq1 = estado?.equipo1_pendientes ?? []
  const pendientesEq2 = estado?.equipo2_pendientes ?? []

  // Mapa id→stats para rachas y faltas personales
  const statsMap = Object.fromEntries((stats ?? []).map(s => [s.id, s]))

  const statsActual = statsMap[partida.siguiente_jugador_id]
  const faltaPersonalId = partida.modalidad === 'bola8'
    ? (statsActual?.falta_frecuente_bola8_id ?? null)
    : (statsActual?.falta_frecuente_bola9_id ?? null)

  function buildEquipo(ids) {
    return ids.map(jid => ({
      id:     jid,
      nombre: jugadores.find(j => j.id === jid)?.nombre ?? `#${jid}`,
      racha:  statsMap[jid]?.racha_actual ?? 0,
    }))
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleBack() {
    if (bolas.length > 0) { setConfirmarSalir(true); return }
    navigate(-1)
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
      const res = await api.registrarTurno(id, {
        jugador_id:   partida.siguiente_jugador_id,
        bolas_metidas: bolas,
        falta_id:     faltaEfectivaId,
        falta_ids:    todasFaltasIds,
        bola_en_mano: partida.bola_en_mano,
      })
      setBolas([])
      setFaltasIds(new Set())
      setFaltasAutoIds(new Set())
      navigator.vibrate?.(30)   // feedback háptico al confirmar turno (móvil en mano)
      await reload()
      toastLogrosNuevos(res?.logros_nuevos)   // fuente única — backend devuelve el delta
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

  // Borrado diferido con ventana de deshacer (5s). No deja loose ends:
  // si el componente se desmonta con borrado pendiente, se confirma igualmente.
  function eliminar() {
    setConfirmarBorrar(false)
    const timer = setTimeout(commitBorrado, 5000)
    pendingDelRef.current = { timer }
    setBorrando(true)
  }

  function commitBorrado() {
    const pd = pendingDelRef.current
    if (!pd) return
    clearTimeout(pd.timer)
    pendingDelRef.current = null
    api.eliminarPartida(id)
      .then(() => navigate(partida?.torneo_id ? `/torneo/${partida.torneo_id}` : '/'))
      .catch(err => { setBorrando(false); setFlash({ texto: err.message, tipo: 'error' }) })
  }

  function deshacerBorrado() {
    const pd = pendingDelRef.current
    if (pd) clearTimeout(pd.timer)
    pendingDelRef.current = null
    setBorrando(false)
  }

  function revancha() {
    navigate('/nueva', {
      state: {
        modalidad: partida.modalidad,
        equipo1:   partida.equipo1_jugadores,
        equipo2:   partida.equipo2_jugadores,
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
      if (fechaEdit)    datos.fecha     = fechaEdit       // ya es hora local, no convertir a UTC
      if (fechaFinEdit) datos.fecha_fin = fechaFinEdit
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleBack}
            style={{
              background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: '20px', lineHeight: 1, flexShrink: 0,
              borderRadius: 6, transition: 'color .15s',
            }}
            title="Volver a partidas"
          >‹</button>
          <h2 style={{ fontSize: '17px', fontWeight: 700, whiteSpace: 'nowrap', margin: 0 }}>
            {partida.modalidad === 'bola8' ? 'Bola 8' : 'Bola 9'}
            <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> · #{partida?.numero ?? id}</span>
          </h2>
        </div>

        {/* Chip torneo — centro */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {partida.torneo_id && (
            <button
              onClick={() => navigate(`/torneo/${partida.torneo_id}`)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                background: 'rgba(234,179,8,.1)', border: '1px solid rgba(234,179,8,.3)',
                color: '#fbbf24', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🏆 {partida.torneo_nombre ? `Ir a ${partida.torneo_nombre}` : 'Ir al torneo'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0, marginLeft: 8 }}>
          <span className={`badge ${finalizada ? 'badge-fin' : 'badge-curso'}`}>
            {finalizada ? 'Finalizada' : 'En curso'}
          </span>
          {!finalizada && duracionActiva && (
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
              ⏱ {duracionActiva}
            </span>
          )}
        </div>
        <button
          onClick={() => setMenuAbierto(v => !v)}
          title="Más opciones"
          style={{
            background: menuAbierto ? 'var(--surface2)' : 'none', border: 'none', cursor: 'pointer',
            color: menuAbierto ? 'var(--text)' : 'var(--text-dim)', fontSize: '22px', lineHeight: 1,
            padding: '2px 8px', borderRadius: 8, flexShrink: 0,
          }}
        >⋯</button>
      </div>

      {/* Menú de administración (⋯) */}
      {menuAbierto && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6 }}>
          <button
            className="btn btn-ghost btn-full"
            onClick={() => { abrirEditarTiempos(); setMenuAbierto(false) }}
            style={{ color: 'var(--text-dim)', fontSize: '13px', justifyContent: 'flex-start' }}
          >✎ Editar tiempos</button>
          <button
            className="btn btn-ghost btn-full"
            onClick={() => { setEditandoTurnos(v => !v); setMenuAbierto(false) }}
            style={{
              fontSize: '13px', justifyContent: 'flex-start',
              color: editandoTurnos ? 'var(--accent)' : 'var(--text-dim)',
            }}
          >{editandoTurnos ? '✓ Terminar edición de turnos' : '✎ Editar turnos'}</button>
          <button
            className="btn btn-ghost btn-full"
            onClick={() => { setConfirmarBorrar(true); setMenuAbierto(false) }}
            style={{ color: 'rgba(239,68,68,.65)', fontSize: '13px', justifyContent: 'flex-start' }}
          >❌ Eliminar partida</button>
        </div>
      )}

      {/* Editar tiempos (expandido) */}
      {editandoTiempos && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)' }}>
            Editar tiempos
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Inicio</span>
              <input type="datetime-local" value={fechaEdit} onChange={e => setFechaEdit(e.target.value)} style={{ fontSize: '14px' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Fin</span>
              <input type="datetime-local" value={fechaFinEdit} onChange={e => setFechaFinEdit(e.target.value)} style={{ fontSize: '14px' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-full" onClick={guardarTiempos} disabled={guardandoTiempos}>
              {guardandoTiempos ? 'Guardando…' : 'Guardar'}
            </button>
            <button className="btn btn-ghost btn-full" onClick={() => setEditandoTiempos(false)} disabled={guardandoTiempos}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Eliminar partida (confirmación) */}
      {confirmarBorrar && !borrando && (
        <div className="card" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-danger" onClick={eliminar} style={{ flex: 1 }}>Confirmar borrado</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmarBorrar(false)}>Cancelar</button>
        </div>
      )}

      {/* Borrado diferido — barra de deshacer (5s) */}
      {borrando && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, width: '90%', maxWidth: 380,
          background: 'rgba(127,29,29,.96)', borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
          animation: 'slideUp .2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
            <span style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: 600 }}>
              🗑 Partida eliminada
            </span>
            <button
              onClick={deshacerBorrado}
              style={{
                background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)',
                color: '#fff', fontSize: 13, fontWeight: 700, padding: '6px 14px',
                borderRadius: 8, cursor: 'pointer', flexShrink: 0,
              }}
            >↩ Deshacer</button>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,.5)', animation: 'timerShrink 5s linear forwards' }} />
        </div>
      )}
      {finalizada && flash?.tipo === 'error' && !confirmarBorrar && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}>
          {flash.texto}
        </div>
      )}

      {/* Confirmar salida */}
      {confirmarSalir && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
          <p style={{ flex: 1, fontSize: 13, margin: 0 }}>¿Salir? Perderás las bolas seleccionadas.</p>
          <button className="btn btn-danger" onClick={() => navigate(-1)} style={{ flexShrink: 0 }}>Salir</button>
          <button className="btn btn-ghost" onClick={() => setConfirmarSalir(false)} style={{ flexShrink: 0 }}>Cancelar</button>
        </div>
      )}

      {/* Estado de equipos */}
      <div style={{ display: 'flex', gap: 8 }}>
        <BolasEquipo
          titulo={partida.equipo1_nombre || 'Equipo 1'} teamNum={1}
          pendientes={pendientesEq1}
          grupo={partida.equipo1_grupo}
          esActivo={!finalizada && equipoActual === 1}
          ganador={finalizada && partida.ganador_equipo === 1}
          jugadoresEquipo={buildEquipo(partida.equipo1_jugadores)}
          siguienteJugadorId={partida.siguiente_jugador_id}
          modalidad={partida.modalidad}
          bolaMano={!finalizada && partida.bola_en_mano && equipoActual === 1}
        />
        <BolasEquipo
          titulo={partida.equipo2_nombre || 'Equipo 2'} teamNum={2}
          pendientes={pendientesEq2}
          grupo={partida.equipo2_grupo}
          esActivo={!finalizada && equipoActual === 2}
          ganador={finalizada && partida.ganador_equipo === 2}
          jugadoresEquipo={buildEquipo(partida.equipo2_jugadores)}
          siguienteJugadorId={partida.siguiente_jugador_id}
          modalidad={partida.modalidad}
          bolaMano={!finalizada && partida.bola_en_mano && equipoActual === 2}
        />
      </div>

      {/* Banner de resultado */}
      {finalizada && (
        <>
          <ResultadoBanner
            partida={partida}
            turnos={turnos}
            jugadores={jugadores}
            onRevancha={revancha}
            onRepetir={repetir}
            torneoId={partida.torneo_id}
            logrosPartida={logrosPartida}
          />
          {partida.torneo_id && (
            <button
              onClick={() => navigate(`/torneo/${partida.torneo_id}`)}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10,
                background: 'rgba(234,179,8,.1)', border: '1px solid rgba(234,179,8,.3)',
                color: '#fbbf24', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              🏆 {partida.torneo_nombre ? `Ir a ${partida.torneo_nombre}` : 'Ir al torneo'}
            </button>
          )}
        </>
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
          faltaPersonalId={faltaPersonalId}
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
        partida={partida}
        onReload={reload}
        modoEdicion={editandoTurnos}
      />

    </div>
  )
}
