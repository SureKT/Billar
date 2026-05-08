import { BolaPool } from '../Bola'

const TEAM = {
  1: { color: 'var(--team1)', bg: 'rgba(59,130,246,.09)', border: 'rgba(59,130,246,.38)' },
  2: { color: 'var(--team2)', bg: 'rgba(233,69,96,.09)',  border: 'rgba(233,69,96,.38)'  },
}

/**
 * jugadoresEquipo: [{ id, nombre, racha }]
 *   racha > 0 → racha ganadora   ▲N  (verde)
 *   racha < 0 → racha perdedora  ▼N  (rojo)
 *   racha = 0 → sin racha        (no se muestra)
 */
export default function BolasEquipo({
  titulo, teamNum, pendientes, grupo,
  esActivo, ganador,
  jugadoresEquipo, siguienteJugadorId,
  modalidad,
}) {
  const t = TEAM[teamNum]
  const esBola9 = modalidad === 'bola9'

  return (
    <div style={{
      background: esActivo ? t.bg : 'var(--surface2)',
      border: `1px solid ${esActivo ? t.border : 'var(--border)'}`,
      borderRadius: 10, padding: '8px 10px',
      flex: 1, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* Encabezado: nombre equipo + grupo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.04em', color: esActivo ? t.color : 'var(--text-dim)',
        }}>
          {titulo} {ganador && '🏆'}
        </span>
        {!esBola9 && (grupo
          ? <span className={`badge badge-${grupo}`} style={{ fontSize: '10px', padding: '2px 7px' }}>{grupo.charAt(0).toUpperCase() + grupo.slice(1)}</span>
          : <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>—</span>
        )}
      </div>

      {/* Lista de jugadores con racha */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {jugadoresEquipo.map(j => {
          const esTurno = j.id === siguienteJugadorId && !ganador
          return (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {esTurno && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: t.color, flexShrink: 0,
                }} />
              )}
              <span style={{
                fontSize: '13px',
                fontWeight: esTurno ? 700 : 400,
                color: esTurno ? 'var(--text)' : 'var(--text-dim)',
                paddingLeft: esTurno ? 0 : 9,
              }}>
                {j.nombre}
              </span>
              {j.racha !== 0 && (
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  color: j.racha > 0 ? '#86efac' : '#fca5a5',
                }}>
                  {j.racha > 0 ? `▲${j.racha}` : `▼${Math.abs(j.racha)}`}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Bolas pendientes (solo bola8) */}
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
