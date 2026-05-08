const BASE = '/api'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Error desconocido')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Jugadores
  getJugadores: () => request('GET', '/jugadores'),
  crearJugador: (nombre) => request('POST', '/jugadores', { nombre }),
  editarJugador: (id, nombre) => request('PUT', `/jugadores/${id}`, { nombre }),
  eliminarJugador: (id) => request('DELETE', `/jugadores/${id}`),
  getStatsJugador: (id) => request('GET', `/jugadores/${id}/stats`),
  getAllStats: () => request('GET', '/jugadores/stats'),
  getH2H: (id) => request('GET', `/jugadores/${id}/h2h`),
  getUltimasPartidas: (id) => request('GET', `/jugadores/${id}/ultimas-partidas`),

  // Partidas
  getPartidas: () => request('GET', '/partidas'),
  getPartida: (id) => request('GET', `/partidas/${id}`),
  getEstadoPartida: (id) => request('GET', `/partidas/${id}/estado`),
  crearPartida: (datos) => request('POST', '/partidas', datos),
  eliminarPartida: (id) => request('DELETE', `/partidas/${id}`),
  actualizarTiempos: (id, datos) => request('PATCH', `/partidas/${id}/tiempos`, datos),

  // Turnos
  getTurnos: (partidaId) => request('GET', `/partidas/${partidaId}/turnos`),
  registrarTurno: (partidaId, datos) => request('POST', `/partidas/${partidaId}/turnos`, datos),
  deshacerUltimoTurno: (partidaId) => request('DELETE', `/partidas/${partidaId}/turnos/ultimo`),

  // Catálogos
  getBolas: () => request('GET', '/bolas'),
  getFaltas: () => request('GET', '/faltas'),
}
