import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Container } from '@mui/material'
import TopNav from './components/TopNav'
import SimDatenPage from './pages/SimDatenPage'
import SimulationPage from './pages/SimulationPage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

function App() {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      width: "100vw"
    }}>
      <TopNav /> {/* TopNav ist jetzt außerhalb des Containers für volle Breite */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth='l'> {/* Der Container ist jetzt nur für den Inhalt */}
          <Routes>
            <Route path="/" element={<Navigate to="/simulation" replace />} />
            <Route path="/simulation" element={<SimulationPage />} />
            <Route path="/data" element={<SimDatenPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  )
}
export default App

