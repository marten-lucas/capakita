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
