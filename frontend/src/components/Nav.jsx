import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useMediaQuery } from '../hooks/useMediaQuery'

const NAV_FULL    = 62  // px — icon container 20 + gap 2 + text 16 + pad 12+10 + border 1 ≈ 61
const NAV_COMPACT = 34  // px — icon container 20 + pad 6+6 + border 1 = 33

const LINKS = [
  { to: '/',          end: true,  icon: '🎱', label: 'Partidas' },
  { to: '/nueva',     end: false, icon: '＋', label: 'Nueva', destacado: true },
  { to: '/stats',     end: false, icon: '📊', label: 'Stats' },
  { to: '/torneos',   end: false, icon: '🏆', label: 'Torneos' },
  { to: '/jugadores', end: false, icon: '👤', label: 'Jugadores' },
  { to: '/logros',    end: false, icon: '🏅', label: 'Logros' },
]

export default function Nav() {
  const desktop = useMediaQuery('(min-width: 1024px)')
  return desktop ? <NavSidebar /> : <NavMovil />
}

// ── Desktop: sidebar lateral fijo ──────────────────────────────────────────────
function NavSidebar() {
  useEffect(() => {
    // Sin barra superior: los sticky de las páginas (top: var(--nav-height)) parten de 0
    document.documentElement.style.setProperty('--nav-height', '0px')
  }, [])

  const linkStyle = (isActive, destacado) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8,
    fontSize: 14, fontWeight: 600,
    color: isActive ? 'var(--accent)' : destacado ? 'var(--text)' : 'var(--text-dim)',
    background: isActive ? 'var(--accent-bg)' : destacado ? 'rgba(6,182,212,.07)' : 'transparent',
    transition: 'background .15s, color .15s',
  })

  const icono = (emoji) => (
    <span style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>{emoji}</span>
  )

  return (
    <nav style={{
      width: 200, flexShrink: 0,
      position: 'sticky', top: 0, height: 'calc(100dvh / var(--zoom, 1))', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '20px 12px',
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', marginBottom: 18 }}>
        <span style={{ fontSize: 20 }}>🎱</span>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.02em' }}>Billar</span>
      </div>
      {LINKS.map(l => (
        <NavLink key={l.to} to={l.to} end={l.end} style={({ isActive }) => linkStyle(isActive, l.destacado)}>
          {icono(l.icon)}
          {l.label}
        </NavLink>
      ))}
      <NavLink to="/reglas" style={({ isActive }) => linkStyle(isActive, false)}>
        {icono('📖')}
        Reglas
      </NavLink>
      <div style={{ flex: 1 }} />
      <NavLink to="/tv" style={({ isActive }) => linkStyle(isActive, false)}>
        {icono('📺')}
        Modo TV
      </NavLink>
    </nav>
  )
}

// ── Móvil: nav horizontal sticky con compactación al scroll ────────────────────
function NavMovil() {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    // sync --nav-height with initial state
    document.documentElement.style.setProperty('--nav-height', `${NAV_FULL}px`)

    let isCompact = false
    const onScroll = () => {
      const y = window.scrollY
      if (!isCompact && y > 60) {
        isCompact = true
        setCompact(true)
        document.documentElement.style.setProperty('--nav-height', `${NAV_COMPACT}px`)
      } else if (isCompact && y < 20) {
        isCompact = false
        setCompact(false)
        document.documentElement.style.setProperty('--nav-height', `${NAV_FULL}px`)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const linkBase = (isActive) => ({
    padding: compact ? '7px 0' : '12px 0 10px',
    flex: 1,
    textAlign: 'center',
    fontWeight: 600,
    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'color .15s, border-color .15s, padding .18s ease',
    letterSpacing: '.02em',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  })

  const textStyle = {
    fontSize: '13px',
    lineHeight: '13px',
    paddingBottom: '4px',          // room for descenders (g, j, y…)
    maxHeight: compact ? 0 : '18px',
    opacity: compact ? 0 : 1,
    overflow: 'hidden',
    transition: 'max-height .18s ease, opacity .15s ease',
    whiteSpace: 'nowrap',
  }

  const iconStyle = (size = '16px') => ({
    height: 20,
    display: 'flex',
    alignItems: 'center',
    fontSize: size,
    flexShrink: 0,
  })

  return (
    <nav style={{
      display: 'flex',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      transition: 'padding .3s ease',
    }}>
      <NavLink to="/" end style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle('18px')}>🎱</span>
        <span style={textStyle}>Partidas</span>
      </NavLink>
      <NavLink to="/nueva" style={({ isActive }) => ({
        ...linkBase(isActive),
        color: isActive ? 'var(--accent)' : 'var(--text)',
        background: 'rgba(6,182,212,.07)',
        borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
      })}>
        <span style={{ ...iconStyle('22px'), color: '#4ade80' }}>＋</span>
        <span style={textStyle}>Nueva</span>
      </NavLink>
      <NavLink to="/stats" style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle()}>📊</span>
        <span style={textStyle}>Stats</span>
      </NavLink>
      <NavLink to="/torneos" style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle()}>🏆</span>
        <span style={textStyle}>Torneos</span>
      </NavLink>
      <NavLink to="/jugadores" style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle()}>👤</span>
        <span style={textStyle}>Jugadores</span>
      </NavLink>
      <NavLink to="/logros" style={({ isActive }) => linkBase(isActive)}>
        <span style={iconStyle()}>🏅</span>
        <span style={textStyle}>Logros</span>
      </NavLink>
    </nav>
  )
}
