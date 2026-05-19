import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'
import { SkeletonList } from '../components/Skeleton'

const FALTAS_INTERNAS = ['Bola 8 ilegal', 'Tres faltas consecutivas', 'Blanca dentro (Scratch)']

// ─── helpers ─────────────────────────────────────────────────────────────────

function winrate(j) {
  return j.partidas_jugadas > 0 ? j.partidas_ganadas / j.partidas_jugadas : -1
}

function pct(ganadas, jugadas) {
  return jugadas === 0 ? 0 : Math.round((ganadas / jugadas) * 100)
}

// ─── sub-componentes ──────────────────────────────────────────────────────────

function ContadorCard({ label, value, sub, color, compact }) {
  return (
    <div style={{
      flex: 1, background: 'var(--surface2)', borderRadius: 10,
      padding: '12px 8px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      minWidth: 0,
    }}>
      <span style={{
        fontSize: compact ? '15px' : '22px', fontWeight: 800,
        color: color ?? 'var(--text)', lineHeight: 1,
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
      {sub != null && (
        <span style={{ fontSize: '10px', color: color ? `${color}99` : 'var(--accent)', fontWeight: 600, lineHeight: 1 }}>
          {sub}
        </span>
      )}
      <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', marginTop: 1 }}>
        {label}
      </span>
    </div>
  )
}

// Gráfica de barras horizontal
// labelAbove=true → etiqueta encima de la barra (para textos largos)
function GraficaHorizontal({ datos, color, labelWidth = 80, labelAbove = false }) {
  // datos: [{ label, value, sub?, playerColor? }]
  const max = Math.max(...datos.map(d => d.value), 1)

  if (labelAbove) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {datos.map((d, i) => {
          const p = Math.round((d.value / max) * 100)
          const barColor = d.playerColor ?? (typeof color === 'function' ? color(d, i) : color)
          return (
            <div key={d.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{d.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: barColor, flexShrink: 0, marginLeft: 8 }}>
                  {d.value}{d.sub ? ` · ${d.sub}` : ''}
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${p}%`, background: barColor, borderRadius: 5, transition: 'width .5s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {datos.map((d, i) => {
        const p = Math.round((d.value / max) * 100)
        const barColor = d.playerColor ?? (typeof color === 'function' ? color(d, i) : color)
        return (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: labelWidth, fontSize: '12px', color: 'var(--text-dim)',
              textAlign: 'right', flexShrink: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {d.label}
            </span>
            <div style={{ flex: 1, height: 22, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', width: `${p}%`, background: barColor,
                borderRadius: 5, transition: 'width .5s ease',
                display: 'flex', alignItems: 'center',
              }}>
                {p >= 20 && (
                  <span style={{ paddingLeft: 8, fontSize: '12px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                    {d.value}{d.sub ? ` · ${d.sub}` : ''}
                  </span>
                )}
              </div>
              {p < 20 && d.value > 0 && (
                <span style={{
                  position: 'absolute', left: `${p + 2}%`, top: '50%', transform: 'translateY(-50%)',
                  fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', whiteSpace: 'nowrap',
                }}>
                  {d.value}{d.sub ? ` · ${d.sub}` : ''}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Gráfica de barras verticales (para evolución temporal)
function GraficaVertical({ datos, altura = 80 }) {
  // datos: [{ label, wins, losses }]
  const maxTotal = Math.max(...datos.map(d => d.wins + d.losses), 1)
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: altura + 24 }}>
      {datos.map((d, i) => {
        const total  = d.wins + d.losses
        const hWins  = Math.round((d.wins   / maxTotal) * altura)
        const hLoss  = Math.round((d.losses / maxTotal) * altura)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: altura, width: '100%', gap: 1 }}>
              {d.wins > 0 && (
                <div style={{ height: hWins, background: '#16a34a', borderRadius: '3px 3px 0 0', opacity: .85 }} />
              )}
              {d.losses > 0 && (
                <div style={{ height: hLoss, background: 'var(--team2)', borderRadius: d.wins === 0 ? '3px 3px 0 0' : 0, opacity: .75 }} />
              )}
            </div>
            <span style={{ fontSize: '9px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BarraWin({ ganadas, jugadas, color }) {
  const p = pct(ganadas, jugadas)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 3, transition: 'width .4s ease' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{p}%</span>
    </div>
  )
}

function FilaRanking({ pos, j, esTop, forma = [] }) {
  const p = pct(j.partidas_ganadas, j.partidas_jugadas)
  const barColor = p >= 60 ? '#4ade80' : p >= 40 ? '#fbbf24' : '#f87171'
  const medallas = ['🥇', '🥈', '🥉']
  const recent = forma.slice(-5)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: esTop ? 'rgba(250,204,21,.06)' : 'transparent',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ width: 22, fontSize: pos <= 3 ? '18px' : '12px', textAlign: 'center', flexShrink: 0,
        color: pos > 3 ? 'var(--text-dim)' : undefined }}>
        {pos <= 3 ? medallas[pos - 1] : pos}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: esTop ? '#fcd34d' : 'var(--text)',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {j.nombre}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            {j.partidas_ganadas}W · {j.partidas_jugadas - j.partidas_ganadas}L
          </span>
          {recent.length > 0 && (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {recent.map((r, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: r === 'W' ? '#4ade80' : '#f87171',
                  opacity: 0.5 + (i / recent.length) * 0.5,
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ width: 100, flexShrink: 0 }}>
        <BarraWin ganadas={j.partidas_ganadas} jugadas={j.partidas_jugadas} color={barColor} />
      </div>
    </div>
  )
}

function RecordCard({ emoji, titulo, nombre, valor }) {
  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: '22px', flexShrink: 0 }}>{emoji}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', marginBottom: 2 }}>{titulo}</div>
        <div style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
        {valor && <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{valor}</div>}
      </div>
    </div>
  )
}

function SeccionTitulo({ children }) {
  return (
    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 10 }}>
      {children}
    </p>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function Estadisticas() {
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState('todas')
  const modalidadParam = filtro === 'todas' ? null : filtro
  const { data: stats,   loading: loadingStats }  = useApi(() => api.getAllStats(false, modalidadParam), [filtro])
  const { data: partidas, loading: loadingPart }  = useApi(api.getPartidas)
  const { data: faltas,  loading: loadingFaltas } = useApi(api.getFaltas)

  if ((loadingPart || loadingFaltas) && !partidas) return <SkeletonList n={5} />

  const jugadoresConPartidas = (stats ?? []).filter(j => j.partidas_jugadas > 0)
  const activeIds = new Set((stats ?? []).map(j => j.id))
  const todasPartidas = (partidas ?? []).filter(p =>
    [...(p.equipo1_jugadores ?? []), ...(p.equipo2_jugadores ?? [])].some(id => activeIds.has(id))
  )
  const finalizadas   = todasPartidas.filter(p => p.estado === 'finalizada')
  const enCurso       = todasPartidas.filter(p => p.estado === 'en_curso')
  const bola8         = todasPartidas.filter(p => p.modalidad === 'bola8')
  const bola9         = todasPartidas.filter(p => p.modalidad === 'bola9')

  const totalBolasMetidas = (stats ?? []).reduce((s, j) => s + j.bolas_metidas, 0)
  const faltaField = filtro === 'bola8' ? 'frecuencia_bola8' : filtro === 'bola9' ? 'frecuencia_bola9' : 'frecuencia'
  const totalFaltas = (faltas ?? []).reduce((s, f) => s + (f[faltaField] ?? 0), 0)

  // Partidas filtradas por modalidad (para counts y records)
  const finalizadasFiltradas = filtro === 'todas' ? finalizadas : finalizadas.filter(p => p.modalidad === filtro)
  const todasFiltradas       = filtro === 'todas' ? todasPartidas : todasPartidas.filter(p => p.modalidad === filtro)
  const enCursoFiltradas     = filtro === 'todas' ? enCurso : enCurso.filter(p => p.modalidad === filtro)

  const rankingFiltrado = [...jugadoresConPartidas].sort((a, b) => winrate(b) - winrate(a) || b.partidas_jugadas - a.partidas_jugadas)

  // Duración media (filtrada)
  const conDuracion = finalizadasFiltradas.filter(p => p.fecha_fin)
  const duracionMedia = (() => {
    if (conDuracion.length === 0) return null
    const ms = conDuracion.reduce((s, p) => s + (new Date(p.fecha_fin) - new Date(p.fecha)), 0) / conDuracion.length
    const min = Math.floor(ms / 60_000)
    const seg = Math.floor((ms % 60_000) / 1_000)
    return { str: `${min}' ${String(seg).padStart(2, '0')}"` }
  })()

  const faltasPorPartida = finalizadasFiltradas.length > 0
    ? (totalFaltas / finalizadasFiltradas.length).toFixed(1) : null

  // Faltas más frecuentes (filtradas por modalidad)
  const faltasOrdenadas = (faltas ?? [])
    .filter(f => !FALTAS_INTERNAS.includes(f.nombre) && (f[faltaField] ?? 0) > 0)
    .sort((a, b) => (b[faltaField] ?? 0) - (a[faltaField] ?? 0))
    .slice(0, 6)

  // Records
  const mejorWinRate = [...jugadoresConPartidas].sort((a, b) => winrate(b) - winrate(a))[0]
  const masBolas     = [...jugadoresConPartidas].sort((a, b) => b.bolas_metidas - a.bolas_metidas)[0]
  const rachaPos     = [...jugadoresConPartidas].filter(j => j.racha_actual > 0).sort((a, b) => b.racha_actual - a.racha_actual)[0]
  const masEficiente = [...jugadoresConPartidas].filter(j => j.bolas_por_turno > 0).sort((a, b) => b.bolas_por_turno - a.bolas_por_turno)[0]

  // Duration helpers
  function nombresPartida(p) {
    return [...(p.equipo1_jugadores ?? []), ...(p.equipo2_jugadores ?? [])]
      .map(id => (stats ?? []).find(s => s.id === id)?.nombre ?? `J${id}`)
      .join(' · ')
  }
  function durMs(p) { return new Date(p.fecha_fin) - new Date(p.fecha) }
  function fmtMin(ms) {
    const m = Math.floor(ms / 60_000), s = Math.floor((ms % 60_000) / 1_000)
    return `${m}' ${String(s).padStart(2,'0')}"`
  }

  const rachaHistorica = [...jugadoresConPartidas].filter(j => j.racha_mejor > 1).sort((a,b) => b.racha_mejor - a.racha_mejor)[0]
  const conDur = conDuracion  // already filtered
  const masRapida = conDur.length > 0 ? conDur.reduce((m,p) => durMs(p) < durMs(m) ? p : m) : null
  const masLenta  = conDur.length > 0 ? conDur.reduce((m,p) => durMs(p) > durMs(m) ? p : m) : null

  // Datos para gráficas
  const COLORES_FALLBACK = ['#3b82f6','#06b6d4','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16']

  const grafBolas = [...jugadoresConPartidas]
    .filter(j => j.bolas_metidas > 0)
    .sort((a, b) => b.bolas_metidas - a.bolas_metidas)
    .slice(0, 8)
    .map((j, i) => ({ label: j.nombre, value: j.bolas_metidas, playerColor: j.color ?? COLORES_FALLBACK[i % COLORES_FALLBACK.length] }))

  const grafEficiencia = [...jugadoresConPartidas]
    .filter(j => j.bolas_por_turno > 0)
    .sort((a, b) => b.bolas_por_turno - a.bolas_por_turno)
    .slice(0, 8)
    .map((j, i) => ({ label: j.nombre, value: j.bolas_por_turno, playerColor: j.color ?? COLORES_FALLBACK[i % COLORES_FALLBACK.length] }))

  const grafDuracion = [...jugadoresConPartidas]
    .filter(j => j.duracion_promedio_min != null)
    .sort((a, b) => b.duracion_promedio_min - a.duracion_promedio_min)
    .slice(0, 8)
    .map((j, i) => ({
      label: j.nombre,
      value: Math.round(j.duracion_promedio_min),
      playerColor: j.color ?? COLORES_FALLBACK[i % COLORES_FALLBACK.length],
    }))

  // Evolución mensual de partidas (últimos 8 meses con actividad)
  const evolucion = (() => {
    if (finalizadasFiltradas.length === 0) return []
    const porMes = {}
    for (const p of finalizadasFiltradas) {
      const d = new Date(p.fecha)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
      if (!porMes[key]) porMes[key] = { label, wins: 0, losses: 0 }
      // wins = veces que ganó el equipo 1 (o alguno) — aquí sólo contamos partidas jugadas
      // usamos wins = partidas finalizadas, losses = 0 para mostrar actividad
      porMes[key].wins += 1
    }
    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([, v]) => v)
  })()

  const formaMap = {}
  for (const p of [...finalizadasFiltradas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))) {
    if (!p.ganador_equipo) continue
    const ganadores = p.ganador_equipo === 1 ? p.equipo1_jugadores : p.equipo2_jugadores
    const perdedores = p.ganador_equipo === 1 ? p.equipo2_jugadores : p.equipo1_jugadores
    for (const id of ganadores) { if (!formaMap[id]) formaMap[id] = []; formaMap[id].push('W') }
    for (const id of perdedores) { if (!formaMap[id]) formaMap[id] = []; formaMap[id].push('L') }
  }

  const sinDatos = todasFiltradas.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{
        position: 'sticky', top: 'var(--nav-height)', zIndex: 50,
        background: 'var(--bg)', padding: '6px 16px 6px', margin: '0 -16px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <h2 style={{ fontSize: '20px', margin: 0, flexShrink: 0 }}>Estadísticas</h2>
        <button
          onClick={() => navigate('/tv')}
          style={{
            padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,.06)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}
        >
          📺 TV
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {['todas', 'bola8', 'bola9'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: '12px', fontWeight: 600,
              border: filtro === f ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: filtro === f ? 'var(--accent-bg)' : 'var(--surface2)',
              color: filtro === f ? 'var(--accent)' : 'var(--text-dim)',
              transition: 'all .15s', cursor: 'pointer',
            }}>
              {f === 'todas' ? 'Todas' : f === 'bola8' ? 'Bola 8' : 'Bola 9'}
            </button>
          ))}
        </div>
      </div>

      {sinDatos ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: 12 }}>📊</div>
          <p style={{ color: 'var(--text-dim)' }}>Aún no hay partidas registradas</p>
        </div>
      ) : (
        <>
          {/* ── Cifras globales ── */}
          <div className="card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <SeccionTitulo style={{ margin: 0 }}>Resumen {filtro === 'todas' ? 'global' : filtro === 'bola8' ? 'Bola 8' : 'Bola 9'}</SeccionTitulo>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
                {(stats ?? []).length} Jugador{(stats ?? []).length !== 1 ? 'es' : ''} activo{(stats ?? []).length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <ContadorCard label="Partidas"    value={todasFiltradas.length} />
              <ContadorCard label="Finalizadas" value={finalizadasFiltradas.length} color="#86efac" />
              <ContadorCard label="En curso"    value={enCursoFiltradas.length}     color="#fbbf24" />
              <ContadorCard label="Jugadores"   value={(stats ?? []).length} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {filtro === 'todas' && (
                <>
                  <ContadorCard label="Bola 8" value={bola8.length}
                    sub={todasPartidas.length > 0 ? `${Math.round((bola8.length / todasPartidas.length) * 100)}%` : undefined} />
                  <ContadorCard label="Bola 9" value={bola9.length}
                    sub={todasPartidas.length > 0 ? `${Math.round((bola9.length / todasPartidas.length) * 100)}%` : undefined} />
                </>
              )}
              {duracionMedia != null
                ? <ContadorCard label="Duración media" value={duracionMedia.str} color="#c4b5fd" compact />
                : null}
              <ContadorCard label="Total faltas" value={totalFaltas} color="#f97316" />
              {faltasPorPartida != null && (
                <ContadorCard label="Faltas / partida" value={faltasPorPartida} color="#fb923c" />
              )}
            </div>
          </div>

          {/* ── Records ── */}
          {(mejorWinRate || masBolas || rachaPos || masEficiente) && (
            <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SeccionTitulo>Récords</SeccionTitulo>
              {mejorWinRate && mejorWinRate.partidas_jugadas >= 2 && (
                <RecordCard emoji="🏆" titulo="Mejor win rate"
                  nombre={mejorWinRate.nombre}
                  valor={`${pct(mejorWinRate.partidas_ganadas, mejorWinRate.partidas_jugadas)}% (${mejorWinRate.partidas_ganadas}/${mejorWinRate.partidas_jugadas})`}
                />
              )}
              {masBolas && masBolas.bolas_metidas > 0 && (
                <RecordCard emoji="🎱" titulo="Más bolas metidas"
                  nombre={masBolas.nombre}
                  valor={`${masBolas.bolas_metidas} bolas · ${masBolas.bolas_por_turno} x turno`}
                />
              )}
              {masEficiente && masEficiente !== masBolas && (
                <RecordCard emoji="⚡" titulo="Más eficiente (bolas/turno)"
                  nombre={masEficiente.nombre}
                  valor={`${masEficiente.bolas_por_turno} bolas por turno`}
                />
              )}
              {rachaPos && (
                <RecordCard emoji="🔥" titulo="Racha ganadora actual"
                  nombre={rachaPos.nombre}
                  valor={`${rachaPos.racha_actual} seguidas`}
                />
              )}
              {rachaHistorica && (
                <RecordCard emoji="📈" titulo="Racha histórica"
                  nombre={rachaHistorica.nombre}
                  valor={`${rachaHistorica.racha_mejor} victorias seguidas`}
                />
              )}
              {masRapida && (
                <RecordCard emoji="⚡" titulo="Partida más rápida"
                  nombre={nombresPartida(masRapida)}
                  valor={fmtMin(durMs(masRapida))}
                />
              )}
              {masLenta && masLenta !== masRapida && (
                <RecordCard emoji="🐢" titulo="Partida más larga"
                  nombre={nombresPartida(masLenta)}
                  valor={fmtMin(durMs(masLenta))}
                />
              )}
            </div>
          )}

          {/* ── Gráfica: bolas metidas ── */}
          {grafBolas.length > 0 && (
            <div className="card" style={{ padding: '12px' }}>
              <SeccionTitulo>Bolas metidas por jugador</SeccionTitulo>
              <GraficaHorizontal datos={grafBolas} />
            </div>
          )}

          {/* ── Gráfica: eficiencia ── */}
          {grafEficiencia.length > 1 && (
            <div className="card" style={{ padding: '12px' }}>
              <SeccionTitulo>Eficiencia · bolas por turno</SeccionTitulo>
              <GraficaHorizontal datos={grafEficiencia} />
            </div>
          )}

          {/* ── Gráfica: duración media por jugador ── */}
          {grafDuracion.length > 1 && (
            <div className="card" style={{ padding: '12px' }}>
              <SeccionTitulo>Duración media por jugador (min)</SeccionTitulo>
              <GraficaHorizontal datos={grafDuracion} />
            </div>
          )}

          {/* ── Faltas más frecuentes ── */}
          {faltasOrdenadas.length > 0 && (
            <div className="card" style={{ padding: '12px' }}>
              <SeccionTitulo>Faltas más frecuentes</SeccionTitulo>
              <GraficaHorizontal
                datos={faltasOrdenadas.map(f => ({ label: f.nombre, value: f[faltaField] ?? 0 }))}
                color={() => '#f97316'}
                labelAbove
              />
            </div>
          )}

          {/* ── Ranking ── */}
          {jugadoresConPartidas.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: '13px', fontWeight: 700 }}>Ranking</p>
              </div>
              {rankingFiltrado.length === 0 ? (
                <p style={{ padding: '16px 14px', fontSize: '13px', color: 'var(--text-dim)' }}>
                  Sin datos para este filtro
                </p>
              ) : (
                rankingFiltrado.map((j, i) => (
                  <FilaRanking key={j.id} pos={i + 1} j={j} esTop={i === 0} forma={formaMap[j.id] ?? []} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
