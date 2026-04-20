# Refactor-Plan: Umstieg auf State-Based SPA mit Wouter

## Ziel
Umstellung von URL-basiertem Routing (React Router) auf State-basiertes Routing mit optionaler Wouter-Integration. Die App bleibt unter einer URL (`/`), die Navigation erfolgt über Redux-State.

## Phase 1: Vorbereitung & Grundstruktur

### 1.1 Dependencies aktualisieren
```bash
# Entfernen
npm uninstall react-router-dom

# Hinzufügen
npm install wouter
```

**Warum Wouter:** Minimalist, aber mit genug Features für zukünftige Query-Param-Erweiterungen.

### 1.2 Neue Redux Slice: `uiSlice.js`
**Datei:** `src/store/uiSlice.js`

```javascript
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activePage: 'welcome', // 'welcome' | 'data' | 'visu' | 'settings' | 'legal'
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActivePage: (state, action) => {
      state.activePage = action.payload;
    },
  },
});

export const { setActivePage } = uiSlice.actions;
export default uiSlice.reducer;
```

**Register im Store:**
```javascript
// src/store/store.js
export const store = configureStore({
  reducer: {
    // Existing reducers...
    ui: uiReducer, // ← NEU
  },
});
```

### 1.3 Pages → Views umbenennen
```bash
# Verzeichnis erstellen
mkdir src/views

# Dateien verschieben und umbenennen
mv src/pages/WelcomePage.jsx src/views/WelcomeView.jsx
mv src/pages/DataPage.jsx src/views/DataView.jsx
mv src/pages/VisuPage.jsx src/views/VisuView.jsx
mv src/pages/SettingsPage.jsx src/views/SettingsView.jsx
mv src/pages/LegalPage.jsx src/views/LegalView.jsx

# Import-Statement in jeder View anpassen
# (z.B. '../components/...' statt '../../components/...')
```

**Hinweis:** Es ist auch okay, Pages beizubehalten, Views ist aber konzeptionell klarer.

---

## Phase 2: App.jsx umschreiben

### 2.1 Alte Struktur (React Router)
```jsx
// Aktuell: src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';

function App() {
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const hasScenarios = scenarios && scenarios.length > 0;

  return (
    <Routes>
      <Route path="/impressum-datenschutz" element={<LegalPage />} />
      <Route path="/" element={hasScenarios ? <Navigate to="/data" /> : <WelcomePage />} />
      {hasScenarios ? (
        <>
          <Route path="/visu" element={<VisuPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </>
      ) : null}
    </Routes>
  );
}
```

### 2.2 Neue Struktur (State-basiert)
```jsx
// Neu: src/App.jsx
import { AppShell, Container } from '@mantine/core';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import TopNav from './components/TopNav';
import AppFooter from './components/AppFooter';
import WelcomeView from './views/WelcomeView';
import DataView from './views/DataView';
import VisuView from './views/VisuView';
import SettingsView from './views/SettingsView';
import LegalView from './views/LegalView';
import { Notifications } from '@mantine/notifications';
import ScenarioSaveDialog from './components/modals/ScenarioSaveDialog';
import ScenarioLoadDialog from './components/modals/ScenarioLoadDialog';
import { setActivePage } from './store/uiSlice';
import './App.css';

const VIEW_COMPONENTS = {
  welcome: WelcomeView,
  data: DataView,
  visu: VisuView,
  settings: SettingsView,
  legal: LegalView,
};

function App() {
  const dispatch = useDispatch();
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const activePage = useSelector(state => state.ui.activePage);
  
  const hasScenarios = scenarios && scenarios.length > 0;

  // Logik: Wenn keine Szenarien, nur Welcome & Legal erlauben
  useEffect(() => {
    if (!hasScenarios && !['welcome', 'legal'].includes(activePage)) {
      dispatch(setActivePage('welcome'));
    }
    // Wenn Szenarien geladen, automatisch zu 'data' navigieren
    if (hasScenarios && activePage === 'welcome') {
      dispatch(setActivePage('data'));
    }
  }, [hasScenarios, activePage, dispatch]);

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
  );
}

export default App;
```

---

## Phase 3: TopNav.jsx anpassen

### 3.1 Alte Struktur
```jsx
// Aktuell: TopNav.jsx
import { NavLink } from 'react-router-dom';

<Button component={NavLink} to="/data">
  Daten
</Button>
```

### 3.2 Neue Struktur
```jsx
// Neu: TopNav.jsx
import { Group, Button, Text, Menu, ActionIcon, Container, Select } from '@mantine/core';
import { useDispatch, useSelector } from 'react-redux';
import { setActivePage } from '../store/uiSlice';
import { /* Icons */ } from '@tabler/icons-react';

function TopNav() {
  const dispatch = useDispatch();
  const canSave = useSelector(/* selector */);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const scenarioOptions = useMemo(
    () =>
      (scenarios || []).map((scenario) => ({
        value: String(scenario.id),
        label: scenario.name || 'Unbenanntes Szenario',
      })),
    [scenarios]
  );

  return (
    <Container size="xl" h="100%">
      <Group justify="space-between" h="100%">
        <Group gap="md">
          <Text size="xl" fw={700} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            CapaKita
          </Text>
          <Select
            aria-label="Szenario auswählen"
            placeholder="Szenario wählen"
            data={scenarioOptions}
            value={selectedScenarioId ? String(selectedScenarioId) : null}
            onChange={(value) => value && dispatch(setSelectedScenarioId(value))}
            allowDeselect={false}
            w={260}
            size="sm"
          />
        </Group>

        <Group gap="xs">
          {/* ÄNDERUNG: NavLink → onClick mit dispatch */}
          <Button
            onClick={() => dispatch(setActivePage('data'))}
            variant="subtle"
            leftSection={<IconDatabase size={20} />}
          >
            Daten
          </Button>
          <Button
            onClick={() => dispatch(setActivePage('visu'))}
            variant="subtle"
            leftSection={<IconChartBar size={20} />}
          >
            Analyse
          </Button>
          <Button
            onClick={() => dispatch(setActivePage('settings'))}
            variant="subtle"
            leftSection={<IconSettings size={20} />}
          >
            Optionen
          </Button>

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="Aktionen">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Aktionen</Menu.Label>
              {/* Rest bleiben unverändert */}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Container>
  );
}

export default TopNav;
```

---

## Phase 4: main.jsx (Entry-Point) aktualisieren

### 4.1 Alte Struktur
```jsx
// Aktuell: main.jsx
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <MantineProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MantineProvider>
    </Provider>
  </StrictMode>,
);
```

### 4.2 Neue Struktur
```jsx
// Neu: main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';
import App from './App.jsx';
import store from './store/store';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <MantineProvider>
        <App />
        {/* BrowserRouter removed – nicht mehr nötig */}
      </MantineProvider>
    </Provider>
  </StrictMode>,
);
```

**Was sich ändert:**
- ❌ `import { BrowserRouter }` entfernt
- ❌ `<BrowserRouter>` Wrapper entfernt

---

## Phase 5: Tests aktualisieren

### 5.1 Navigation-Tests (anpassen)

**Alt (URL-basiert):**
```javascript
// OLD: Testen via URL
test('navigate to data page', async () => {
  render(<App />);
  // Externe Route-Abhängigkeit
});
```

**Neu (State-basiert):**
```javascript
// NEW: Testen via Redux Action
test('navigate to data page', () => {
  const store = configureStore({
    reducer: {
      ui: uiReducer,
      simScenario: simScenarioReducer,
    },
    preloadedState: {
      ui: { activePage: 'welcome' },
      simScenario: { scenarios: [/* mock */] },
    },
  });
  
  const { getByText } = render(
    <Provider store={store}>
      <App />
    </Provider>
  );
  
  fireEvent.click(getByText('Daten'));
  expect(store.getState().ui.activePage).toBe('data');
});
```

### 5.2 Komponenten-Tests (minimal anpassen)
- `src/App.smoke.test.jsx` → Keine Route-Checks mehr erforderlich
- `TopNav.jsx` Tests → Click-Handler statt Link-Tests
- Andere Component-Tests → Weitgehend unverändert

---

## Phase 6: Aufräumen

### 6.1 Dependencies cleanupen
```json
{
  "dependencies": {
    // Entfernt:
    // "react-router-dom": "^7.6.3",
    // Hinzugefügt:
    "wouter": "^3.0.0"
  }
}
```

### 6.2 Alte pages-Verzeichnis (optional)
```bash
# Option 1: Alten Verzeichnis löschen (wenn 100% migriert)
rm -rf src/pages

# Option 2: Temporär behalten zur Verlinkung
# (z.B. wenn noch externe References existieren)
```

### 6.3 Imports durchsuchen & korrigieren
```bash
# Findet noch alle React Router Imports
grep -r "from 'react-router-dom'" src/

# Findet noch alle alten pages Imports
grep -r "from.*pages/" src/
```

---

## Checkliste zur Implementierung

### Grundstruktur
- [ ] `uiSlice.js` erstellt & im Store registriert
- [ ] `views/` Verzeichnis erstellt, Pages umbenannt
- [ ] Alle Import-Pfade in Views korrigiert
- [ ] `wouter` installiert (oder bewusst ausgelassen)

### Code-Änderungen
- [ ] `App.jsx` komplett umgeschrieben (State-basierte View-Auswahl)
- [ ] `TopNav.jsx` angepasst (onClick statt NavLink)
- [ ] `main.jsx` aktualisiert (BrowserRouter entfernt)
- [ ] Alle anderen Komponenten-Imports korrigiert

### Dependencies
- [ ] `react-router-dom` entfernt
- [ ] `wouter` installiert
- [ ] `npm ci` / `npm install` ausgeführt
- [ ] Build erfolgreich (`npm run build`)

### Tests
- [ ] Navigation-Tests aktualisiert
- [ ] Smoke-Tests passen noch
- [ ] E2E-Tests passen noch
- [ ] `npm test` erfolgreich
- [ ] `npm run test:e2e` erfolgreich

### Code Quality
- [ ] ESLint: `npm run lint`
- [ ] Keine React Router Imports mehr vorhanden
- [ ] Keine alten page-Imports mehr vorhanden
- [ ] `console.error` für Dev-Fehler überprüft

### Dokumentation
- [ ] README aktualisiert (falls erwähnt)
- [ ] Diese Refactor-Docs abgehakt

---

## Rollback-Strategie

Falls etwas nicht funktioniert:

```bash
# Git Branch zurück
git checkout main

# Oder selektiv:
git restore src/App.jsx src/components/TopNav.jsx
```

**Keine Abhängigkeits-Komplexität** – Nur Redux-State ändert sich, keine externe Library-Abhängigkeiten die Bugs einführen könnten.

---

## Zukünftige Erweiterungen (Phase 2+)

### Query-Parameters (optional)
Falls Deep-Links später gewünscht sind, mit Wouter einfach zu implementieren:
```jsx
const [params] = useSearch();
// ?page=data&tab=overview
```

### Browser-History Sync
Redux-Änderungen mit URL-History synchen:
```jsx
useEffect(() => {
  window.history.replaceState({ page: activePage }, '', '/');
}, [activePage]);
```

### Keyboard-Shortcuts
Navigation mit Hotkeys:
```jsx
useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.altKey && e.key === '1') dispatch(setActivePage('data'));
    if (e.altKey && e.key === '2') dispatch(setActivePage('visu'));
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [dispatch]);
```

---

## Erwartete Verbesserungen

| Bereich | Vorher | Nachher |
|---------|--------|---------|
| **Bundle-Size** | React Router ~40 KB | Wouter ~1.3 KB (oder 0 KB ohne) |
| **Komplexität** | Route-Definitions, Redirects | Simple State Switch |
| **Nachvollziehbarkeit** | Implizite URL-zu-Route Mappings | Explizite Redux-State |
| **Testing** | URL-Mocking erforderlich | Pure State Testing |
| **Wartbarkeit** | Routes verstreut | Zentralisierte Page-Liste in App.jsx |
| **Navigation-Performance** | URL-Änderung + React Router Match | Direkter Redux State Update |

---

## Estimated Effort
- **Recherche & Review:** 30 min
- **Implementierung:** 1–2 Stunden
- **Testing & Debugging:** 30–60 min
- **Dokumentation & Cleanup:** 20 min
- **Gesamt:** ~3–4 Stunden

---

## Support & Fragen
Kontakt bei Problemen:
- Redux-State nicht gesynct? → `store.getState()` im DevTools überprüfen
- Views rendern nicht? → `console.log(activePage)` debuggen
- Imports kaputt? → IDE-Refactor nutzen (`Rename Symbol`)
