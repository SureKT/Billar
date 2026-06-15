// Parseo único de fechas del backend.
//
// Los registros se guardan en UTC: los nuevos con sufijo de zona ("...Z"),
// los antiguos en formato naive — pero el server corre en UTC (Docker), así
// que su hora de pared también es UTC, solo le falta el marcador.
//
// Regla única en toda la app: si la cadena no trae zona, asumir UTC (añadir
// 'Z'). Así `new Date` la interpreta como UTC y `toLocale*` la muestra en la
// hora local del navegador (UTC+2 en España). Sin esto, una fecha UTC naive se
// interpretaría como local → desfase de 2h en displays y en los cronómetros.
export function parseFecha(isoStr) {
  if (!isoStr) return null
  const s = /Z|[+-]\d{2}:\d{2}$/.test(isoStr) ? isoStr : isoStr + 'Z'
  return new Date(s)
}

// Inverso: convierte una cadena de <input type="datetime-local"> (hora local,
// sin zona) a ISO UTC para enviar al backend. Cierra el round-trip de edición
// de tiempos de forma coherente con parseFecha.
export function localInputAUtc(localStr) {
  if (!localStr) return null
  return new Date(localStr).toISOString()  // new Date(local) → instante; toISOString → UTC 'Z'
}
