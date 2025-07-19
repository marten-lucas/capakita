import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Container } from '@mui/material'
import TopNav from './components/TopNav'
import DataPage from './pages/DataPage'
import VisuPage from './pages/VisuPage'
import OrgaPage from './pages/OrgaPage'
import WelcomePage from './pages/WelcomePage';
import useSimScenarioStore from './store/simScenarioStore'; 
import './App.css'

function App() {
  const scenarios = useSimScenarioStore(state => state.scenarios);

  // Wenn keine Szenarien vorhanden sind, immer WelcomePage anzeigen
  if (!scenarios || scenarios.length === 0) {
    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        width: "100vw"
      }}>
        <TopNav />
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Container maxWidth='l'>
            <WelcomePage />
          </Container>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      width: "100vw"
    }}>
      <TopNav /> {/* TopNav ist jetzt außerhalb des Containers für volle Breite */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth='l'> {/* Der Container ist jetzt nur für den Inhalt */}
          <Routes>
            <Route path="/" element={<Navigate to="/data" replace />} />
            <Route path="/visu" element={<VisuPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/orga" element={<OrgaPage />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  )
}
export default App

