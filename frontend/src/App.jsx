import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Inicio from './pages/Inicio'
import NuevaPartida from './pages/NuevaPartida'
import Partida from './pages/Partida'
import Jugadores from './pages/Jugadores'
import Estadisticas from './pages/Estadisticas'
import Torneos from './pages/Torneos'
import TorneoDetalle from './pages/TorneoDetalle'
import TV from './pages/TV'
import Reglas from './pages/Reglas'
import Logros from './pages/Logros'
import Nav from './components/Nav'
import ErrorBoundary from './components/ErrorBoundary'
import ToastContainer from './components/Toast'
import PullToRefresh from './components/PullToRefresh'

// SPA: al cambiar de ruta la ventana conserva el scrollY anterior — la nueva
// página aparecía scrolleada. Resetea al top en cada navegación.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <PullToRefresh />
      <Nav />
      <main style={{ flex: 1, minWidth: 0, padding: '16px', paddingBottom: '24px' }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/nueva" element={<NuevaPartida />} />
            <Route path="/partida/:id" element={<Partida />} />
            <Route path="/jugadores" element={<Jugadores />} />
            <Route path="/stats" element={<Estadisticas />} />
            <Route path="/torneos" element={<Torneos />} />
            <Route path="/torneo/:id" element={<TorneoDetalle />} />
            <Route path="/tv" element={<TV />} />
            <Route path="/reglas" element={<Reglas />} />
            <Route path="/logros" element={<Logros />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <ToastContainer />
    </>
  )
}
