import { Routes, Route } from 'react-router-dom'
import Inicio from './pages/Inicio'
import NuevaPartida from './pages/NuevaPartida'
import Partida from './pages/Partida'
import Jugadores from './pages/Jugadores'
import Estadisticas from './pages/Estadisticas'
import Torneos from './pages/Torneos'
import TorneoDetalle from './pages/TorneoDetalle'
import Nav from './components/Nav'
import ErrorBoundary from './components/ErrorBoundary'
import ToastContainer from './components/Toast'

export default function App() {
  return (
    <>
      <Nav />
      <main style={{ flex: 1, padding: '16px', paddingBottom: '24px' }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/nueva" element={<NuevaPartida />} />
            <Route path="/partida/:id" element={<Partida />} />
            <Route path="/jugadores" element={<Jugadores />} />
            <Route path="/stats" element={<Estadisticas />} />
            <Route path="/torneos" element={<Torneos />} />
            <Route path="/torneo/:id" element={<TorneoDetalle />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <ToastContainer />
    </>
  )
}
