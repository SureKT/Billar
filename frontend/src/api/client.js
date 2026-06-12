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
  getAllStats: (incluirInactivos = false, modalidad = null, desde = null, hasta = null) => {
    const params = new URLSearchParams()
    if (incluirInactivos) params.set('incluir_inactivos', 'true')
    if (modalidad) params.set('modalidad', modalidad)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const qs = params.toString()
    return request('GET', `/jugadores/stats${qs ? `?${qs}` : ''}`)
  },
  getH2H: (id) => request('GET', `/jugadores/${id}/h2h`),
  getUltimasPartidas: (id) => request('GET', `/jugadores/${id}/ultimas-partidas`),
  getTorneosJugador: (id) => request('GET', `/jugadores/${id}/torneos`),
  editarColorJugador: (id, color) => request('PATCH', `/jugadores/${id}/color`, { color }),
  toggleActivoJugador: (id) => request('PATCH', `/jugadores/${id}/activo`),

  // Partidas
  getSugerencias: (jugadoresPorEquipo = 1, modalidad = 'bola8') =>
    request('GET', `/partidas/sugerencias?jugadores_por_equipo=${jugadoresPorEquipo}&modalidad=${modalidad}`),
  getSugerenciaSaque: (jugadorIds) =>
    request('GET', `/partidas/sugerencia-saque?jugadores=${jugadorIds.sort((a, b) => a - b).join(',')}`),
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
  editarTurno: (partidaId, turnoId, datos) => request('POST', `/partidas/${partidaId}/turnos/${turnoId}/editar`, datos),
  eliminarTurno: (partidaId, turnoId) => request('POST', `/partidas/${partidaId}/turnos/${turnoId}/eliminar`),
  insertarTurno: (partidaId, datos) => request('POST', `/partidas/${partidaId}/turnos/insertar`, datos),

  // Catálogos
  getBolas: () => request('GET', '/bolas'),
  getFaltas: (jugadorIds = null, desde = null) => {
    const params = new URLSearchParams()
    if (jugadorIds?.length) params.set('jugadores', jugadorIds.join(','))
    if (desde) params.set('desde', desde)
    const qs = params.toString()
    return request('GET', `/faltas${qs ? `?${qs}` : ''}`)
  },

  // Nombres de equipo
  getNombresEquipo: () => request('GET', '/equipos-nombres'),
  lookupNombreEquipo: (ids) => request('GET', `/equipos-nombres/lookup?jugadores=${ids.sort((a,b)=>a-b).join(',')}`),
  upsertNombreEquipo: (jugadores_ids, nombre) => request('POST', '/equipos-nombres', { jugadores_ids, nombre }),
  eliminarNombreEquipo: (id) => request('DELETE', `/equipos-nombres/${id}`),

  // Torneos
  getTorneos: () => request('GET', '/torneos'),
  getTorneo: (id) => request('GET', `/torneos/${id}`),
  crearTorneo: (datos) => request('POST', '/torneos', datos),
  jugarEnfrentamiento: (torneoId, enfId, primerJugadorId) => request('POST', `/torneos/${torneoId}/enfrentamientos/${enfId}/jugar`, { primer_jugador_id: primerJugadorId ?? null }),
  finalizarTorneo: (id) => request('PATCH', `/torneos/${id}/finalizar`),
  eliminarTorneo: (id, eliminarPartidas = false) => request('DELETE', `/torneos/${id}`, { eliminar_partidas: eliminarPartidas }),

  // Logros
  getLogrosCatalogo: () => request('GET', '/logros/catalogo'),
  getLogrosJugador: (jugadorId) => request('GET', `/logros/${jugadorId}`),
  getLogrosTodos: () => request('GET', '/logros/todos'),
}
