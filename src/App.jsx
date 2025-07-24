import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Container, ThemeProvider, CssBaseline } from '@mui/material'
import TopNav from './components/TopNav'
import DataPage from './pages/DataPage'
import VisuPage from './pages/VisuPage'
import OrgaPage from './pages/OrgaPage'
import WelcomePage from './pages/WelcomePage';
import { useSelector } from 'react-redux';
import theme from './theme';
import './App.css'
import ScenarioPicker from './components/ScenarioManager/ScenarioPicker'

function App() {
  const scenarios = useSelector(state => state.simScenario.scenarios);
  // Wenn keine Szenarien vorhanden sind, immer WelcomePage anzeigen
  if (!scenarios || scenarios.length === 0) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
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
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        width: "100vw"
      }}>
        <TopNav />
        {/* Use ScenarioPicker directly */}
        <ScenarioPicker />
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Container maxWidth='l'>
            <Routes>
              <Route path="/" element={<Navigate to="/data" replace />} />
              <Route path="/visu" element={<VisuPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/orga" element={<OrgaPage />} />
            </Routes>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
export default App
