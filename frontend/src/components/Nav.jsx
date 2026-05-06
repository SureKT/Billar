import { NavLink } from 'react-router-dom'

export default function Nav() {
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
      <NavLink to="/" end style={link}>Partidas</NavLink>
      <NavLink to="/nueva" style={link}>+ Nueva</NavLink>
      <NavLink to="/jugadores" style={link}>Jugadores</NavLink>
    </nav>
  )
}
