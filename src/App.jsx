import { useEffect, useState } from 'react';
import { AppShell, Container } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import TopNav, { MobileBottomNav } from './components/TopNav'
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
  const isMobile = useMediaQuery('(max-width: 48em)');
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const activePage = useSelector(state => state.ui.activePage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const hasScenarios = scenarios && scenarios.length > 0;

  // Logik: Wenn keine Szenarien, nur Welcome & Legal erlauben
  useEffect(() => {
    if (!hasScenarios && !['welcome', 'legal'].includes(activePage)) {
      dispatch(setActivePage('welcome'));
    }

    if (hasScenarios && activePage === 'statistics') {
      dispatch(setActivePage('visu'));
    }

    // Wenn Szenarien geladen, automatisch zu 'data' navigieren
    if (hasScenarios && activePage === 'welcome') {
      dispatch(setActivePage('data'));
    }
  }, [hasScenarios, activePage, dispatch]);

  // View-Komponente auswählen
  const ViewComponent = VIEW_COMPONENTS[activePage] || WelcomeView;
  const isAnalysisPage = activePage === 'visu';
  const isSettingsPage = activePage === 'settings';
  const isFullWidthPage = isAnalysisPage || isSettingsPage;
  const showDesktopNavigation = hasScenarios && !isMobile;
  const showMobileNavigation = hasScenarios && isMobile;
  const desktopNavbarWidth = sidebarCollapsed ? 92 : 248;

  return (
    <AppShell
      header={showMobileNavigation ? { height: 56 } : undefined}
      navbar={showDesktopNavigation ? { width: desktopNavbarWidth, breakpoint: 'sm' } : undefined}
      footer={showMobileNavigation ? { height: 74 } : undefined}
      padding={isAnalysisPage ? 0 : { base: 'xs', sm: 'md' }}
    >
      <Notifications />
      <ScenarioSaveDialog />
      <ScenarioLoadDialog />
      
      {showMobileNavigation && (
        <AppShell.Header>
          <TopNav variant="mobile-header" />
        </AppShell.Header>
      )}

      {showDesktopNavigation && (
        <AppShell.Navbar>
          <TopNav
            variant="sidebar"
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((collapsed) => !collapsed)}
          />
        </AppShell.Navbar>
      )}

      {showMobileNavigation && (
        <AppShell.Footer>
          <MobileBottomNav />
        </AppShell.Footer>
      )}

      <AppShell.Main className={isAnalysisPage ? 'app-main--analysis' : undefined}>
        <Container
          size={isFullWidthPage ? '100%' : 'xl'}
          px={isAnalysisPage ? 0 : (isSettingsPage ? 0 : { base: 'xs', sm: 'md' })}
          className={isAnalysisPage ? 'app-view-shell app-view-shell--full app-view-shell--analysis' : isSettingsPage ? 'app-view-shell app-view-shell--full' : 'app-view-shell'}
        >
          <ViewComponent />
          {!isAnalysisPage && (
            <div className="app-footer">
              <AppFooter />
            </div>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
export default App
