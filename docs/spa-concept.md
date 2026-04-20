# SPA-Konzept: CapaKita als Single Page Application

## Ausgangssituation
- Aktuelle Lösung: React Router DOM (BrowserRouter) mit URL-basierten Routes
- Routes: `/`, `/data`, `/visu`, `/settings`, `/impressum-datenschutz`
- Anforderung: Komplett unter einer URL, trotzdem Navigation zwischen "Seiten"

## Zielarchitektur

### 1. Routing-Ansatz: Client-State statt URL-State
```
Umgestellt von:
  / → Routes definieren Seite
  
Zu:
  / (immer) → Redux-State bestimmt aktive Seite
```

**Vorteil für deine Use-Case:**
- Nur noch eine URL: `https://capakita.example.com/`
- Navigation ändert keine URL
- State-basierte Komponentenauswahl ist explizit und wartbar
- Redux ist bereits im Projekt vorhanden

### 2. Router-Library: Wouter oder ohne?

#### Option A: Mit Wouter (empfohlen für Zukunftsflexibilität)
**Wouter Eigenschaften:**
- 1.3 KB Bundle-Size (vs. React Router ~40 KB)
- Hook-basiert, moderne API
- Pattern-Matching für Query-Parametern
- Einfache Migration: `useRoute()`, `useLocation()`

**Vorteil für dich:**
- Zukünftige Erweiterbarkeit (z.B. Deep-Links, Query-Params)
- Leichte Lernkurve bei nur einer Route
- Flexibler als komplexe State-Management-Lösung

#### Option B: Komplett ohne Router (minimal)
**Wenn du wirklich nur State-Switching brauchst:**
- Redux bestimmt View: `state.ui.activePage`
- Keine Route-Library
- Maximale Kontrolle, minimal Abhängigkeiten

**Nachteil:**
- Keine Browser-History (Zurück-Button geht nicht zur vorherigen Seite)
- Keine URL-Struktur für debugging/sharing

**Empfehlung: Option A (Wouter)** 
- Kleiner Bundle-Overhead
- Gibt dir volle Flexibilität
- Eigentlich für diesen Use-Case ideal

### 3. Navigation-Flow

#### Aktuell (URL-basiert):
```
TopNav: NavLink to="/data" 
  → Browser URL ändert
  → React Router matched Route
  → DataPage wird gerendert
```

#### Neu (State-basiert mit Wouter):
```
TopNav: Button onClick={() => setActivePage('data')}
  → Redux Action: setActivePage('data')
  → State aktualisiert
  → App re-render mit DataPage
  
Wouter läuft parallel:
  → Beobachtet URL (bleibt auf /)
  → Optional: Sync von Query-Params mit State
```

## Komponenten-Struktur (nach Refactor)

### Pages → Views (Umbenennung)
```
pages/
  DataPage.jsx       → views/DataView.jsx
  VisuPage.jsx       → views/VisuView.jsx
  SettingsPage.jsx   → views/SettingsView.jsx
  WelcomePage.jsx    → views/WelcomeView.jsx
  LegalPage.jsx      → views/LegalView.jsx
```
(Keine funktionalen Änderungen, nur konzeptuelle Umbenennung)

### Store-Struktur (neu)
```
uiSlice.js (neu)
  - activePage: 'welcome' | 'data' | 'visu' | 'settings' | 'legal'
  - setActivePage(page): Action
  
Existing:
  - simScenario, eventSlice, etc. bleiben unverändert
```

### App.jsx (vereinfacht)
```jsx
function App() {
  const activePage = useSelector(state => state.ui.activePage);
  const hasScenarios = useSelector(state => state.simScenario.scenarios?.length > 0);

  // Bedingte Logik nur noch hier
  if (!hasScenarios && activePage !== 'welcome' && activePage !== 'legal') {
    return <WelcomeView />;
  }

  const ViewComponent = {
    'welcome': WelcomeView,
    'data': DataView,
    'visu': VisuView,
    'settings': SettingsView,
    'legal': LegalView,
  }[activePage] || WelcomeView;

  return (
    <AppShell>
      {/* Header, Navigation, etc. */}
      <ViewComponent />
    </AppShell>
  );
}
```

### TopNav.jsx (vereinfacht)
```jsx
function TopNav() {
  const dispatch = useDispatch();

  return (
    <Group gap="xs">
      <Button onClick={() => dispatch(setActivePage('data'))}>
        Daten
      </Button>
      <Button onClick={() => dispatch(setActivePage('visu'))}>
        Analyse
      </Button>
      <Button onClick={() => dispatch(setActivePage('settings'))}>
        Optionen
      </Button>
    </Group>
  );
}
```

## Browser-Navigation & History

### Für Zurück-Button-Unterstützung (optional):
- Wouter Hook: `useLocation()` → URL-Fragment
- Redux Action: `setActivePage()` → State
- Sync: Wenn URL ändert → State update
- Alternative: History API direkt mit Redux synchen

**Empfehlung:** Implementierung Phase 2, nicht critical für MVP

## Daten-Flow (unverändert)

```
Redux Store (Szenarien, Daten, etc.)
  ↓
  → Redux Selektoren (wie aktuell)
  → View Components konsumieren Redux
  → OnClick Handler → Redux Actions
```

**Keine Änderung erforderlich** – Redux bleibt der Single Source of Truth

## Dateistruktur nach Refactor

```
src/
  App.jsx (vereinfacht: nur View-Auswahl)
  components/
    TopNav.jsx (onClick statt NavLink)
    AppFooter.jsx
    # Rest unverändert
  views/                       ← NEU
    WelcomeView.jsx
    DataView.jsx
    VisuView.jsx
    SettingsView.jsx
    LegalView.jsx
  store/
    uiSlice.js                 ← NEU
    simScenarioSlice.js        (unverändert)
    # Alle anderen Slices unverändert
  hooks/ (unverändert)
  models/ (unverändert)
  utils/ (unverändert)
```

## Migrationsschritte

1. **Redux uiSlice hinzufügen** → State für aktivePage
2. **Wouter installieren** (optional, aber empfohlen)
3. **Pages → Views umbenennen**
4. **App.jsx umschreiben** → State-basierte View-Auswahl
5. **TopNav.jsx anpassen** → onClick statt NavLink
6. **React Router entfernen** → package.json

## Vergleich: Alte vs. Neue Architektur

| Aspekt | Aktuell (Router) | Neu (State-basiert) |
|--------|------------------|---------------------|
| **URL** | Ändert sich bei Navigation | Bleibt `/` |
| **View-Auswahl** | URL → Route → Component | State → Component |
| **Bundle-Size** | +40 KB React Router | -40 KB, optional +1.3 KB Wouter |
| **Wartbarkeit** | Implizite Route-Definitions | Explizite State-Verwaltung |
| **Komplexität** | Routes, Redirects | Simple State Switch |
| **Seiteneffekte** | URL-Änderung | Redux Action |
| **Testing** | URL-Mocking erforderlich | Pure State Testing |

## Risiken & Mitigationen

| Risiko | Mitigation |
|--------|-----------|
| **Deep-Links / Sharing** | Wouter erlaubt Query-Params, z.B. `/?page=data` |
| **Browser-History** | Phase 2: History API Sync mit Redux |
| **Externe Links** | Legal-Page → neue Route oder modal |
| **Test-Migrations** | Navigation-Tests: Redux Actions statt URL-Mocking |
| **SEO (falls relevant)** | Nicht relevant für interne Tool |

## Nächste Schritte

→ Siehe `spa-refactor-plan.md` für detaillierte Umsetzung
