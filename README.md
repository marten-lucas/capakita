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

Das Projekt enthält einen Workflow für automatisches Deployment nach GitHub Pages bei Änderungen auf dem Hauptbranch. `npm run build:pages` erzeugt dafür den Build mit relativen Assetpfaden. Weil STMAS CORS für die offizielle XLS-Datei nicht freigibt, wird eine same-origin-Kopie unter `public/reference/` mit ausgeliefert; bei Änderungen an der Quelle lässt sie sich mit `npm run update:baykibig-cache` aktualisieren und anschließend committen.

### Coolify mit gemeinsamem Backend (Docker Compose)

Der Coolify-Modus speichert Szenarien und importierte Daten gemeinsam in einer SQLite-Datenbank. Login und Identität laufen über Authentik (OIDC); der Backend-Server und die Datenbankdatei liegen im selben App-Container, die Datenbank auf einem persistenten Volume.

1. In Authentik einen confidential OIDC-Provider und eine Application für CapaKita anlegen. Als Redirect-URI exakt `https://<capakita-domain>/api/auth/callback` eintragen. Der Provider muss über die angeforderten OIDC-Scopes einen `groups`-Claim mit der Gruppe für zugelassene Nutzer ausgeben. Falls nötig, in Authentik einen passenden Scope/Property-Mapping anlegen und `AUTHENTIK_SCOPES` darauf abstimmen.
2. Coolify mit dem Repository verbinden und `compose.yaml` als Docker-Compose-Konfiguration verwenden. Den öffentlichen HTTPS-Domain-Eintrag auf den Service `capakita`, Port `3000`, routen.
3. Die Variablen aus [`.env.example`](.env.example) in Coolify setzen. `APP_ORIGIN`, `SESSION_SECRET`, `AUTHENTIK_ISSUER_URL`, Client-ID/-Secret und `AUTHENTIK_ALLOWED_GROUP` sind erforderlich. Secrets nur in Coolify hinterlegen.
4. Das Volume `capakita_data` dauerhaft beibehalten und regelmäßig sichern. Die Datenbank liegt im Container unter `/data/capakita.sqlite`; keinen zusätzlichen öffentlichen DB-Port konfigurieren.

Ein vorhandenes Browser-Autosave wird nicht automatisch migriert. Für die Erstbefüllung den bisherigen Datenstand aus der alten Browser-Instanz exportieren und nach dem Authentik-Login in der Coolify-Instanz importieren. Danach wird der Workspace automatisch gemeinsam gespeichert.

Der Container-Healthcheck prüft `/api/v1/health`; `/healthz` bleibt als Liveness-Endpunkt verfügbar. Der Login-Cookie ist `Secure` und setzt HTTPS voraus. Der Server weist standardmäßig Snapshots zurück, deren Import-Metadaten einen nicht anonymisierten Adebis-Import markieren (`ALLOW_UNANONYMIZED_IMPORTS=false`). Das ist eine Schutzschranke gegen versehentliche Speicherung, keine belastbare Inhaltsprüfung gegen manipulierte Clients. Personenbezogene Daten nur nach ausdrücklicher Freigabe speichern.

Der Coolify-Build verwendet root-relative Assets und same-origin-Endpunkte unter `/api`. Der bisherige `build:pages`-Betrieb bleibt unabhängig und speichert weiterhin lokal im Browser. Für den Coolify-Betrieb Docker Compose/Dockerfile verwenden; Nixpacks ist wegen des nativen SQLite-Moduls und des erforderlichen persistenten Volumes nicht der empfohlene Weg.

### GitHub Release

Ein separater Release-Workflow erstellt bei Tags oder manuellem Start einen GitHub Release mit Build-Artefakt.

## Dokumentation

- Anwenderdokumentation: siehe [docs/user-guide.md](docs/user-guide.md)
- HTML-Export für die Beitragssimulation: siehe [docs/html-export-konzept.md](docs/html-export-konzept.md)
- Coolify-/Backend-Konzept: siehe [docs/coolify-backend-konzept.md](docs/coolify-backend-konzept.md)
- Refactor-Status und Zielbild: siehe [docs/refactor-plan.md](docs/refactor-plan.md)

## Projektstatus

Der vereinfachte Kern ist aktiv, testbar und releasefähig. Der Fokus liegt auf einem kleineren, wartbaren Funktionsumfang ohne aktiven Finanzbereich.
