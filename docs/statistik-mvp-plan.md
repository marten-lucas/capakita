# Statistik-Seite: MVP-Konzept und Umsetzungsplan

## Zielbild
Die neue Statistik-Seite zeigt ausschließlich historische Daten bis heute und ergänzt die bestehende Analyse-Seite (aktueller Stand + Zukunft).

## Scope und Verfügbarkeit
- Tab "Statistik" ist nur sichtbar, wenn Adebis-Daten importiert wurden.
- Datengrundlage: ausschließlich importierte Adebis-Daten, keine Simulations- oder Zukunftsdaten.
- Export umfasst einen Mandanten.

## Fachliche Festlegungen
- Zeitaggregation ist umschaltbar: Monat, Quartal, Jahr.
- Betreuungsstunden: geplante Betreuungsstunden.
- Gruppenübergänge: jeder Wechsel zählt.
- Delta-Fenster für Buchungszeit bei Übergängen: 90 Tage vor vs. 90 Tage nach Übergang.
- Übergangsalter: Durchschnitt, Median und Verteilung (Histogramm).

## KPI-Definitionen (MVP)
1. Kinderzahl historisch
- Anzahl aktiver Kinder pro Zeitbucket.

2. Buchungsstunden historisch
- Summe der Buchungsstunden pro Zeitbucket.

3. Betreuungsstunden historisch
- Summe geplanter Betreuungsstunden pro Zeitbucket.

4. Gruppenübergänge
- Anzahl Übergänge pro Zeitbucket.
- Alter beim Übergang (Durchschnitt, Median, Histogramm).
- Änderung der Buchungszeit am Übergang (Durchschnitt vorher/nachher, Delta absolut und Prozent).

## UI-Zuschnitt (MVP: 3 Charts + 1 Tabelle)
1. Chart A: Zeitreihe Kinderzahl
- Linienchart, X: Zeitbucket, Y: Anzahl Kinder.

2. Chart B: Zeitreihe Buchungs- und Betreuungsstunden
- Linienchart mit zwei Serien.

3. Chart C: Histogramm Übergangsalter
- Balkenchart (z. B. 3-Monats-Klassen).

4. Tabelle: Übergangsdetails
- Spalten: Kind-ID/Name, von Gruppe, zu Gruppe, Übergangsdatum, Alter (Monate), Buchungsstunden vorher, Buchungsstunden nachher, Delta Stunden, Delta Prozent.
- Sortierung und Filter nach Zeitraum/Gruppe.

## Filter (MVP)
- Zeitraum: Gesamt, letzte 12 Monate, letzte 24 Monate, frei wählbar.
- Aggregation: Monat, Quartal, Jahr.
- Gruppe/Übergangstyp: Alle oder ausgewählte Kombinationen.

## Technische Umsetzung
1. Datenableitung
- Neue Statistik-Selektoren für Zeitreihen und Übergänge.
- Bucketisierung nach Monat/Quartal/Jahr.
- Übergangserkennung je Kind anhand zeitlicher Gruppenwechsel.

Hinweis
- Die notwendige Import-Erweiterung ist in `docs/import-historical-spec.md` spezifiziert.

2. Store-Anbindung
- Feature-Gate aus Importstatus: Sichtbarkeit des Statistik-Tabs.
- Selektoren memoisiert (Reselect), um Re-Render und Rechenlast zu reduzieren.

3. UI-Integration
- Neue View-Komponente Statistik.
- Einbindung in Navigation nur bei erfülltem Gate.
- Highcharts-Konfiguration analog bestehender Diagrammstandards.

4. Export
- Statistikexport basiert auf denselben abgeleiteten Daten wie die Seite.
- Exportformat MVP: CSV (Zeitreihen + Übergangstabelle).

## Akzeptanzkriterien
- Ohne Adebis-Import ist der Statistik-Tab nicht sichtbar.
- Mit Adebis-Import werden historische Werte bis heute angezeigt.
- Umschaltung Monat/Quartal/Jahr aktualisiert alle Diagramme konsistent.
- Übergänge zeigen Alter, vorher/nachher und Delta mit 90-Tage-Regel.
- Exportwerte entsprechen den Werten der Statistik-Ansicht.

## Ticket-Backlog (priorisiert)

### T0 - Historischer Importmodus
Beschreibung
- Reader/Parser um `historical`-Modus erweitern, damit historische Kinder, Buchungen, Gruppen, Gruppenzuordnungen und Mitarbeitende importiert werden.
- Snapshot-Modus als Default beibehalten (Rückwärtskompatibilität).

Akzeptanzkriterien
- `snapshot` verhält sich unverändert.
- `historical` liefert abgelaufene Datensätze mit Importwarnungen/Konflikten.

Tests
- Unit- und Regressionstests gemäß `docs/import-historical-spec.md`.

### T1 - Feature-Gate Statistik-Tab
Beschreibung
- Importstatus-Selektor nutzen und Tab nur bei vorhandenem Adebis-Import anzeigen.

Akzeptanzkriterien
- Tab nicht sichtbar ohne Import.
- Tab sichtbar nach erfolgreichem Import.

Tests
- Unit-Test für Gate-Selektor.
- E2E-Test für Sichtbarkeit.

### T2 - Historische Bucket-Engine (Monat/Quartal/Jahr)
Beschreibung
- Zeitbucket-Erzeugung und Aggregation für Kinderzahl, Buchungsstunden, Betreuungsstunden.

Akzeptanzkriterien
- Korrekte Buckets je Aggregationsstufe.
- Konsistente Summen über identischen Zeitraum.

Tests
- Unit-Tests für Bucketisierung und Summenbildung.

### T3 - Übergangserkennung je Kind
Beschreibung
- Gruppenwechsel chronologisch erkennen und Übergangsereignisse ableiten.

Akzeptanzkriterien
- Jeder tatsächliche Wechsel erzeugt ein Übergangsereignis.
- Keine Duplikate bei stabilen Zuständen.

Tests
- Unit-Tests für Mehrfachwechsel und Randfälle.

### T4 - Übergangsmetriken (Alter + 90-Tage-Delta)
Beschreibung
- Alter beim Übergang in Monaten berechnen.
- Buchungsstunden 90 Tage vor/nach Übergang aggregieren und Delta berechnen.

Akzeptanzkriterien
- Durchschnitt und Median korrekt.
- Delta absolut und Prozent korrekt bei fehlenden Werten robust.

Tests
- Unit-Tests für Rechenlogik und Edge Cases.

### T5 - Statistik-View MVP
Beschreibung
- Neue View mit 3 Charts, 1 Tabelle, Filtern und KPI-Kopfzeile.

Akzeptanzkriterien
- Alle Komponenten reagieren auf Filter.
- Leerdatenzustand und Ladezustand sind nutzerfreundlich.

Tests
- Komponententests für Filter und Rendering.

### T6 - Export MVP (CSV)
Beschreibung
- CSV-Export für Zeitreihen und Übergangsdetails aus denselben Selektoren.

Akzeptanzkriterien
- Export enthält gefilterte Ansicht.
- Zahlen identisch zu Tabellen-/Chartdaten.

Tests
- Unit-Tests für Export-Mapping.

### T7 - Dokumentation und Fachhilfe
Beschreibung
- Kurze KPI-Definitionen und Tooltip-Hilfen in UI.
- Ergänzung User Guide um Statistik-Seite.

Akzeptanzkriterien
- Fachbegriffe in der UI eindeutig erklärt.
- Doku deckt Filter, Kennzahlen und Export ab.

Tests
- Redaktionsreview.

## Lieferreihenfolge (Sprint-vorschlag)
1. Sprint 1: T0, T1
2. Sprint 2: T2, T3
3. Sprint 3: T4, T5
4. Sprint 4: T6, T7
