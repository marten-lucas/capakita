import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import 'dayjs/locale/de'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import store from './store/store'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <MantineProvider>
        <DatesProvider settings={{ locale: 'de' }}>
          <App />
        </DatesProvider>
      </MantineProvider>
    </Provider>
  </StrictMode>,
)

// Expose the redux store on window for integration tests (dev only)
try {
  if (typeof window !== 'undefined') window.__APP_STORE = store
} catch {
  // ignore
}

try {
  if (typeof window !== 'undefined') window.Highcharts = Highcharts
} catch {
  // ignore
}
