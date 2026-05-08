import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export function usePartidaData(id) {
  const [partida, setPartida]       = useState(null)
  const [estado, setEstado]         = useState(null)
  const [turnos, setTurnos]         = useState([])
  const [jugadores, setJugadores]   = useState([])
  const [faltas, setFaltas]         = useState([])
  const [stats, setStats]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [ultimoReload, setUltimoReload] = useState(null)

  const reload = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const [p, t, j, f, s] = await Promise.all([
        api.getPartida(id),
        api.getTurnos(id),
        api.getJugadores(),
        api.getFaltas(),
        api.getAllStats(),
      ])
      setPartida(p)
      setTurnos(Array.isArray(t) ? t : [])
      setJugadores(Array.isArray(j) ? j : [])
      setFaltas(Array.isArray(f) ? f : [])
      setStats(Array.isArray(s) ? s : [])
      if (p) {
        const e = await api.getEstadoPartida(id)
        setEstado(e)
      }
      setUltimoReload(new Date())
    } catch (err) {
      console.error('reload error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { reload(true) }, [reload])

  useEffect(() => {
    function onFocus() { reload().catch(console.error) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  // Polling cada 15 s mientras la partida está en curso (multidispositivo)
  useEffect(() => {
    if (!partida || partida.estado !== 'en_curso') return
    const timer = setInterval(() => { reload().catch(() => {}) }, 15_000)
    return () => clearInterval(timer)
  }, [partida?.estado, reload])

  return { partida, estado, turnos, jugadores, faltas, stats, loading, reload, ultimoReload }
}
