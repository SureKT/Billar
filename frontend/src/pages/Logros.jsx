import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useApi } from '../hooks/useApi'
import { useSessionState } from '../hooks/useSessionState'

const NIVEL_STYLE = {
  bronce:  { bg: 'rgba(180,110,60,.2)',  color: '#cd7f32' },
  plata:   { bg: 'rgba(160,170,180,.2)', color: '#a0aab4' },
  oro:     { bg: 'rgba(251,191,36,.2)',  color: '#fbbf24' },
  platino: { bg: 'rgba(139,92,246,.2)',  color: '#a78bfa' },
}
const NIVEL_EMOJI = { bronce: '🥉', plata: '🥈', oro: '🥇', platino: '💎' }

function BarraProgreso({ pct, color, height = 3 }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 4, height, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, pct))}%`,
        background: color ?? 'var(--accent)',
        height: '100%', borderRadius: 4,
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

function NivelBadge({ nivel, desbloqueado }) {
  const { bg, color } = NIVEL_STYLE[nivel]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
      background: desbloqueado ? bg : 'rgba(255,255,255,.04)',
      color: desbloqueado ? color : '#444',
      border: `1px solid ${desbloqueado ? color : '#333'}`,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {NIVEL_EMOJI[nivel]} {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
      {desbloqueado && <span style={{ fontSize: 9 }}>✓</span>}
    </span>
  )
}

function LogroRow({ logro, porcentaje }) {
  const bloqueado = !logro.desbloqueado
  const tieneNiveles = logro.niveles.length > 0
  const progreso = logro.progreso ?? null
  const nd = logro.niveles_desbloqueados ?? []
  const siguienteNivel = tieneNiveles && progreso !== null
    ? logro.niveles.find(n => !nd.includes(n.nivel))
    : null
  const progresoMaxNivel = siguienteNivel?.umbral ?? (tieneNiveles ? logro.niveles.at(-1)?.umbral : null)
  const progressPct = progresoMaxNivel && progreso !== null
    ? (progreso / progresoMaxNivel) * 100
    : null

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', borderRadius: 8,
      background: bloqueado ? '#111' : 'rgba(6,182,212,.06)',
      border: `1px solid ${bloqueado ? '#222' : 'rgba(6,182,212,.25)'}`,
      marginBottom: 6,
      opacity: bloqueado ? 0.45 : 1,
    }}>
      <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0, marginTop: 2 }}>
        {logro.icono}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: bloqueado ? '#64748b' : '#e2e8f0' }}>
            {logro.nombre}
          </span>
          {porcentaje !== undefined && porcentaje !== null && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: bloqueado ? '#475569' : '#06b6d4',
              background: bloqueado ? 'rgba(255,255,255,.03)' : 'rgba(6,182,212,.1)',
              padding: '1px 6px', borderRadius: 10,
              border: `1px solid ${bloqueado ? '#333' : 'rgba(6,182,212,.25)'}`,
            }}>
              {porcentaje}%
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{logro.descripcion}</div>

        {/* Progreso para logros con niveles */}
        {tieneNiveles && progreso !== null && (
          <div style={{ marginTop: 5 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>
              {siguienteNivel ? (
                <>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{progreso}</span>
                  {' / '}{siguienteNivel.umbral} para {NIVEL_EMOJI[siguienteNivel.nivel]} {siguienteNivel.nivel.charAt(0).toUpperCase() + siguienteNivel.nivel.slice(1)}
                </>
              ) : (
                <span style={{ color: '#a78bfa' }}>💎 Nivel máximo ({progreso})</span>
              )}
            </div>
            {progressPct !== null && siguienteNivel && (
              <BarraProgreso
                pct={progressPct}
                color={NIVEL_STYLE[siguienteNivel.nivel].color}
              />
            )}
          </div>
        )}

        {/* Badges de nivel con links a partida */}
        {tieneNiveles && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
            {logro.niveles.map(n => {
              const desbloqueado = nd.includes(n.nivel)
              const pid = logro.niveles_partida_id?.[n.nivel]
              const pnum = logro.niveles_partida_numero?.[n.nivel]
              return (
                <span key={n.nivel} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <NivelBadge nivel={n.nivel} desbloqueado={desbloqueado} />
                  {desbloqueado && pid && (
                    <Link
                      to={`/partida/${pid}`}
                      style={{ fontSize: 10, color: '#475569', textDecoration: 'none', lineHeight: 1 }}
                    >
                      {pnum != null ? `#${pnum}` : '→'}
                    </Link>
                  )}
                </span>
              )
            })}
          </div>
        )}

        {/* Partida de desbloqueo para logros simples */}
        {!bloqueado && !tieneNiveles && logro.partida_id && (
          <Link
            to={`/partida/${logro.partida_id}`}
            style={{ fontSize: 10, color: '#475569', marginTop: 4, display: 'inline-block', textDecoration: 'none' }}
          >
            Partida #{logro.partida_numero} →
          </Link>
        )}
      </div>
      {!bloqueado && !tieneNiveles && (
        <span style={{ color: '#06b6d4', fontSize: 16, alignSelf: 'center', flexShrink: 0 }}>✓</span>
      )}
    </div>
  )
}

function LogroGlobalRow({ logro }) {
  const [expandido, setExpandido] = useState(false)
  const unlocked = logro.jugadores.length > 0

  return (
    <div style={{
      borderRadius: 8,
      background: unlocked ? 'rgba(6,182,212,.06)' : '#111',
      border: `1px solid ${unlocked ? 'rgba(6,182,212,.25)' : '#222'}`,
      marginBottom: 6,
      opacity: unlocked ? 1 : 0.4,
      overflow: 'hidden',
    }}>
      {/* Cabecera — clickable */}
      <div
        onClick={() => unlocked && setExpandido(e => !e)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px',
          cursor: unlocked ? 'pointer' : 'default',
        }}
      >
        <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0, marginTop: 2 }}>
          {logro.icono}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: unlocked ? '#e2e8f0' : '#64748b' }}>
              {logro.nombre}
            </span>
            {unlocked && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#06b6d4',
                background: 'rgba(6,182,212,.1)', padding: '1px 7px', borderRadius: 10,
                border: '1px solid rgba(6,182,212,.25)',
              }}>
                {logro.porcentaje}%
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: unlocked ? 6 : 0 }}>
            {logro.descripcion}
          </div>

          {/* Barra de progreso del % */}
          {unlocked && (
            <BarraProgreso pct={logro.porcentaje} color='var(--accent)' height={3} />
          )}

          {/* Chips de jugadores (siempre visibles en modo colapsado) */}
          {!expandido && logro.jugadores.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
              {logro.jugadores.map(j => (
                <span key={j.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: '#e2e8f0',
                  background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,.1)',
                }}>
                  {j.color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: j.color, flexShrink: 0 }} />}
                  {j.nombre}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Flecha expand */}
        {unlocked && (
          <span style={{ color: '#475569', fontSize: 12, alignSelf: 'center', flexShrink: 0, transition: 'transform 0.2s', transform: expandido ? 'rotate(180deg)' : 'none' }}>
            ▾
          </span>
        )}
      </div>

      {/* Detalle expandido */}
      {expandido && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '8px 12px 10px 50px' }}>
          {logro.jugadores.map(j => {
            const nivelStyle = j.nivel_actual ? NIVEL_STYLE[j.nivel_actual] : null
            return (
              <div key={j.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {j.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: j.color, flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{j.nombre}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {j.progreso !== null && j.progreso !== undefined && (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{j.progreso}</span>
                  )}
                  {nivelStyle && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                      background: nivelStyle.bg, color: nivelStyle.color,
                      border: `1px solid ${nivelStyle.color}`,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      {NIVEL_EMOJI[j.nivel_actual]} {j.nivel_actual.charAt(0).toUpperCase() + j.nivel_actual.slice(1)}
                    </span>
                  )}
                  {j.partida_id && (
                    <Link
                      to={`/partida/${j.partida_id}`}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11, color: '#06b6d4', textDecoration: 'none' }}
                    >
                      Partida #{j.partida_numero} →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Logros() {
  const { data: jugadores } = useApi(api.getJugadores)
  const [jugadorId, setJugadorId] = useSessionState('logros_jugador_id', null)
  const [logros, setLogros] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [globalData, setGlobalData] = useState(null)
  const [cargandoGlobal, setCargandoGlobal] = useState(true)
  const [sortKey, setSortKey] = useSessionState('logros_sort_key', 'rareza')
  const [sortDir, setSortDir] = useSessionState('logros_sort_dir', 'desc')
  const [filtroMod, setFiltroMod] = useSessionState('logros_filtro_mod', 'todas')
  const [filtroDesbloqueo, setFiltroDesbloqueo] = useSessionState('logros_filtro_desbloqueo', 'todos')
  const [filtroOpen, setFiltroOpen] = useState(false)
  const filtroRef = useRef(null)

  // Cerrar dropdown de filtro al hacer click fuera
  useEffect(() => {
    if (!filtroOpen) return
    function handler(e) {
      if (filtroRef.current && !filtroRef.current.contains(e.target)) setFiltroOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filtroOpen])

  // Cargar datos globales al montar (necesarios para orden por rareza en ambas vistas)
  useEffect(() => {
    let cancelled = false
    api.getLogrosTodos()
      .then(data => { if (!cancelled) setGlobalData(data) })
      .catch(() => { if (!cancelled) setGlobalData([]) })
      .finally(() => { if (!cancelled) setCargandoGlobal(false) })
    return () => { cancelled = true }
  }, [])

  // Cargar logros del jugador seleccionado
  useEffect(() => {
    if (!jugadorId) { setLogros(null); return }
    let cancelled = false
    setCargando(true)
    api.getLogrosJugador(jugadorId)
      .then(data => { if (!cancelled) setLogros(data) })
      .catch(() => { if (!cancelled) setLogros(null) })
      .finally(() => { if (!cancelled) setCargando(false) })
    return () => { cancelled = true }
  }, [jugadorId])

  // Mapa de rareza (id → porcentaje) para ordenar
  const rarityMap = useMemo(() => {
    if (!globalData) return {}
    return Object.fromEntries(globalData.map(l => [l.id, l.porcentaje]))
  }, [globalData])

  // Global ordenado por rareza con dirección
  const sortedGlobal = useMemo(() => {
    if (!globalData) return null
    const filtered = filtroMod === 'todas' ? globalData : globalData.filter(l => !l.modalidad || l.modalidad === filtroMod)
    const list = [...filtered].sort((a, b) => a.porcentaje - b.porcentaje)
    return sortDir === 'desc' ? list : list.reverse()
  }, [globalData, sortDir, filtroMod])

  // Logros del jugador con orden configurable
  const sortedLogros = useMemo(() => {
    if (!logros) return null
    const base = filtroMod === 'todas' ? logros : logros.filter(l => !l.modalidad || l.modalidad === filtroMod)
    const baseFiltered = filtroDesbloqueo === 'desbloqueados' ? base.filter(l => l.desbloqueado)
      : filtroDesbloqueo === 'pendientes' ? base.filter(l => !l.desbloqueado)
      : base
    return [...baseFiltered].sort((a, b) => {
      let va, vb
      if (sortKey === 'rareza') {
        va = rarityMap[a.id] ?? 50
        vb = rarityMap[b.id] ?? 50
      } else {
        const acq = l => {
          if (l.partida_numero != null) return l.partida_numero
          if (l.niveles_partida_id && Object.keys(l.niveles_partida_id).length > 0)
            return Math.min(...Object.values(l.niveles_partida_id))
          return Infinity
        }
        va = acq(a)
        vb = acq(b)
      }
      return sortDir === 'desc' ? vb - va : va - vb
    })
  }, [logros, rarityMap, sortKey, sortDir, filtroMod, filtroDesbloqueo])

  const jugadoresActivos = (jugadores ?? []).filter(j => j.activo)
  const desbloqueados = logros ? logros.filter(l => l.desbloqueado).length : null
  const totalLogros = logros?.length ?? globalData?.length ?? 29

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
          🏅 Logros
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
          {jugadorId && desbloqueados !== null
            ? `${desbloqueados} de ${totalLogros} desbloqueados`
            : `${totalLogros} logros`}
        </p>
      </div>

      {/* Selector de jugador */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => setJugadorId(null)}
          style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: jugadorId === null ? 'var(--accent)' : 'var(--surface2)',
            color: jugadorId === null ? '#000' : 'var(--text-dim)',
            border: `1px solid ${jugadorId === null ? 'var(--accent)' : 'var(--border)'}`,
            cursor: 'pointer',
          }}
        >
          Todos
        </button>
        {jugadoresActivos.map(j => (
          <button
            key={j.id}
            onClick={() => setJugadorId(j.id === jugadorId ? null : j.id)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: jugadorId === j.id ? 'var(--accent)' : 'var(--surface2)',
              color: jugadorId === j.id ? '#000' : 'var(--text-dim)',
              border: `1px solid ${jugadorId === j.id ? 'var(--accent)' : 'var(--border)'}`,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            {j.color && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: j.color, flexShrink: 0 }} />
            )}
            {j.nombre}
          </button>
        ))}
      </div>

      {/* Controles — sticky header con dos filas separadas */}
      <div style={{
        position: 'sticky', top: 'var(--nav-height)', zIndex: 50,
        background: 'var(--bg)', padding: '10px 16px 8px', margin: '0 -16px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {/* Fila 1: filtro modalidad + dirección de orden (siempre visible) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div ref={filtroRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setFiltroOpen(o => !o)}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: filtroMod !== 'todas' ? 'rgba(6,182,212,.15)' : 'var(--surface2)',
                color: filtroMod !== 'todas' ? 'var(--accent)' : 'var(--text-dim)',
                border: `1px solid ${filtroMod !== 'todas' ? 'rgba(6,182,212,.4)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {filtroMod === 'todas' ? 'Todas' : filtroMod === 'bola8' ? 'Bola 8' : 'Bola 9'}
              <span style={{ fontSize: 9, opacity: .7, transition: 'transform .15s', display: 'inline-block', transform: filtroOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {filtroOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '6px', display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: '0 4px 16px rgba(0,0,0,.4)',
              }}>
                {[['todas', 'Todas'], ['bola8', 'Bola 8'], ['bola9', 'Bola 9']].map(([val, label]) => (
                  <button key={val} onClick={() => { setFiltroMod(val); setFiltroOpen(false) }} style={{
                    padding: '4px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: filtroMod === val ? 'rgba(6,182,212,.15)' : 'transparent',
                    color: filtroMod === val ? 'var(--accent)' : 'var(--text-dim)',
                    border: `1px solid ${filtroMod === val ? 'rgba(6,182,212,.4)' : 'transparent'}`,
                    whiteSpace: 'nowrap', textAlign: 'left',
                  }}>{label}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} style={{
            padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: 'var(--surface2)', color: 'var(--text-dim)', border: '1px solid var(--border)',
            marginLeft: 'auto',
          }}>
            {sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
        {/* Fila 2: orden y desbloqueo — solo vista individual */}
        {jugadorId !== null && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {[['rareza', '% global'], ['adquisicion', 'Adquisición']].map(([key, label]) => (
              <button key={key} onClick={() => setSortKey(key)} style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: sortKey === key ? 'rgba(6,182,212,.15)' : 'var(--surface2)',
                color: sortKey === key ? 'var(--accent)' : 'var(--text-dim)',
                border: `1px solid ${sortKey === key ? 'rgba(6,182,212,.4)' : 'var(--border)'}`,
              }}>{label}</button>
            ))}
            <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0, margin: '0 2px' }} />
            {[['todos', 'Todos'], ['desbloqueados', '✓'], ['pendientes', '…']].map(([val, label]) => (
              <button key={val} onClick={() => setFiltroDesbloqueo(val)} style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: filtroDesbloqueo === val ? 'rgba(6,182,212,.15)' : 'var(--surface2)',
                color: filtroDesbloqueo === val ? 'var(--accent)' : 'var(--text-dim)',
                border: `1px solid ${filtroDesbloqueo === val ? 'rgba(6,182,212,.4)' : 'var(--border)'}`,
              }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Contenido */}
      {jugadorId === null ? (
        cargandoGlobal || !sortedGlobal ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32, fontSize: 13 }}>
            Calculando…
          </div>
        ) : (
          <div>
            {sortedGlobal.map(logro => <LogroGlobalRow key={logro.id} logro={logro} />)}
          </div>
        )
      ) : (
        cargando || (!sortedLogros && cargandoGlobal) ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32, fontSize: 13 }}>
            Calculando…
          </div>
        ) : !sortedLogros ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32, fontSize: 13 }}>
            Cargando…
          </div>
        ) : (
          <div>
            {sortedLogros.map(logro => <LogroRow key={logro.id} logro={logro} porcentaje={rarityMap[logro.id]} />)}
          </div>
        )
      )}
    </div>
  )
}
