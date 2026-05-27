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
