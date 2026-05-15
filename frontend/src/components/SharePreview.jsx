import { useRef, useState } from 'react'
import { captureAndShare } from '../utils/compartir'

export default function SharePreview({ open, onClose, filename, children }) {
  const cardRef = useRef(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleShare() {
    if (!cardRef.current || loading) return
    setLoading(true)
    try {
      await captureAndShare(cardRef.current, filename)
    } catch (e) {
      console.error('compartir error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.88)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 16, gap: 14, overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.06em' }}>
        PREVISUALIZACIÓN
      </div>

      {/* Capturable card */}
      <div
        ref={cardRef}
        onClick={e => e.stopPropagation()}
        style={{ borderRadius: 14, overflow: 'hidden', width: '100%', maxWidth: 340, boxShadow: '0 8px 40px rgba(0,0,0,.6)' }}
      >
        {children}
      </div>

      {/* Action buttons */}
      <div
        style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleShare}
          disabled={loading}
          style={{
            flex: 1, padding: '13px', borderRadius: 10,
            background: loading ? '#1d4ed8' : '#2563eb',
            color: '#fff', border: 'none', fontSize: 15, fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? 'Generando...' : '↑ Compartir'}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '13px 18px', borderRadius: 10,
            background: 'rgba(255,255,255,.08)',
            color: '#fff', border: '1px solid rgba(255,255,255,.15)',
            fontSize: 15, cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
