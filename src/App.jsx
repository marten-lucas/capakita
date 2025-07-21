import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Container, ThemeProvider, CssBaseline } from '@mui/material'
import TopNav from './components/TopNav'
import DataPage from './pages/DataPage'
import VisuPage from './pages/VisuPage'
import OrgaPage from './pages/OrgaPage'
import WelcomePage from './pages/WelcomePage';
import useSimScenarioStore from './store/simScenarioStore'; 
import theme from './theme';
import './App.css'
import ScenarioManager from './components/ScenarioManager'
import useAppSettingsStore from './store/appSettingsStore'

function App() {
  const scenarios = useSimScenarioStore(state => state.scenarios);
  const selectedScenarioId = useSimScenarioStore(state => state.selectedScenarioId);
  const setSelectedScenarioId = useSimScenarioStore(state => state.setSelectedScenarioId);
  const setSelectedItem = useAppSettingsStore(state => state.setSelectedItem);

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
        {/* ScenarioManager is now shown below TopNav and above page content */}
        <ScenarioManager
          selectedScenarioId={selectedScenarioId}
          setSelectedScenarioId={setSelectedScenarioId}
          scenarios={scenarios}
          setSelectedItem={setSelectedItem}
        />
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

