import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import 'dayjs/locale/de'
import '@mantine/core/styles.css'
import '@mantine/carousel/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import store, { createAppStore } from './store/store'
import BackendShell from './backend/BackendShell'
import {
  createSharedStoragePersistence,
  loadSharedWorkspace,
  workspaceSnapshotToReduxState,
} from './backend/sharedStorage'
import Highcharts from 'highcharts'
import 'highcharts/modules/stock'
import 'highcharts/modules/timeline'

Highcharts.setOptions({
  accessibility: {
    enabled: false,
  },
})

// Configure Highcharts to handle rapid updates gracefully
Highcharts.Chart.prototype.series = Highcharts.Chart.prototype.series || [];
const originalUpdate = Highcharts.Series.prototype.update;
Highcharts.Series.prototype.update = function(options, redraw) {
  // Guard against update attempts on invalid series state
  try {
    if (!this.points || !Array.isArray(this.points)) {
      return this;
    }
    return originalUpdate.call(this, options, redraw);
  } catch (e) {
    if (e?.message?.includes?.('removePoint')) {
      // Silently ignore removePoint race conditions during rapid updates
      return this;
    }
    throw e;
  }
};

const root = createRoot(document.getElementById('root'))
const isCoolifyBuild = import.meta.env.MODE === 'coolify'

function renderApplication(applicationStore, backendState = null) {
  root.render(
    <StrictMode>
      <Provider store={applicationStore}>
        <MantineProvider>
          <DatesProvider settings={{ locale: 'de' }}>
            {backendState ? (
              <BackendShell {...backendState}>
                <App />
              </BackendShell>
            ) : <App />}
          </DatesProvider>
        </MantineProvider>
      </Provider>
    </StrictMode>,
  )

  try {
    if (typeof window !== 'undefined') window.__APP_STORE = applicationStore
  } catch {
    // ignore
  }
}

if (isCoolifyBuild) {
  const showBackendState = (backendState) => {
    root.render(
      <StrictMode>
        <MantineProvider>
          <DatesProvider settings={{ locale: 'de' }}>
            <BackendShell {...backendState} onRetry={startBackendApp}>
              {backendState.status === 'ready' && backendState.applicationStore ? (
                <Provider store={backendState.applicationStore}><App /></Provider>
              ) : null}
            </BackendShell>
          </DatesProvider>
        </MantineProvider>
      </StrictMode>,
    )
  }

  async function startBackendApp() {
    showBackendState({ status: 'loading' })
    try {
      const result = await loadSharedWorkspace()
      if (!result.authenticated) {
        showBackendState({ status: 'unauthenticated' })
        return
      }
      const applicationStore = createAppStore({
        preloadedState: workspaceSnapshotToReduxState(result.workspace.data),
        sharedPersistence: createSharedStoragePersistence(),
      })
      showBackendState({ status: 'ready', session: result.session, applicationStore })
    } catch (error) {
      showBackendState({ status: 'error', error: error.message })
    }
  }

  startBackendApp()
} else {
  renderApplication(store)
}

try {
  if (typeof window !== 'undefined') window.Highcharts = Highcharts
} catch {
  // ignore
}
