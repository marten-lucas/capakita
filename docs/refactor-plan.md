# Refactor-Plan: CapaKita

## Status-Checkliste Stand 19.04.2026

### Bereits umgesetzt
- [x] Arbeiten im Branch refactor/simplified-core
- [x] UI-Migration auf Mantine in den aktiven Kernansichten
- [x] Finanzbereich aus der aktiven UI und dem Hauptdatenfluss entfernt
- [x] STATUS-Filter auf + beim Import umgesetzt
- [x] dynamischer Standard-Stichtag umgesetzt
- [x] Langzeitansicht mit Woche, Monat, Quartal und Jahr vorhanden
- [x] Smoke-Tests, E2E-Tests, Lint und Build erfolgreich
- [x] GitHub Pages Deployment automatisiert

### Teilweise umgesetzt
- [x] Zielbild mit allen vier Kernvisualisierungen vollständig abgeschlossen
- [x] Dates-of-Interest-Verwaltung mit klarer Kennzeichnung automatischer Ereignisse vollständig abgeschlossen
- [x] Visualisierungen fachlich und visuell final abgesichert

### Noch offen
- [x] README vollständig neu schreiben
- [x] Anwenderdokumentation ergänzen
- [x] GitHub Releases automatisieren
- [x] Trennung pädagogischer und administrativer Arbeitszeitblöcke fachlich vervollständigen

## Zielbild
Das Projekt wird auf einen klaren Kern reduziert: Import, Szenarien, pädagogische Kapazitätsplanung und vier aussagekräftige Visualisierungen.

Die Finanzlogik wird vollständig entfernt. Die Anwendung fokussiert sich künftig auf:

1. Regelbetrieb: Kapazität versus Bedarf je Öffnungsstunde
2. Alters-Histogramm: Kinderalter in 3-Monats-Kategorien
3. Langzeitüberblick: Woche, Monat, Quartal, Jahr
4. Buchungsverteilung

## Verbindliche Rahmenbedingungen
- Entwicklung ausschließlich im Feature-Branch refactor/simplified-core
- Merge nach main erst nach bestandenen Tests und manueller fachlicher Prüfung
- UI-Migration auf Mantine UI mit deutlicher Reduktion unnötiger Zusatzpakete
- Dokumentation für Entwickler und Anwender wird vollständig ergänzt

## Fachliche Entscheidungen
### Importlogik
- Kinder werden nur berücksichtigt, wenn STATUS gleich + ist.
- Kinder mit Austrittsdatum vor dem Stichtag werden ausgeschlossen.
- Der Standard-Stichtag ist dynamisch und orientiert sich am aktuellen Datum.
- Buchungen ohne wirksame Zeiten werden nicht in Statistiken übernommen.

### Kapazitätslogik
- Kapazität wird primär aus Mitarbeiterzeiten berechnet.
- Arbeitszeitblöcke erhalten die Kategorien Pädagogisch und Administrativ.
- Nur Pädagogisch zählt in Betreuungsschlüssel, Kapazitätskurven und Regelbetriebsdiagramme.

### Automatisch generierte Dates of Interest
- Es werden automatisch Ereignisse für Gruppenwechsel erzeugt:
  - Krippe → Kita
  - Kita → Schulkindbetreuung
- Diese Ereignisse sind in der Oberfläche klar als automatisch generiert markiert.
- Sie fließen standardmäßig in die Statistiken ein.
- Es gibt eine eigene Übersicht, in der einzelne automatisch generierte Ereignisse deaktiviert werden können.

### Langzeitansicht
- Die vorhandene Filterlogik für Woche, Monat, Quartal und Jahr bleibt erhalten und wird vereinfacht sowie fachlich abgesichert.

## Technische Zielarchitektur
## 1. Datenkern vereinfachen
Der künftige Kern besteht aus wenigen stabilen Domänen:
- Kinder
- Buchungen
- Mitarbeitende
- Gruppen
- Szenarien
- Ereignisse und Dates of Interest
- Abgeleitete Statistiken

Zu entfernen oder grundlegend zurückzubauen:
- alle Financial-Modelle
- Finanz-Slices im Store
- Finanz-Overlays
- BayKiBiG-Finanzberechnung
- Finanzdiagramme und zugehörige Formularteile

## 2. Store und Datenfluss vereinfachen
Ziel ist ein deutlich kleinerer und nachvollziehbarer State:
- Rohdatenimport getrennt von abgeleiteten Statistikdaten
- klare Selektoren für Bedarf, Kapazität, Altersgruppen und Buchungsverteilungen
- Szenario-Änderungen deterministisch und testbar
- weniger implizite Kopplung zwischen Overlays, Charts und Detailformularen

## 3. UI modernisieren
Die Oberfläche wird auf Mantine UI umgestellt.

Ziele:
- konsistentere Komponentenbibliothek
- einfachere Formulare und Dialoge
- bessere Wartbarkeit
- geringere Abhängigkeit von mehreren Design- und UI-Paketen

Geplante UI-Bausteine:
- App Shell mit Navigation
- Import-Ansicht
- Szenario-Ansicht
- Chart-Ansicht
- Ereignisverwaltung für manuelle und automatische Dates of Interest

## 4. Diagramme verbessern
Alle Diagramme erhalten:
- kontrastreichere Farbpalette
- klare Legenden
- verständliche Achsenbeschriftungen
- konsistente Filter
- robustes Verhalten bei leeren Daten

## Umsetzungsphasen
### Phase 0: Sicherheitsnetz aufbauen
- Test-Setup mit Vitest und React Testing Library einführen
- Playwright für End-to-End-Tests ergänzen
- erste Regressionstests für Import und Kernansichten anlegen
- GitHub Actions vorbereiten

### Phase 1: Finanzbereich vollständig entfernen
- Finanzkomponenten, Finanzmodelle und Finanz-Slices ausbauen
- Referenzen in Charts, Speichern/Laden und Overlay-Logik bereinigen
- Projekt auf die vier Kernansichten reduzieren
- ungenutzte Pakete entfernen

### Phase 2: Import- und Fachlogik härten
- STATUS-Filter auf + verbindlich umsetzen
- Stichtagslogik vereinheitlichen
- Alterskategorien in 3-Monats-Schritten berechnen
- nur aktive, fachlich gültige Buchungen übernehmen
- pädagogische und administrative Arbeitszeitblöcke trennen

### Phase 3: Dates of Interest neu strukturieren
- Generator für automatische Gruppenwechsel aufbauen
- Kennzeichnung automatisch generierter Ereignisse ergänzen
- Aktivieren und Deaktivieren pro Ereignis ermöglichen
- Integration in Szenarien und Statistikberechnung absichern

### Phase 4: Visualisierungen neu aufsetzen
- Regelbetrieb fachlich korrekt mit Bedarf und Kapazität je Stunde
- Alters-Histogramm fachlich korrekt in 3-Monats-Klassen
- Langzeitüberblick mit vorhandenen Zeitskalen stabilisieren
- Buchungsverteilung vereinfachen und visuell verbessern

### Phase 5: UI-Migration auf Mantine
- MUI-Komponenten schrittweise ablösen
- Dialoge, Navigation und Filter vereinheitlichen
- responsive und barriereärmere Darstellung sicherstellen

### Phase 6: Dokumentation und Releaseprozess
- README vollständig neu schreiben
- User-Dokumentation mit Importablauf, Szenarien und Diagrammdeutung ergänzen
- Release-Workflow für GitHub Releases einrichten
- Deployment nach GitHub Pages automatisieren

## Teststrategie
### Unit Tests
Abdeckung von:
- Datumslogik
- Importfilter
- Altersberechnung
- Stundenberechnung aus Zeitblöcken
- Szenario-Anpassungen
- automatische Ereignisgenerierung

### Regressionstests
Absicherung für:
- korrekten Import einer bekannten Beispieldatei
- unveränderte Statistikwerte für definierte Referenzdaten
- keine Berücksichtigung ungültiger Kinderstatus
- nur pädagogische Zeiten in Kapazitätskennzahlen

### End-to-End-Tests mit Playwright
Wichtige Journeys:
- Import eines Datenbestands
- Szenario anlegen und ändern
- automatisches Date of Interest deaktivieren
- Diagrammfilter bedienen
- Diagramme werden sichtbar und mit Daten gerendert

## Akzeptanzkriterien
Der Umbau gilt als erfolgreich, wenn:
- kein Finanzbereich mehr in UI, Store oder Logik aktiv ist
- die vier Kernansichten fachlich korrekt funktionieren
- Import nur Kinder mit STATUS + berücksichtigt
- automatisch erzeugte Gruppenwechsel sichtbar und einzeln deaktivierbar sind
- nur pädagogische Arbeitszeit in Kapazitätskennzahlen einfließt
- Test-Suite grün ist
- GitHub Release und GitHub Pages Deployment automatisiert laufen
- README und Anwenderdokumentation vollständig vorliegen

## Risiken und Gegenmaßnahmen
### Risiko: Finanzlogik ist tief mit bestehendem State verflochten
Gegenmaßnahme:
- erst Tests und Referenzfälle aufbauen
- danach schrittweise Entkopplung

### Risiko: Diagramme zeigen nach Vereinfachung falsche Werte
Gegenmaßnahme:
- Referenzdatensätze definieren
- Import- und Chartregeln mit Regressionstests absichern

### Risiko: UI-Migration erzeugt viele Nebenfehler
Gegenmaßnahme:
- visuelle Umstellung getrennt von Fachlogik durchführen
- pro Ansicht einzeln migrieren

## Erste konkrete Arbeitspakete
1. Test- und CI-Grundgerüst einführen
2. Finanzabhängigkeiten identifizieren und isolieren
3. Importpfad mit STATUS-Filter auf + anpassen
4. Regelbetriebslogik auf pädagogische Kapazität ausrichten
5. automatische Gruppenwechsel erzeugen und verwaltbar machen
6. Mantine-basierte Basisoberfläche aufsetzen
7. Dokumentation und Release-Automation ergänzen
