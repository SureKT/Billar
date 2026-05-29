const listeners = new Set()

// msg: string para tipos 'error'/'success', objeto { quien, emoji, nombre, nivel? } para tipo 'logro'
export function showToast(msg, type = 'error', duration = 3000) {
  const id = Date.now() + Math.random()
  listeners.forEach(fn => fn({ id, msg, type, duration }))
}

export function subscribeToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Pinta los logros recién desbloqueados (formato backend LogroNuevo).
// Fuente única — usado tras registrar turno y tras crear partida.
export function toastLogrosNuevos(lista, duration = 5000) {
  if (!lista?.length) return
  for (const l of lista) {
    const nivelLabel = l.nivel
      ? `${l.nivel_emoji ?? ''} ${l.nivel.charAt(0).toUpperCase() + l.nivel.slice(1)}`.trim()
      : null
    showToast({
      quien: l.jugador_nombre,
      emoji: l.icono,
      nombre: l.nombre,
      nivel: nivelLabel,
      umbral: l.umbral ?? null,
      descripcion: l.descripcion,
    }, 'logro', duration)
  }
}
