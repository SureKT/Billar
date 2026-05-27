import { useState, useEffect } from 'react'
import { subscribeToast } from '../utils/toast'

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return subscribeToast(t => {
      setToasts(prev => [...prev, t])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), t.duration ?? 3000)
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
          padding: '10px 18px', borderRadius: 10, width: '100%',
          background: t.type === 'logro'
            ? 'linear-gradient(135deg, rgba(88,28,135,.95) 0%, rgba(120,53,15,.95) 100%)'
            : t.type === 'success' ? 'rgba(22,101,52,.96)' : 'rgba(127,29,29,.96)',
          border: t.type === 'logro' ? '1px solid rgba(168,85,247,.5)' : 'none',
          color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.5)',
          animation: 'slideUp .2s ease',
          backdropFilter: 'blur(8px)',
          textAlign: t.type === 'logro' ? 'left' : 'center',
        }}>
          {t.type === 'logro' && typeof t.msg === 'object' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{t.msg.emoji}</span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {t.msg.quien} desbloqueó
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.msg.nombre}</div>
                {(t.msg.nivel || t.msg.umbral) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    {t.msg.nivel && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8,
                        background: 'rgba(168,85,247,.3)', color: '#e9d5ff',
                        border: '1px solid rgba(168,85,247,.5)',
                      }}>{t.msg.nivel}</span>
                    )}
                    {t.msg.umbral != null && (
                      <span style={{ fontSize: 11, color: '#d8b4fe', fontWeight: 700 }}>
                        {t.msg.umbral.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                {t.msg.descripcion && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 3, fontWeight: 400 }}>{t.msg.descripcion}</div>
                )}
              </div>
            </div>
          ) : (
            <>{t.type === 'success' ? '✓ ' : '⚠ '}{t.msg}</>
          )}
        </div>
      ))}
    </div>
  )
}
