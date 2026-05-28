import { useState } from 'react'

export function useSessionState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  function set(value) {
    setState(prev => {
      const next = typeof value === 'function' ? value(prev) : value
      try { sessionStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
  }

  return [state, set]
}

// Variante para state que es un Set (serializa como array)
export function useSessionSet(key) {
  const [state, setState] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  function set(value) {
    setState(prev => {
      const next = typeof value === 'function' ? value(prev) : value
      try { sessionStorage.setItem(key, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  return [state, set]
}
