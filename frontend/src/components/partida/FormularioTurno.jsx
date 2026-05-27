import { useState, useRef } from 'react'
import { BolaPool } from '../Bola'
import SelectorBolas from '../SelectorBolas'

const FALTAS_OCULTAS = ['Blanca dentro (Scratch)', 'Bola 8 ilegal', 'Tres faltas consecutivas']
const FALTA_PIN_BOLA9 = 'No toca objetivo legal'

function nombre(id, jugadores) {
  return jugadores.find(j => j.id === id)?.nombre ?? `#${id}`
}

export default function FormularioTurno({
  partida, estado, turnos, jugadores, faltas,
  bolas, setBolas, faltasIds, setFaltasIds, faltasAutoIds,
  faltaPersonalId,
  registrando, flash, onRegistrar, onDeshacer,
}) {
  const [otrasFaltasOpen, setOtrasFaltasOpen] = useState(false)
  const [deshacerConfirm, setDeshacerConfirm] = useState(false)
  const deshacerTimer = useRef(null)

  // ── Valores derivados ────────────────────────────────────────────────────────
  const equipoActual     = partida.equipo1_jugadores.includes(partida.siguiente_jugador_id) ? 1 : 2
  const grupoPropio      = equipoActual === 1 ? partida.equipo1_grupo : partida.equipo2_grupo
  const bolasYaMetidas   = new Set(estado?.bolas_metidas ?? [])
  const bolaObjetivo     = estado?.bola_objetivo ?? null
  const numeroTurno      = turnos.length + 1

  const bolasEnMesa = partida.modalidad === 'bola9'
    ? [1,2,3,4,5,6,7,8,9].filter(n => !bolasYaMetidas.has(n))
    : [1,2,3,4,5,6,7,9,10,11,12,13,14,15].filter(n => !bolasYaMetidas.has(n))

  // Faltas consecutivas del equipo actual
  const equipoIds = equipoActual === 1 ? partida.equipo1_jugadores : partida.equipo2_jugadores
  const turnosEquipo = [...turnos].filter(t => equipoIds.includes(t.jugador_id)).sort((a, b) => b.numero - a.numero)
  let faltasConsecutivas = 0
  for (const t of turnosEquipo) {
    if (t.falta_id) faltasConsecutivas++
    else break
  }

  // Siguiente jugador si no repite (para la pista visual)
  const rivalesIds = equipoActual === 1 ? partida.equipo2_jugadores : partida.equipo1_jugadores
  const siguienteNoRepite = (() => {
    if (!rivalesIds.length) return null
    if (rivalesIds.length === 1) return rivalesIds[0]
    const turnosRival = turnos.filter(t => rivalesIds.includes(t.jugador_id))
    if (!turnosRival.length) return rivalesIds[0]
    const lastId = turnosRival[turnosRival.length - 1].jugador_id
    const idx = rivalesIds.indexOf(lastId)
    return rivalesIds[(idx + 1) % rivalesIds.length]
  })()

  // Faltas manuales ordenadas por frecuencia de la modalidad actual
  const freqKey = partida.modalidad === 'bola9' ? 'frecuencia_bola9' : 'frecuencia_bola8'
  const faltasManuales = (faltas ?? [])
    .filter(f => !FALTAS_OCULTAS.includes(f.nombre))
    .sort((a, b) => {
      // La falta más habitual del jugador actual va primero
      if (faltaPersonalId) {
        if (a.id === faltaPersonalId) return -1
        if (b.id === faltaPersonalId) return 1
      }
      const diff = (b[freqKey] ?? 0) - (a[freqKey] ?? 0)
      if (diff !== 0) return diff
      if (partida.modalidad === 'bola9') {
        if (a.nombre === FALTA_PIN_BOLA9) return -1
        if (b.nombre === FALTA_PIN_BOLA9) return 1
      }
      return 0
    })
  const faltaPrincipal   = faltasManuales[0] ?? null
  const faltasSecundarias = faltasManuales.slice(1)

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleDeshacer() {
    if (!deshacerConfirm) {
      setDeshacerConfirm(true)
      deshacerTimer.current = setTimeout(() => setDeshacerConfirm(false), 3000)
      return
    }
    clearTimeout(deshacerTimer.current)
    setDeshacerConfirm(false)
    onDeshacer()
  }

  function toggleFalta(id) {
    setFaltasIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function renderFaultBtn(f) {
    const sel = faltasIds.has(f.id)
    return (
      <button
        key={f.id}
        onClick={() => toggleFalta(f.id)}
        style={{
          padding: '7px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
          border: sel ? '1.5px solid var(--accent)' : '1px solid var(--border)',
          background: sel ? 'var(--accent-bg)' : 'var(--surface2)',
          color: sel ? 'var(--accent)' : 'var(--text)',
          cursor: 'pointer', transition: 'background .15s, border-color .15s',
        }}
      >
        {f.nombre}
      </button>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="card" style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      ...(partida.bola_en_mano ? {
        boxShadow: '0 0 0 2px rgba(202,138,4,.6), 0 0 14px rgba(202,138,4,.15)',
      } : {}),
    }}>

      {/* Cabecera del turno */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 4 }}>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Turno #{numeroTurno}
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

      {/* Selector de bolas */}
      <div>
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

      {/* Faltas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Badges automáticos e informativos */}
        <div style={{ minHeight: 36, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
          {[...faltasAutoIds].map(fid => (
            <span key={fid} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600,
              background: 'rgba(245,158,11,.14)', border: '1.5px solid rgba(245,158,11,.4)',
              color: '#fbbf24',
            }}>
              ⚡ {faltas.find(f => f.id === fid)?.nombre}
            </span>
          ))}
          {/* Golden Break bola8 */}
          {partida.modalidad === 'bola8' && numeroTurno === 1 && bolas.includes(8) && !bolas.includes(0) && (
            <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 700, background: 'rgba(161,130,3,.25)', border: '1.5px solid #ca8a04', color: '#fcd34d' }}>
              ✦ Golden Break · ¡Victoria!
            </span>
          )}
          {/* Golden Break + scratch bola8 */}
          {partida.modalidad === 'bola8' && numeroTurno === 1 && bolas.includes(8) && bolas.includes(0) && (
            <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 700, background: 'rgba(127,29,29,.5)', border: '1.5px solid #991b1b', color: '#fca5a5' }}>
              ✦ Scratch en el saque con la 8 · Pierde la partida
            </span>
          )}
          {/* Golden Break bola9 */}
          {partida.modalidad === 'bola9' && numeroTurno === 1 && bolas.includes(9) && !bolas.includes(0) && (
            <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 700, background: 'rgba(161,130,3,.25)', border: '1.5px solid #ca8a04', color: '#fcd34d' }}>
              ✦ Golden Break · ¡Victoria!
            </span>
          )}
          {/* Respot 9 */}
          {partida.modalidad === 'bola9' && bolas.includes(9) && bolas.includes(0) && (
            <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: '13px', fontWeight: 600, background: 'rgba(245,158,11,.14)', border: '1.5px solid rgba(245,158,11,.4)', color: '#fbbf24' }}>
              ⚡ La 9 se respotea · bola en mano
            </span>
          )}
        </div>

        {/* Falta principal de la modalidad */}
        {faltaPrincipal && renderFaultBtn(faltaPrincipal)}

        {/* Otras faltas colapsables */}
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
                {faltasSecundarias.map(renderFaultBtn)}
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
          onClick={onRegistrar}
          disabled={registrando}
          style={{ padding: '15px', fontSize: '17px', borderRadius: 10, flex: 1 }}
        >
          {registrando ? 'Registrando…' : '✓ Confirmar turno'}
        </button>
        {turnos.length > 0 && (
          <button
            className={`btn ${deshacerConfirm ? 'btn-danger' : 'btn-ghost'}`}
            onClick={handleDeshacer}
            disabled={registrando}
            title={deshacerConfirm ? 'Toca de nuevo para confirmar' : 'Deshacer último turno'}
            style={{
              padding: '15px 14px', borderRadius: 10,
              fontSize: deshacerConfirm ? '11px' : '18px',
              flexShrink: 0, minWidth: 56,
              transition: 'all .2s',
            }}
          >
            {deshacerConfirm ? '¿Seguro?' : '↩'}
          </button>
        )}
      </div>
    </div>
  )
}
