# KiGa-Simulator

Vereinfachter Simulator für Kita- und Kindergarten-Szenarien mit Fokus auf Import, Szenarien, Kapazitätsplanung und Visualisierung.

## Kernfunktionen

- Import von Adebis-Datenbeständen aus ZIP-Dateien
- Anlegen, Ableiten, Speichern und Laden von Szenarien
- Pflege von Kindern, Mitarbeitenden, Gruppen und Buchungszeiten
- Analyseansichten für Regelbetrieb, Langzeitverlauf und Buchungsverteilung
- Stichtagsbasierte Auswertung und szenariobezogene Filter

## Technologie

- React und Vite
- Redux Toolkit
- Mantine UI
- Highcharts
- Vitest und Playwright

## Lokale Entwicklung

### Voraussetzungen

- Node.js 20 oder neuer
- npm

### Installation

```bash
npm install
```

### Entwicklungsserver starten

```bash
npm run dev
```

### Tests ausführen

```bash
npm test
npm run test:e2e
npm run test:e2e:headed
npm run lint
```

### Produktions-Build

```bash
npm run build
```

## Deployment

### GitHub Pages

Das Projekt enthält einen Workflow für automatisches Deployment nach GitHub Pages bei Änderungen auf dem Hauptbranch.

### GitHub Release

Ein separater Release-Workflow erstellt bei Tags oder manuellem Start einen GitHub Release mit Build-Artefakt.

## Dokumentation

- Anwenderdokumentation: siehe [docs/user-guide.md](docs/user-guide.md)
- Refactor-Status und Zielbild: siehe [docs/refactor-plan.md](docs/refactor-plan.md)

## Projektstatus

Der vereinfachte Kern ist aktiv, testbar und releasefähig. Der Fokus liegt auf einem kleineren, wartbaren Funktionsumfang ohne aktiven Finanzbereich.
