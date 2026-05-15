import { NavLink } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { api } from '../api/client'

export default function Nav() {
  const { data: jugadores } = useApi(api.getJugadores)
  const link = ({ isActive }) => ({
    padding: '12px 0 10px',
    flex: 1,
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: 600,
    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'color .15s, border-color .15s',
    letterSpacing: '.02em',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  })

  return (
    <nav style={{
      display: 'flex',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <NavLink to="/" end style={link}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>⬤</span>
        Partidas
      </NavLink>
      <NavLink to="/nueva" style={({ isActive }) => ({
        ...link({ isActive }),
        color: isActive ? 'var(--accent)' : 'var(--text)',
        background: 'rgba(6,182,212,.07)',
        borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
      })}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>🎱</span>
        Nueva
      </NavLink>
      <NavLink to="/stats" style={link}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>📊</span>
        Stats
      </NavLink>
      <NavLink to="/torneos" style={link}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>🏆</span>
        Torneos
      </NavLink>
      <NavLink to="/jugadores" style={link}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>👤</span>
        Jugadores
      </NavLink>
      <NavLink to="/tv" style={link}>
        <span style={{ fontSize: '16px', lineHeight: 1 }}>📺</span>
        TV
      </NavLink>
    </nav>
  )
}
