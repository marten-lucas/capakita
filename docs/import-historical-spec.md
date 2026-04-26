# Historischer Adebis-Import: Technische Spezifikation

## Ziel
Der Import soll nicht nur aktuelle/zukuenftige Datensaetze liefern, sondern historische Verlaeufe fuer Statistik und Export bereitstellen.

## Aktueller Stand
Aktuell filtert der Reader viele Datensaetze auf aktiv/heute-relevant:
- Kinder: nur STATUS `+` und Austritt in Zukunft oder leer.
- Mitarbeitende: nur Enddatum in Zukunft oder leer.
- Gruppenzuordnung und Buchung: nur Enddatum in Zukunft oder leer.

Damit fehlen historische Datenpunkte fuer Zeitreihen und Uebergangsanalysen.

## Zielmodell fuer Importdaten

### 1. Kinder (kind.xml)
Import aller Datensaetze mit Mindestfeldern:
- KINDNR, AUFNDAT, AUSTRDAT, GRUNR, GEBDATUM, FNAME, STATUS

Regeln:
- Keine Vorfilterung auf aktuelles Datum.
- STATUS wird als fachliches Merkmal gespeichert, nicht als Import-Blocker.
- Bei fehlendem Namen Fallback auf `Kind <KINDNR>`.

### 2. Buchungen (belegung.xml)
Import aller Buchungen mit:
- IDNR, KINDNR, BELVON, BELBIS, ZEITEN

Regeln:
- Keine Vorfilterung auf BELBIS.
- Ungueltige ZEITEN-Strings werden nicht verworfen, sondern als Import-Warnung markiert.
- Nur Buchungen mit mindestens einem parsebaren Segment fliessen in die operative Stundenaggregation ein.

### 3. Gruppen (gruppe.xml)
Import aller Gruppen:
- GRUNR, BEZ

Regeln:
- Keine zeitliche Filterung.
- Ikonisierung bleibt wie bisher.

### 4. Gruppenzuordnungen (gruki.xml)
Import aller Zuordnungen:
- KINDNR, GRUNR, GKVON, GKBIS

Regeln:
- Keine Vorfilterung auf GKBIS.
- Ueberlappungen je Kind werden nicht geloescht, aber als Konflikt markiert.

### 5. Mitarbeitende (anstell.xml)
Import aller Mitarbeitenden:
- IDNR, BEGINNDAT, ENDDAT, ARBZEIT, URLAUB, QUALIFIK, VERTRAGART, ZEITEN

Regeln:
- Keine Vorfilterung auf ENDDAT.
- Zeitsegmente analog Kinderbuchungen behandeln.

## Erweiterungen im Datentransferobjekt

### Importmodus
Reader und Parser erhalten einen Modus:
- `snapshot` (bestehend, kompatibel): aktuelles Verhalten.
- `historical` (neu): keine Enddatum-Filter, volle Historie.

Vorschlag Signatur:
- `extractAdebisData(file, isAnonymized, options)`
- `options.mode = 'snapshot' | 'historical'`

### Import-Metadaten
Rueckgabe um Metadaten erweitern:
- `importMeta.mode`
- `importMeta.generatedAt`
- `importMeta.warnings[]`
- `importMeta.conflicts[]`

Beispiele Warnungen:
- unparsebare ZEITEN
- fehlende Pflichtfelder

Beispiele Konflikte:
- ueberlappende Gruppenzuordnungen je Kind
- identische Datensaetze mit abweichenden Nutzdaten

## Harmonisierung und Konfliktregeln

### Zeitintervall-Normalisierung
- Leeres Startdatum: gilt ab `0001-01-01` fuer Berechnung.
- Leeres Enddatum: gilt bis `9999-12-31` fuer Berechnung.
- Speicherung bleibt im Originalformat (`''` erlaubt), Normalisierung nur in Selektoren.

### Deduplizierung
- Kinder: Schluessel `KINDNR` + Start/Ende + STATUS.
- Buchungen: Schluessel `KINDNR` + BELVON + BELBIS + ZEITEN.
- Gruppenzuordnung: Schluessel `KINDNR` + `GRUNR` + `GKVON` + `GKBIS`.
- Mitarbeitende: Schluessel `IDNR` + BEGINNDAT + ENDDAT.

Regel:
- Identische Schluessel werden zusammengefuehrt.
- Abweichende Nutzdaten bei gleichem Schluessel erzeugen Konfliktmeldung.

## Ableitungsregeln fuer Statistik

### Aktive Kinder pro Bucket
Ein Kind ist im Bucket aktiv, wenn Intervall(KIND) den Bucket schneidet und STATUS nicht explizit ausgeschlossen ist.

### Buchungsstunden pro Bucket
Nur parsebare Segmente in Intervallen, die den Bucket schneiden.

### Betreuungsstunden pro Bucket
MVP-Definition: geplante Stunden aus Segmenten.

### Gruppenuebergaenge
Erkennung ueber chronologische Gruppenzuordnungen je Kind:
- Jeder Wechsel von Gruppe A nach Gruppe B zaehlt.
- Alter beim Wechsel = Differenz(Wechseldatum, GEBDATUM) in Monaten.
- Buchungsdelta = Mittelwert 90 Tage davor vs. 90 Tage danach.

## API-/Code-Delta (konkret)

1. Reader
- Datei: `src/utils/adebis-reader.js`
- Neue Option `mode`, Snapshot als Default fuer Rueckwaertskompatibilitaet.
- Filterfunktionen fuer Kinder/Mitarbeitende/Buchungen/Gruki auf Modus umstellen.

2. Parser
- Datei: `src/utils/adebis-parser.js`
- Parser unveraendert kompatibel halten, aber Warnungs- und Konfliktcontainer mitfuehren.
- ZEITEN-Parser um strukturierte Fehler erweitern (kein stilles Schlucken).

3. Scenario-Import
- Datei: `src/store/simScenarioSlice.js`
- Import-Metadaten im Szenario speichern, z. B. `importMode`, `importWarningsCount`.

4. Selektoren fuer Statistik
- Neue Datei (Vorschlag): `src/store/statisticsSelectors.js`
- Bucket-Engine + Transition-Engine auf historischer Basis.

## Tests (MVP-verbindlich)

### Unit
1. Reader-Modus `snapshot` bleibt unveraendert.
2. Reader-Modus `historical` importiert auch abgelaufene Datensaetze.
3. ZEITEN-Warnungen werden erzeugt, ohne Importabbruch.
4. Konflikte bei ueberlappenden Gruppenzuordnungen werden erkannt.

### Regression
1. Bestehender Importtest in `src/utils/adebis-import.test.js` bleibt gruen im `snapshot`-Modus.
2. Neuer Testblock fuer `historical` mit mindestens einem Datensatz, der historische Enddaten enthaelt.

### E2E
1. Statistik-Tab nur sichtbar bei Import mit `imported=true`.
2. Historische Zeitreihe zeigt Werte vor dem heutigen Datum.

## Rollout-Strategie
1. Phase A: Reader-Modus und Metadaten einbauen (ohne UI-Aenderung).
2. Phase B: Statistik-Selektoren gegen `historical`-Daten implementieren.
3. Phase C: UI + Export auf neue Selektoren schalten.
4. Phase D: Snapshot-Modus optional abschaltbar machen, wenn keine Altszenario-Abhaengigkeit mehr besteht.
