import { useState } from 'react'
import { BolaPool } from '../Bola'

const TEAM_COLOR = {
  1: 'var(--team1)',
  2: 'var(--team2)',
}

export default function HistorialTurnos({ turnos, jugadores, faltas, equipo1Jugadores, equipo2Jugadores }) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <div>
      <button
        className="btn btn-ghost btn-full"
        onClick={() => setMostrar(v => !v)}
        style={{ marginBottom: 8 }}
      >
        {mostrar ? '▲ Ocultar historial' : `▼ Historial (${turnos.length} turnos)`}
      </button>

      {mostrar && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...turnos].reverse().map(t => {
            const esEq1 = equipo1Jugadores.includes(t.jugador_id)
            const tColor = TEAM_COLOR[esEq1 ? 1 : 2]
            const jNombre = jugadores.find(j => j.id === t.jugador_id)?.nombre ?? `#${t.jugador_id}`
            return (
              <div key={t.id} className="card" style={{
                padding: '10px 14px', fontSize: '13px',
                borderLeft: `3px solid ${tColor}`,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: (t.bolas_metidas?.length ?? 0) > 0 ? 8 : 0,
                }}>
                  <span style={{ fontWeight: 700, color: tColor }}>
                    <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>#{t.numero} </span>
                    {jNombre}
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
  )
}
