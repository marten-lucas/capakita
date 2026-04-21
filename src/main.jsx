import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/notifications/styles.css'
import 'mantine-icon-picker/style.css'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import './index.css'
import App from './App.jsx'
import { Provider } from 'react-redux'
import store from './store/store'
import { IconsProvider } from 'tabler-dynamic-icon'
import * as TablerIcons from '@tabler/icons-react'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <IconsProvider icons={TablerIcons}>
        <MantineProvider>
          <App />
        </MantineProvider>
      </IconsProvider>
    </Provider>
  </StrictMode>,
)

// Expose the redux store on window for integration tests (dev only)
try {
  if (typeof window !== 'undefined') window.__APP_STORE = store
} catch {
  // ignore
}
