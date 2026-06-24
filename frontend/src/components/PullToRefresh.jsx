import { useEffect, useRef, useState } from 'react'

// Pull-to-refresh para móvil/táctil. Al tirar hacia abajo desde el tope de la
// página (scrollY === 0) más allá del umbral y soltar → recarga la página actual.
// Funciona en cualquier ruta porque se monta una sola vez a nivel de App.
const THRESHOLD = 70   // px de tirón (ya amortiguado) para disparar el refresh
const MAX = 110        // tope visual del indicador

export default function PullToRefresh() {
  const [dist, setDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(null)
  const distRef = useRef(0)
  const activo = useRef(false)   // true cuando un gesto cuenta como pull

  useEffect(() => {
    // Solo dispositivos táctiles — en desktop el ratón/scroll no debe activarlo.
    if (!window.matchMedia('(pointer: coarse)').matches) return

    const setD = d => { distRef.current = d; setDist(d) }

    function onStart(e) {
      if (window.scrollY > 0 || refreshing) { startY.current = null; return }
      startY.current = e.touches[0].clientY
      activo.current = false
    }

    function onMove(e) {
      if (startY.current == null || refreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || window.scrollY > 0) {   // tira hacia arriba o ya no está en el tope
        if (activo.current) setD(0)
        activo.current = false
        return
      }
      activo.current = true
      setD(Math.min(dy * 0.5, MAX))          // amortiguación
      e.preventDefault()                     // corta el bounce nativo mientras tiramos
    }

    function onEnd() {
      if (!activo.current) { startY.current = null; return }
      if (distRef.current >= THRESHOLD) {
        setRefreshing(true)
        setD(THRESHOLD)
        window.location.reload()
      } else {
        setD(0)
      }
      startY.current = null
      activo.current = false
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [refreshing])

  const visible = dist > 0 || refreshing
  const listo = dist >= THRESHOLD

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        transform: `translateY(${(refreshing ? THRESHOLD : dist) - 44}px)`,
        opacity: visible ? 1 : 0,
        transition: activo.current ? 'none' : 'transform .2s ease, opacity .2s ease',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'var(--surface2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,.35)',
      }}>
        {refreshing ? (
          <span style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
            animation: 'spin .7s linear infinite', display: 'block',
          }} />
        ) : (
          <span style={{
            fontSize: 16, lineHeight: 1, color: listo ? 'var(--accent)' : 'var(--text-dim)',
            transform: `rotate(${Math.min(dist / THRESHOLD, 1) * 180}deg)`,
            transition: activo.current ? 'none' : 'transform .2s ease, color .15s',
          }}>↓</span>
        )}
      </div>
    </div>
  )
}
