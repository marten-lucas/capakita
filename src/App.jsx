import { useEffect } from 'react';
import { AppShell, Container } from '@mantine/core';
import TopNav from './components/TopNav'
import AppFooter from './components/AppFooter';
import DataView from './views/DataView'
import VisuView from './views/VisuView'
import SettingsView from './views/SettingsView'
import EventsView from './views/EventsView';
import StatisticsView from './views/StatisticsView';
import WelcomeView from './views/WelcomeView';
import LegalView from './views/LegalView';
import { useSelector, useDispatch } from 'react-redux';
import { Notifications } from '@mantine/notifications';
import ScenarioSaveDialog from './components/modals/ScenarioSaveDialog';
import ScenarioLoadDialog from './components/modals/ScenarioLoadDialog';
import { setActivePage } from './store/uiSlice';
import { selectSelectedScenarioHasAdebisImport } from './store/simScenarioSlice';
import './App.css'

const VIEW_COMPONENTS = {
  welcome: WelcomeView,
  data: DataView,
  visu: VisuView,
  settings: SettingsView,
  events: EventsView,
  statistics: StatisticsView,
  legal: LegalView,
};

function App() {
  const dispatch = useDispatch();
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const activePage = useSelector(state => state.ui.activePage);
  const hasAdebisImport = useSelector(selectSelectedScenarioHasAdebisImport);
  
  const hasScenarios = scenarios && scenarios.length > 0;

  // Logik: Wenn keine Szenarien, nur Welcome & Legal erlauben
  useEffect(() => {
    if (!hasScenarios && !['welcome', 'legal'].includes(activePage)) {
      dispatch(setActivePage('welcome'));
    }

    if (hasScenarios && activePage === 'statistics' && !hasAdebisImport) {
      dispatch(setActivePage('data'));
    }

    // Wenn Szenarien geladen, automatisch zu 'data' navigieren
    if (hasScenarios && activePage === 'welcome') {
      dispatch(setActivePage('data'));
    }
  }, [hasScenarios, activePage, hasAdebisImport, dispatch]);

  // View-Komponente auswählen
  const ViewComponent = VIEW_COMPONENTS[activePage] || WelcomeView;

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
          <ViewComponent />
          <AppFooter />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
export default App
