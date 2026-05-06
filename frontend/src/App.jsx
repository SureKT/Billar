import { Routes, Route } from 'react-router-dom'
import Inicio from './pages/Inicio'
import NuevaPartida from './pages/NuevaPartida'
import Partida from './pages/Partida'
import Jugadores from './pages/Jugadores'
import Nav from './components/Nav'

export default function App() {
  return (
    <>
      <Nav />
      <main style={{ flex: 1, padding: '16px', paddingBottom: '24px' }}>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/nueva" element={<NuevaPartida />} />
          <Route path="/partida/:id" element={<Partida />} />
          <Route path="/jugadores" element={<Jugadores />} />
        </Routes>
      </main>
    </>
  )
}
