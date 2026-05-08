import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'

const FALTAS_INTERNAS = ['Bola 8 ilegal', 'Tres faltas consecutivas', 'Blanca dentro (Scratch)']

// ─── helpers ─────────────────────────────────────────────────────────────────

function winrate(j) {
  return j.partidas_jugadas > 0 ? j.partidas_ganadas / j.partidas_jugadas : -1
}

function pct(ganadas, jugadas) {
  return jugadas === 0 ? 0 : Math.round((ganadas / jugadas) * 100)
}

// ─── sub-componentes ──────────────────────────────────────────────────────────

function ContadorCard({ label, value, sub, color }) {
  return (
    <div style={{
      flex: 1, background: 'var(--surface2)', borderRadius: 10,
      padding: '12px 8px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <span style={{ fontSize: '22px', fontWeight: 800, color: color ?? 'var(--text)', lineHeight: 1 }}>
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

// ─── ranking ─────────────────────────────────────────────────────────────────

function FilaRanking({ pos, j, esTop }) {
  const p = pct(j.partidas_ganadas, j.partidas_jugadas)
  const barColor = p >= 60 ? '#4ade80' : p >= 40 ? '#fbbf24' : '#f87171'
  const medallas = ['🥇', '🥈', '🥉']

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: esTop ? 'rgba(250,204,21,.06)' : 'transparent',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* posición */}
      <span style={{ width: 22, fontSize: pos <= 3 ? '18px' : '12px', textAlign: 'center', flexShrink: 0,
        color: pos > 3 ? 'var(--text-dim)' : undefined }}>
        {pos <= 3 ? medallas[pos - 1] : pos}
      </span>

      {/* nombre + racha */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: esTop ? '#fcd34d' : 'var(--text)',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {j.nombre}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          {j.partidas_ganadas}G · {j.partidas_jugadas - j.partidas_ganadas}P · {j.partidas_jugadas} partidas
        </span>
      </div>

      {/* barra win-rate */}
      <div style={{ width: 120, flexShrink: 0 }}>
        <BarraWin ganadas={j.partidas_ganadas} jugadas={j.partidas_jugadas} color={barColor} />
      </div>
    </div>
  )
}

// ─── records ─────────────────────────────────────────────────────────────────

function RecordCard({ emoji, titulo, nombre, valor }) {
  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: '22px', flexShrink: 0 }}>{emoji}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-dim)', marginBottom: 2 }}>{titulo}</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
        {valor && <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{valor}</div>}
      </div>
    </div>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function Estadisticas() {
  const { data: stats, loading: loadingStats }  = useApi(api.getAllStats)
  const { data: partidas, loading: loadingPart } = useApi(api.getPartidas)
  const { data: faltas, loading: loadingFaltas } = useApi(api.getFaltas)
  const [filtro, setFiltro] = useState('todas') // 'todas' | 'bola8' | 'bola9'

  if (loadingStats || loadingPart || loadingFaltas) return <div className="spinner" />

  const jugadoresConPartidas = (stats ?? []).filter(j => j.partidas_jugadas > 0)
  const todasPartidas = partidas ?? []
  const finalizadas   = todasPartidas.filter(p => p.estado === 'finalizada')
  const enCurso       = todasPartidas.filter(p => p.estado === 'en_curso')
  const bola8         = todasPartidas.filter(p => p.modalidad === 'bola8')
  const bola9         = todasPartidas.filter(p => p.modalidad === 'bola9')

  // Cifras globales
  const totalBolasMetidas = (stats ?? []).reduce((s, j) => s + j.bolas_metidas, 0)

  // Ranking según filtro (solo partidas que coinciden con la modalidad)
  // Nota: los stats del backend son globales — para el filtro usamos la relación
  // jugadores ↔ partidas que conocemos de `partidas`. Construimos ganadas/jugadas
  // por modalidad a partir de la lista de partidas finalizadas.
  const rankingFiltrado = (() => {
    if (filtro === 'todas') {
      return [...jugadoresConPartidas].sort((a, b) => winrate(b) - winrate(a) || b.partidas_jugadas - a.partidas_jugadas)
    }
    // filtro por modalidad: construir stats parciales
    const rel = finalizadas
      .filter(p => p.modalidad === filtro)
      .flatMap(p => {
        const ganador = p.ganador_equipo
        return [
          ...p.equipo1_jugadores.map(id => ({ id, gano: ganador === 1 })),
          ...p.equipo2_jugadores.map(id => ({ id, gano: ganador === 2 })),
        ]
      })
    const mapa = {}
    for (const { id, gano } of rel) {
      if (!mapa[id]) mapa[id] = { jugadas: 0, ganadas: 0 }
      mapa[id].jugadas++
      if (gano) mapa[id].ganadas++
    }
    return Object.entries(mapa)
      .map(([id, v]) => {
        const j = (stats ?? []).find(s => s.id === Number(id))
        return j ? { ...j, partidas_jugadas: v.jugadas, partidas_ganadas: v.ganadas } : null
      })
      .filter(Boolean)
      .sort((a, b) => winrate(b) - winrate(a) || b.partidas_jugadas - a.partidas_jugadas)
  })()

  // Duración media de partidas finalizadas con fecha_fin
  const conDuracion = finalizadas.filter(p => p.fecha_fin)
  const duracionMediaMin = conDuracion.length > 0
    ? Math.round(conDuracion.reduce((s, p) => s + (new Date(p.fecha_fin) - new Date(p.fecha)), 0) / conDuracion.length / 60_000)
    : null

  // Faltas más frecuentes (excluir internas)
  const faltasOrdenadas = (faltas ?? [])
    .filter(f => !FALTAS_INTERNAS.includes(f.nombre) && f.frecuencia > 0)
    .sort((a, b) => b.frecuencia - a.frecuencia)
    .slice(0, 5)

  // Records globales
  const mejorWinRate = [...jugadoresConPartidas].sort((a, b) => winrate(b) - winrate(a))[0]
  const masBolas     = [...(stats ?? [])].sort((a, b) => b.bolas_metidas - a.bolas_metidas)[0]
  const rachaPos     = [...jugadoresConPartidas].filter(j => j.racha_actual > 0).sort((a, b) => b.racha_actual - a.racha_actual)[0]

  const sinDatos = todasPartidas.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h2 style={{ fontSize: '20px' }}>Estadísticas</h2>

      {sinDatos ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: 12 }}>📊</div>
          <p style={{ color: 'var(--text-dim)' }}>Aún no hay partidas registradas</p>
        </div>
      ) : (
        <>
          {/* ── Cifras globales ── */}
          <div className="card" style={{ padding: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 10 }}>
              Resumen global
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <ContadorCard label="Partidas" value={todasPartidas.length} />
              <ContadorCard label="Finalizadas" value={finalizadas.length} color="#86efac" />
              <ContadorCard label="En curso"  value={enCurso.length}  color="#fbbf24" />
              <ContadorCard label="Bolas" value={totalBolasMetidas} color="#93c5fd" />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <ContadorCard label="Bola 8" value={bola8.length}
                sub={`${Math.round((bola8.length / todasPartidas.length) * 100)}%`} />
              <ContadorCard label="Bola 9" value={bola9.length}
                sub={`${Math.round((bola9.length / todasPartidas.length) * 100)}%`} />
              <ContadorCard label="Jugadores" value={(stats ?? []).length} />
              {duracionMediaMin != null
                ? <ContadorCard label="Duración media" value={`${duracionMediaMin}′`} color="#c4b5fd" />
                : <ContadorCard label="Con partidas" value={jugadoresConPartidas.length} />}
            </div>
          </div>

          {/* ── Records ── */}
          {(mejorWinRate || masBolas || rachaPos) && (
            <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 2 }}>
                Récords
              </p>
              {mejorWinRate && mejorWinRate.partidas_jugadas >= 2 && (
                <RecordCard
                  emoji="🏆" titulo="Mejor win rate"
                  nombre={mejorWinRate.nombre}
                  valor={`${pct(mejorWinRate.partidas_ganadas, mejorWinRate.partidas_jugadas)}% (${mejorWinRate.partidas_ganadas}/${mejorWinRate.partidas_jugadas})`}
                />
              )}
              {masBolas && masBolas.bolas_metidas > 0 && (
                <RecordCard
                  emoji="🎱" titulo="Más bolas metidas"
                  nombre={masBolas.nombre}
                  valor={`${masBolas.bolas_metidas} bolas · ${masBolas.bolas_por_turno} x turno`}
                />
              )}
              {rachaPos && (
                <RecordCard
                  emoji="🔥" titulo="Racha ganadora actual"
                  nombre={rachaPos.nombre}
                  valor={`${rachaPos.racha_actual} seguidas`}
                />
              )}
            </div>
          )}

          {/* ── Faltas más frecuentes ── */}
          {faltasOrdenadas.length > 0 && (
            <div className="card" style={{ padding: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.06em', color: 'var(--text-dim)', marginBottom: 10 }}>
                Faltas más frecuentes
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {faltasOrdenadas.map((f, i) => {
                  const max = faltasOrdenadas[0].frecuencia
                  const p = Math.round((f.frecuencia / max) * 100)
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 14, fontSize: '12px', color: 'var(--text-dim)', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
                      <div style={{ width: 80, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', width: `${p}%`, background: '#f97316', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#fb923c', minWidth: 20, textAlign: 'right', flexShrink: 0 }}>{f.frecuencia}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Ranking ── */}
          {jugadoresConPartidas.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Cabecera + filtro */}
              <div style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                <p style={{ fontSize: '13px', fontWeight: 700 }}>Ranking</p>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['todas', 'bola8', 'bola9'].map(f => (
                    <button key={f} onClick={() => setFiltro(f)} style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: '11px', fontWeight: 600,
                      border: filtro === f ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: filtro === f ? 'var(--accent-bg)' : 'var(--surface2)',
                      color: filtro === f ? 'var(--accent)' : 'var(--text-dim)',
                      transition: 'all .15s', cursor: 'pointer',
                    }}>
                      {f === 'todas' ? 'Todas' : f === 'bola8' ? 'B8' : 'B9'}
                    </button>
                  ))}
                </div>
              </div>

              {rankingFiltrado.length === 0 ? (
                <p style={{ padding: '16px 14px', fontSize: '13px', color: 'var(--text-dim)' }}>
                  Sin datos para este filtro
                </p>
              ) : (
                rankingFiltrado.map((j, i) => (
                  <FilaRanking key={j.id} pos={i + 1} j={j} esTop={i === 0} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
