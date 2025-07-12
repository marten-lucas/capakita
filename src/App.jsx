import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import TopNav from './components/TopNav'
import Daten from './pages/Daten'
import Simulation from './pages/Simulation'
import './App.css'

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width:"100vw" }}>
      <TopNav /> {/* TopNav ist jetzt außerhalb des Containers für volle Breite */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth='l'> {/* Der Container ist jetzt nur für den Inhalt */}
          <Routes>
            <Route path="/" element={<Navigate to="/daten" replace />} />
            <Route path="/daten" element={<Daten />} />
            <Route path="/simulation" element={<Simulation />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  )
}
export default App
