# CapaKita: Konzept für Coolify mit gemeinsamem Backend

## Ziel

Mehrere angemeldete Nutzer sollen dieselben in CapaKita importierten Adebis-Daten und Szenarien sehen und – entsprechend ihrer Berechtigung – bearbeiten können. Die bisherige GitHub-Pages-/Browser-Variante soll weiterhin ohne Backend funktionieren.

## Ist-Zustand

- `Dockerfile` baut eine Vite-SPA und startet `server.mjs`.
- `server.mjs` liefert derzeit nur statische Dateien, `/healthz` und den eng begrenzten STMAS-Dateiproxy aus. Er hat keine API und keine Datenbank.
- Import, Szenarien, Buchungen, Gruppen, Finanzen und weitere Änderungen liegen im Redux-Store. Das optionale Browser-Autosave verwendet `localStorage` (`src/store/store.js`, `src/utils/browserStorage.js`). Browserdaten sind pro Browserprofil und nicht zwischen Nutzern geteilt.
- Der Datei-Export enthält bereits ein gemeinsames Datenobjekt aus Szenarien und den zugehörigen Redux-Daten (`src/utils/saveLoadUtils.js`). Das ist ein praktikabler Startpunkt für die Backend-Persistenz.
- Bei nicht anonymisierten Adebis-Imports ist Browser-Autosave derzeit gesperrt (`isSaveAllowed` in `src/store/simScenarioSlice.js`). Das ist ein wichtiger Datenschutzhinweis, aber noch keine serverseitige Zugriffskontrolle.

## Empfehlung: ein zusätzlicher „Coolify / gemeinsam“-Betriebsmodus

Die bestehende React-Anwendung und ihr Redux-Modell bleiben erhalten. Für das Backend wird ein **Storage-Adapter** ergänzt:

```text
GitHub Pages / lokal                      Coolify / geteilt
React + Redux                              React + Redux
BrowserStorage (localStorage/Datei)        API-Storage-Adapter
                                            │ same origin: /api/*
                                            Node-Server (server.mjs + API)
                                            │
                                            SQLite-Datei auf persistentem /data-Volume
```

Die API läuft auf demselben Origin wie die SPA. Dadurch braucht es für die Browser-App weder CORS-Konfiguration noch einen öffentlich erreichbaren Datenbank-Port. GitHub Pages behält seinen bisherigen lokalen Modus; die Coolify-Build-Variante verwendet die API.

### Was wird gemeinsam geteilt?

Für den ersten Ausbau empfiehlt sich ein gemeinsamer Workspace pro Einrichtung/Organisation:

- Importierte Datensätze und alle daraus abgeleiteten App-Daten liegen im gemeinsamen Workspace.
- Szenarien, Änderungen, Gruppen, Buchungen, Einstellungen und Auswertungsparameter dieses Workspaces sind für berechtigte Nutzer sichtbar.
- Im MVP gilt: Änderungen werden gemeinsam gespeichert. Rollen begrenzen, wer bearbeiten darf.
- Wenn später persönliche Szenarioentwürfe gewünscht sind, können diese als separates Feature ergänzt werden. Sie sollten nicht mit dem gemeinsamen Importbestand vermischt werden.

Damit ist die fachliche Entscheidung für den MVP explizit: **gemeinsamer Workspace-Zustand**, nicht private Browserkopien je Nutzer.

## Datenhaltung: versionierter JSON-Snapshot in SQLite

Die aktuelle App speichert den zusammengehörenden Redux-Zustand in mehreren Slices. Für den MVP wird dieser Zustand als JSON-Dokument in einer SQLite-Tabelle abgelegt. SQLite läuft im App-Container; eine zusätzliche Datenbankinstanz ist nicht erforderlich.

Implementierte Tabellen:

- `workspace_state`: genau ein gemeinsamer Workspace pro Deployment, mit `version`, `data_json`, `updated_at` und `updated_by`.
- `sessions`: serverseitige OIDC-Sitzungen mit Nutzerkennung, Rolle, CSRF-Token und Ablaufzeit.

Das Snapshot-Format orientiert sich an `extractSaveData(state)` und umfasst Szenarien, importierte Datensätze, Buchungen, Gruppen, Qualifikationen, Finanzdaten, Diagrammzustand, ausgewählte Elemente, Szenario-Overlays und deaktivierte Auto-Events. Flüchtiger UI-Zustand wird nicht synchronisiert. Die Datei liegt standardmäßig unter `/data/capakita.sqlite`.

Jeder Schreibvorgang prüft die erwartete Snapshot-Version; dadurch führen konkurrierende Änderungen zu `409 Conflict` statt stillem Überschreiben. SQLite verwendet WAL und ein persistentes Volume. Dieses Setup ist für eine einzelne App-Instanz und eine kleine Zahl gleichzeitiger Nutzer gedacht. Mehrere App-Replikas oder hohe Schreibkonkurrenz sind ein Grund, später auf PostgreSQL zu wechseln. Revisionshistorie ist im aktuellen MVP nicht enthalten.

Vor produktiver Nutzung sind tatsächliche Snapshot-Größen zu messen. API-Request-Größen sind begrenzt; das Volume und insbesondere externe Backups müssen ausreichend dimensioniert und geschützt werden.

## API-Schnittstelle

Alle Endpunkte sind same-origin unter `/api/v1` und erfordern eine gültige Anmeldung, außer dem Healthcheck.

| Methode | Endpunkt | Zweck |
|---|---|---|
| `GET` | `/api/v1/session` | Angemeldeten Nutzer und Workspace-Rolle abfragen |
| `GET` | `/api/v1/workspace/state` | Aktuellen gemeinsamen Snapshot samt `version` laden |
| `PUT` | `/api/v1/workspace/state` | Snapshot speichern; erwartet die geladene Version |
| `GET` | `/api/v1/health` | API-/Datenbankstatus für Monitoring/Readiness |

Die Importdatei wird zunächst wie heute im Browser verarbeitet. Nach erfolgreichem Import erzeugt die vorhandene Importlogik den Redux-Zustand; der Storage-Adapter speichert den Snapshot über `PUT`. Roh-ZIP-Dateien müssen damit nicht dauerhaft im Backend abgelegt werden. Ein späterer serverseitiger Import ist separat zu planen.

### Gleichzeitige Bearbeitung

Jeder geladene Snapshot trägt eine monotone `version`. Speichern erfolgt nur, wenn die vom Client erwartete Version noch aktuell ist. Bei veralteter Version antwortet die API mit `409 Conflict` und liefert die aktuelle Version/Metadaten zurück. Die Oberfläche zeigt dann an, dass ein anderer Nutzer zwischenzeitlich gespeichert hat, und bietet Neuladen statt stiller Überschreibung.

Im MVP kein automatisches Zusammenführen oder Echtzeit-Push: Das wäre mit dem jetzigen Redux-Gesamtzustand riskant. Ein kurzer Polling-Check oder manuelles Neuladen kann Änderungen anderer Nutzer kenntlich machen. Später sind granularere APIs, Revisionen oder WebSockets möglich.

## Authentifizierung und Berechtigungen: Authentik (OIDC)

Authentik ist der vorgesehene Identity Provider. CapaKita erhält keine eigenen Passwörter; der Node-Backend-Teil agiert als vertraulicher OIDC-Client und verwaltet die Anwendungssitzung.

### Login-Flow

1. Nutzer wählt in CapaKita „Anmelden“; der Browser wird über einen Backend-Endpunkt zu Authentik umgeleitet.
2. Authentik authentifiziert den Nutzer und leitet mit einem Authorization Code an den registrierten Backend-Callback zurück.
3. Das Backend tauscht den Code serverseitig gegen Tokens, validiert Issuer, Signatur, Audience, Ablaufzeit und `state`/`nonce` und ermittelt eine stabile Nutzerkennung (`sub`).
4. Das Backend erstellt eine eigene Sitzung und setzt ein `HttpOnly`, `Secure`, `SameSite=Lax`-Cookie. Access-/Refresh-Tokens werden nicht an React weitergegeben und nicht in `localStorage` gespeichert.
5. React fragt `GET /api/v1/session` ab und erhält nur die für die UI benötigten Angaben (z. B. Anzeigename, Workspace und Rolle).
6. Logout beendet die CapaKita-Sitzung; optional wird zusätzlich der Authentik-End-Session-Endpunkt aufgerufen.

Vorgeschlagene Auth-Endpunkte:

- `GET /api/auth/login` – OIDC-Login starten.
- `GET /api/auth/callback` – registrierter OIDC-Redirect-URI.
- `POST /api/auth/logout` – Anwendungssitzung beenden.
- `GET /api/v1/session` – aktuelle CapaKita-Identität und Berechtigungen liefern.

### Workspace-Zugriff und Rollen

- Authentik bestätigt die Identität; die stabile Nutzerkennung ist `sub`. Mitglieder der konfigurierten `AUTHENTIK_ALLOWED_GROUP` dürfen den gemeinsamen Workspace verwenden.
- Zugelassene Nutzer erhalten standardmäßig `editor`; optional wird `AUTHENTIK_ADMIN_GROUP` auf `admin` abgebildet. Admin-Rechte schalten derzeit keine separate Nutzerverwaltung frei; sie sind ein vorbereiteter Rollenwert für den Ausbau.
- Der vom Authentik-Provider signierte Gruppen-Claim (`groups` oder konfigurierter `AUTHENTIK_GROUPS_CLAIM`) muss explizit eingerichtet werden. Admin-Rechte werden nur über die separat konfigurierte Admin-Gruppe vergeben.
- Eine lokale Nutzerverwaltung oder getrennte Workspace-Mitgliedschaftstabelle ist im Ein-Workspace-MVP nicht vorgesehen.
- Jede geschützte API-Abfrage prüft die serverseitige Sitzung; die Anmeldung wird auf die freigegebene Authentik-Gruppe begrenzt. Der Client kann seine Rolle nicht selbst festlegen.
- Zustandsändernde Cookie-Endpunkte verwenden CSRF-Token und Origin-Prüfung. Rate-Limits für Login/Callback und weitergehendes Audit-Logging sind vor einem öffentlich exponierten Produktivbetrieb noch zu ergänzen.

### Authentik-Konfiguration

- In Authentik eine OAuth2/OpenID-Connect-Provider/Application für CapaKita anlegen.
- Client-Typ confidential; Redirect-URI exakt auf `https://<capakita-domain>/api/auth/callback` begrenzen.
- `openid`, `profile` und `email` anfordern. Für den Gruppen-Claim ggf. einen eigenen Scope/Property-Mapping in Authentik einrichten und `AUTHENTIK_SCOPES` passend setzen. Nicht angeforderte Authentik-Claims stehen dem Backend nicht zuverlässig zur Verfügung.
- TLS und die korrekte externe URL/Proxy-Konfiguration von Authentik und Coolify sicherstellen.
- Client-Secret ausschließlich als Coolify-Secret in der Backend-Umgebung ablegen und bei Rotation aktualisieren.

Die Anmeldung ist damit an Authentik delegiert. Lokale CapaKita-Passwortkonten sind im MVP nicht vorgesehen.

## Schutz sensibler Kita-Daten

Importierte Kita-Daten können personenbezogene Daten von Kindern, Sorgeberechtigten und Mitarbeitenden enthalten. Vor einem produktiven Mehrbenutzerbetrieb sind mindestens folgende Anforderungen zu klären und umzusetzen:

1. Nur über HTTPS betreiben; das SQLite-Volume und externe Backups vor unberechtigtem Zugriff schützen.
2. Datenminimierung und Anonymisierung als bevorzugten Importweg beibehalten. Die API prüft das `importedAnonymized`-Metadatum als Schutz gegen versehentliche Speicherung, kann damit aber nicht verlässlich den Inhalt gegen einen manipulierten Client prüfen.
3. Falls personenbezogene Daten gespeichert werden müssen: explizite organisatorische Freigabe, Rechtsgrundlage/Verantwortlichkeiten und Löschfristen mit dem Betreiber klären. Im Zweifel keinen produktiven Rohdatenimport freischalten.
4. Zugriffskontrolle pro Workspace, sichere Sitzungen, Schutz vor CSRF, Eingabevalidierung und Protokollierung ohne sensible Nutzdaten.
5. Backups der SQLite-Datei verschlüsseln, Aufbewahrung und Restore testen. WAL-Betrieb beachten und konsistente SQLite-Backups verwenden; nicht nur die gerade aktive Datenbankdatei unkoordiniert kopieren.
6. Die bestehende AES-Datei-Sicherung ist clientseitiger Datei-Export und ersetzt keine Datenbankverschlüsselung, Zugriffskontrolle oder sichere Schlüsselverwaltung.

## Coolify-Deployment

### Dienste

1. **Capakita-App**: Dockerfile baut Frontend und API; Port `3000` wird über den Coolify-Proxy veröffentlicht.
2. **SQLite**: keine separate Datenbankinstanz. Die Datei `/data/capakita.sqlite` und ihre WAL-Dateien liegen auf dem persistenten Volume `capakita_data`.

### Umgebungsvariablen (Vorschlag)

- `SQLITE_PATH=/data/capakita.sqlite` – Standardpfad der SQLite-Datei auf dem persistenten Volume.
- `SESSION_SECRET` – kryptografisch zufälliges Secret, nicht ins Image oder Repository schreiben.
- `AUTHENTIK_ISSUER_URL` – OIDC-Issuer-URL der Authentik-Instanz (Issuer, nicht pauschal die Discovery-URL; Discovery wird daraus aufgelöst).
- `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET` – OIDC-Clientdaten; Secret nur als Coolify-Secret.
- `AUTHENTIK_SCOPES` – angeforderte OIDC-Scopes, standardmäßig `openid profile email`.
- `AUTHENTIK_REDIRECT_URI` – exakt registrierte Callback-URL, z. B. `https://capakita.example.org/api/auth/callback`.
- `APP_ORIGIN` – kanonische HTTPS-URL für Redirect-, Cookie- und CSRF-Prüfung.
- `PORT` / `HOST` – wie bisher.

Das Backend legt die SQLite-Tabellen idempotent beim Start an. Der Docker-Healthcheck prüft `/api/v1/health`; `/healthz` bleibt als einfacher Liveness-Endpunkt bestehen. Das Volume `capakita_data` muss Deployments überleben und regelmäßig gesichert werden.

### Build-Modi

- `build:pages`: unverändert, rein browserlokal, keine Backend-Abhängigkeit.
- `build:coolify`: Backend-Modus mit same-origin `/api`; Datenbank-Secrets liegen ausschließlich in der Serverumgebung.
- Ein zentraler Storage-Adapter lädt und speichert den Snapshot. Backendfehler werden sichtbar gemacht; der Coolify-Modus fällt nicht unbemerkt auf `localStorage` zurück.

Die API ist aktuell direkt im handgeschriebenen Node-HTTP-Server implementiert; OIDC-Tokenprüfung erfolgt über `openid-client`, SQLite über `better-sqlite3`. Vor öffentlich exponiertem Produktivbetrieb sind insbesondere Login-Rate-Limits, Audit-/Restore-Konzept und Betriebsmonitoring weiter zu härten.

## Umsetzung und nächste Schritte

Authentik-Login, SQLite-Persistenz, gemeinsame Snapshot-API, Versionskonflikte und Docker-Compose-Deployment sind implementiert. Offen bleiben organisatorische Datenschutzfreigaben und die unten genannten Betriebsmaßnahmen.

### Fachliche und Datenschutzfragen

- Im aktuellen MVP dürfen Mitglieder der freigegebenen Authentik-Gruppe gemeinsam bearbeiten; eine reine Viewer-Rolle ist noch nicht umgesetzt.
- Festlegen, ob ausschließlich anonymisierte Daten auf dem Server gespeichert werden dürfen.
- Authentik-OIDC-Provider/Application, Redirect-URI, erlaubte Nutzer/Gruppen und Workspace-Admins festlegen.
- Workspace-Verantwortliche, Aufbewahrung und Backup-RPO/RTO bestimmen.
- Größe repräsentativer (anonymisierter) Import-/Save-Dokumente messen.

### Deployment in Coolify

- In Authentik einen OIDC-Provider, die Gruppen-Claims/Scopes und die erlaubte Nutzergruppe konfigurieren.
- CapaKita in Coolify mit HTTPS, Secrets und persistentem SQLite-Volume deployen.
- Erstbefüllung über den Import in der angemeldeten Coolify-App durchführen; vorhandenes Browser-Autosave wird nicht automatisch übernommen.
- Backup-/Restore-Test, Retention, Login-Rate-Limits und Monitoring einrichten.

### Produktivbetrieb absichern

- Verschlüsselte, automatisierte Backups und Restore-Test.
- Audit-/Revisionshistorie, Löschung und Retention umsetzen.
- Login-Rate-Limits und Monitoring ergänzen.
- E2E-Test: Nutzer A importiert, Nutzer B meldet sich an und sieht denselben Stand; konkurrierende Änderungen werden nicht still überschrieben.

### Optionales Wachstum

- Persönliche Szenarien oder Freigaben ergänzen, falls fachlich benötigt.
- Bei Bedarf Datenmodell normalisieren und differenzielle Updates einführen.
- Echtzeit-Änderungen/Benachrichtigung nur bei nachgewiesenem Bedarf.

## Akzeptanzkriterien für den ersten produktiven Stand

- Zwei verschiedene angemeldete Browser sehen denselben Workspace und denselben importierten Datenbestand.
- Änderungen eines Editors werden nach Speichern vom anderen Nutzer nach Neuladen sichtbar.
- Veraltete Schreibstände erzeugen einen erkennbaren Konflikt, niemals unbemerkte Last-write-wins-Verluste.
- Ein nicht angemeldeter oder workspace-fremder Nutzer kann keine Daten lesen oder verändern.
- App-Neustart und Container-Neuerstellung verlieren keine Daten; das SQLite-Volume und ein getestetes Backup sind vorhanden.
- Pages-/lokaler Modus funktionieren weiter ohne API.
- Bei Backend-Ausfall wird keine vermeintlich geteilte lokale Kopie still als gespeichert angezeigt.

## Fazit

Der schlanke MVP besteht aus einer Coolify-App mit same-origin API, Authentik-OIDC und einer versionierten SQLite-Datei auf persistentem Volume. Ein JSON-Snapshot bildet den bestehenden Speichern-/Laden-Zustand ab; Gruppenautorisierung, Sitzungen und Versionsprüfung ermöglichen den gemeinsamen Zugriff. Die SQLite-Variante ist auf eine einzelne App-Instanz ausgelegt. Vor Speicherung nicht anonymisierter Kita-Daten müssen Datenschutz, Zuständigkeit und Betriebsmaßnahmen ausdrücklich freigegeben sein.
