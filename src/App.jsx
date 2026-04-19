import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell, Container } from '@mantine/core';
import TopNav from './components/TopNav'
import DataPage from './pages/DataPage'
import VisuPage from './pages/VisuPage'
import SettingsPage from './pages/SettingsPage'
import WelcomePage from './pages/WelcomePage';
import { useSelector } from 'react-redux';
import { Notifications } from '@mantine/notifications';
import ScenarioSaveDialog from './components/modals/ScenarioSaveDialog';
import ScenarioLoadDialog from './components/modals/ScenarioLoadDialog';
import './App.css'

function App() {
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const hasScenarios = scenarios && scenarios.length > 0;

  return (
    <AppShell
      header={hasScenarios ? { height: 60 } : undefined}
      padding="md"
    >
      <Notifications />
      <ScenarioSaveDialog />
      <ScenarioLoadDialog />
      {hasScenarios && (
        <AppShell.Header>
          <TopNav />
        </AppShell.Header>
      )}

      <AppShell.Main>
        <Container size="xl">
          {!hasScenarios ? (
            <WelcomePage />
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/data" replace />} />
              <Route path="/visu" element={<VisuPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
export default App
