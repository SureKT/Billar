// Fuente única del criterio de sesión: partidas consecutivas con hueco < 4h
// entre el fin de una y el inicio de la siguiente. Usado por Inicio y Estadísticas.

export const SESION_GAP_MS = 4 * 60 * 60 * 1000

export function agruparPorSesion(partidas) {
  const orden = [...partidas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  const sesiones = []
  let actual = null
  let prevFin = null
  for (const p of orden) {
    const ini = new Date(p.fecha).getTime()
    const fin = p.fecha_fin ? new Date(p.fecha_fin).getTime() : ini
    if (actual && prevFin != null && (ini - prevFin) < SESION_GAP_MS) {
      actual.partidas.push(p)
    } else {
      actual = { clave: `s${p.id}`, partidas: [p] }
      sesiones.push(actual)
    }
    prevFin = fin
  }
  for (const s of sesiones) {
    s.partidas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    s.fechaRef    = s.partidas[0].fecha                       // última partida (display)
    s.fechaInicio = s.partidas[s.partidas.length - 1].fecha   // primera partida (etiqueta hora)
  }
  return sesiones.sort((a, b) => new Date(b.fechaRef) - new Date(a.fechaRef))
}

// Marcador: victorias por jugador dentro de un conjunto de partidas finalizadas.
export function marcadorSesion(partidas, jugadores) {
  const tally = {}
  for (const p of partidas) {
    for (const eq of [1, 2]) {
      const ids = eq === 1 ? p.equipo1_jugadores : p.equipo2_jugadores
      for (const id of ids) {
        if (!tally[id]) tally[id] = { id, victorias: 0, jugadas: 0 }
        tally[id].jugadas += 1
        if (p.ganador_equipo === eq) tally[id].victorias += 1
      }
    }
  }
  return Object.values(tally)
    .map(t => ({ ...t, jugador: jugadores?.find(j => j.id === t.id) }))
    .sort((a, b) => b.victorias - a.victorias || b.jugadas - a.jugadas)
}

export function duracionSesion(partidas) {
  const totalMs = partidas.reduce((acc, p) => {
    if (!p.fecha_fin) return acc
    return acc + (new Date(p.fecha_fin) - new Date(p.fecha))
  }, 0)
  if (totalMs === 0) return null
  const totalMin = Math.floor(totalMs / 60_000)
  if (totalMin < 60) return `${totalMin}'`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}'` : `${h}h`
}
