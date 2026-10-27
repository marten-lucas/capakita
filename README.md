# CapaKita

## Live-Demo

Die aktuelle Demo ist direkt über GitHub Pages erreichbar:

➡️ [CapaKita ausprobieren](https://marten-lucas.github.io/capakita/)

CapaKita ist eine Anwendung für Kita- und Kindergarten-Szenarien mit Fokus auf Import, Szenarien, Kapazitätsplanung und Visualisierung.

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

Das Projekt enthält einen Workflow für automatisches Deployment nach GitHub Pages bei Änderungen auf dem Hauptbranch. `npm run build:pages` erzeugt dafür den Build mit relativen Assetpfaden.

### Coolify (NPM / Docker)

Für Coolify stehen zwei Wege zur Verfügung:

- **Dockerfile (empfohlen):** Repository verbinden, Dockerfile-Build verwenden und Container-Port `3000` veröffentlichen. Der mehrstufige Build führt `npm ci` und `npm run build:coolify` aus; der Runtime-Container startet mit `npm start`. Healthcheck: `/healthz`.
- **Nixpacks/Node:** Build-Befehl `npm ci && npm run build:coolify`, Start-Befehl `npm start`, Port `3000`.

Der Coolify-Build verwendet root-relative Assets und der Produktionsserver liefert die SPA-Fallback-Route sowie den STMAS-Dokumentproxy aus. GitHub Pages bleibt davon unabhängig. Szenarien und Autosave liegen weiterhin im jeweiligen Browser (`localStorage`); die Coolify-Instanz stellt keine gemeinsame Datenbank oder benutzerübergreifende Speicherung bereit.

### GitHub Release

Ein separater Release-Workflow erstellt bei Tags oder manuellem Start einen GitHub Release mit Build-Artefakt.

## Dokumentation

- Anwenderdokumentation: siehe [docs/user-guide.md](docs/user-guide.md)
- Refactor-Status und Zielbild: siehe [docs/refactor-plan.md](docs/refactor-plan.md)

## Projektstatus

Der vereinfachte Kern ist aktiv, testbar und releasefähig. Der Fokus liegt auf einem kleineren, wartbaren Funktionsumfang ohne aktiven Finanzbereich.
