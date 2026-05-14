import { useState, useEffect } from 'react'
import { subscribeToast } from '../utils/toast'

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return subscribeToast(t => {
      setToasts(prev => [...prev, t])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3000)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: 6,
      alignItems: 'center', pointerEvents: 'none', width: '90%', maxWidth: 380,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '10px 18px', borderRadius: 10, width: '100%', textAlign: 'center',
          background: t.type === 'success' ? 'rgba(22,101,52,.96)' : 'rgba(127,29,29,.96)',
          color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.5)',
          animation: 'slideUp .2s ease',
          backdropFilter: 'blur(8px)',
        }}>
          {t.type === 'success' ? '✓ ' : '⚠ '}{t.msg}
        </div>
      ))}
    </div>
  )
}
