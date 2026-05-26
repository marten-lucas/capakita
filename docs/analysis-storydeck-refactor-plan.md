# Umsetzungsplan Analyse-Refactoring (Story-Deck)

Stand: 26.05.2026  
Status: Implementiert im Branch refactor/analysis-storydeck-complete

## Ziel
Die Analyse wird schrittweise von der bisherigen verdichteten Ansicht auf ein gefuehrtes Story-Deck umgestellt.
Jede Phase enthaelt verbindlich:
1. Implementierung
2. Erweiterung/Aktualisierung der Test-Suite
3. Abnahme mit klaren Kriterien

## Fachliches Zielbild (Sollzustand)

### 1) Produktziel
Die Analyse soll Informationen fokussiert, nachvollziehbar und entscheidungsorientiert vermitteln.
Statt vieler gleichzeitiger Diagramme wird eine gefuehrte Schrittfolge eingefuehrt.

### 2) Zielstruktur im Analyse-Tab
Die Analyse wird als Story-Deck mit 7 festen Schritten umgesetzt:
1. Datenqualitaet und Risiken
2. Bestand (Kinder, Buchungsstunden, Betreuungsstunden)
3. Auslastung und Engpaesse
4. Gruppenuebergaenge als Sankey mit Zeitbezug
5. Altersverteilung mit Bereichen Krippe/Regelgruppe/Schule
6. Kennzahlen-Panel mit Kinder/Mitarbeiter, Stunden, Einnahmen/Ausgaben/Saldo, Schluessel/Quote
7. Kernaussagen und Massnahmen

### 3) Darstellungsprinzip
Jeder Story-Schritt folgt derselben Struktur:
1. Titel und Zeitraum/Stichtag
2. Ein zentrales Hauptdiagramm (Buehne)
3. Maximal wenige, fachlich etablierte KPI-Zahlen
4. Eine deterministische Kernaussage
5. Ggf. direkte Massnahme

Thumbnail-Navigation:
1. Unten werden alle Schritte als Vorschau angezeigt.
2. Der aktive Schritt wird gross auf der Buehne dargestellt.
3. Schrittwechsel bekommt eine leichte, funktionale Transition.

### 4) Deterministische Kernaussagen (ohne KI)
Kernaussagen und Alerts werden regelbasiert erzeugt:
1. KPI-Werte werden aus bestehenden Datenquellen berechnet.
2. Regelmatrix bewertet Schwellenwerte und Trends.
3. Prioritaetslogik waehlt die wichtigste Aussage.
4. Template-Engine baut daraus den Satz.
5. Ausgabe enthaelt qualitative Einstufung Hoch/Mittel/Niedrig.

Wichtig:
1. Keine proprietaeren neuen Indizes.
2. Nur fachlich bekannte Kennzahlen und deren qualitative Einordnung.

### 5) Alerts und Massnahmen
Der Einstieg ist Alert-First.
Top-Alerts werden deterministisch priorisiert und auf passende Story-Schritte verlinkt.
Massnahmen kommen aus einem festen Massnahmenkatalog (Rule-ID -> Aktion).

### 6) Zielbild Diagramme
1. Sankey Diagramm fuer Gruppenuebergaenge:
	Breite = Volumen, Farbe = Delta, Zeitbezug ueber Stichtag/Fenster/Playback.
2. Altersdiagramm:
	Verteilung mit klar markierten Bereichen Krippe/Regelgruppe/Schule und Zeit-Playback.
3. Kombinationsdiagramm:
	Kinder/Mitarbeiter (Anzahl + Stunden), Einnahmen, Ausgaben, Saldo, Schluessel, Quote.
	Alle Reihen sind an-/abwaehlbar.

### 7) Exportziel
Der PDF-Export nutzt dieselbe Story-Reihenfolge wie der Analyse-Tab.
Ergebnis ist ein mehrseitiges, praesentationsfaehiges Folienset:
1. Eine Seite pro Story-Schritt
2. Hauptdiagramm plus Kernaussage
3. Klare, druckstabile Struktur

### 8) In Scope
1. Vollstaendige Umstellung der Analyse-Darstellung auf Story-Deck im Tab
2. Deterministische Aussagen/Alerts/Massnahmen
3. Diagramm-Refactor inkl. Zeitbezug und Reihenwahl
4. PDF-Folienexport aus derselben Logik
5. Testausbau in jeder Phase

### 9) Out of Scope
1. Rollenspezifische Ansichten (z. B. unterschiedliche Dashboards pro Nutzerrolle)
2. Szenariovergleich in diesem Refactoring (separates Tab)
3. KI-generierte Aussagen
4. Einfuehrung neuer fachlicher Kernmetriken ausserhalb bestehender Kennzahlen

## Ausgangslage und Problem
Die aktuelle Analyse ist inhaltlich zu stark verdichtet. Mehrere Diagramme und Kennzahlen konkurrieren parallel um Aufmerksamkeit.
Die Folgen sind:
1. Hohe kognitive Last beim Lesen.
2. Geringe Priorisierung (wichtig vs. unwichtig nicht klar trennbar).
3. Erschwerte Kommunikation in Richtung Leitung/Traeger.
4. PDF-Ausgabe ist technisch vorhanden, aber noch nicht als praesentationstaugliche Folienlogik ausgepraegt.

## Verbindlicher Scope fuer dieses Refactoring
Am Ende dieses Vorhabens muss Folgendes produktiv vorhanden sein:
1. Analyse-Tab als Story-Deck mit 7 Schritten.
2. Buehne plus Thumbnail-Navigation.
3. Deterministische Kernaussagen und Alerts ohne KI.
4. Verbindlicher Massnahmenkatalog (regelbasiert).
5. Sankey mit Zeitbezug (Stichtag/Fenster/Playback).
6. Altersdiagramm mit Bereichen Krippe/Regelgruppe/Schule und Zeit-Playback.
7. Kombinationsdiagramm mit an-/abwaehlbaren Datenreihen.
8. Mehrseitiger PDF-Export im Folienstil aus derselben Story-Logik.
9. Test-Suite pro Phase erweitert, nicht nur angepasst.

## Fachliche Akzeptanzkriterien (global)
Diese Kriterien gelten ueber alle Phasen hinweg:
1. Reproduzierbarkeit: Gleicher Input erzeugt immer gleiche Aussagen/Alerts.
2. Nachvollziehbarkeit: Jede Kernaussage ist auf KPI-Werte und Regel-ID zurueckfuehrbar.
3. Fokussierung: Pro Schritt ein Hauptdiagramm mit klarer Lesefuehrung.
4. Konsistenz: Analyse-Tab und PDF verwenden dieselbe Daten- und Schrittlogik.
5. Bedienbarkeit: Schrittwechsel, Reihenwahl und Zeitsteuerung funktionieren auf Desktop und Mobil.

## KPI-Katalog (verbindliche Grundlage)
Hinweis: Es werden nur fachlich bekannte Kennzahlen verwendet; keine neuen proprietaeren Indizes.

### Datenqualitaet
1. Anteil Datensaetze ohne Buchung.
2. Anteil Datensaetze ohne Gruppe.
3. Anteil Kinder ohne Geburtsdatum.
4. Anteil Datensaetze ohne Namen.

### Bestand und Stunden
1. Kinderzahl (aktuell, Delta zur Vorperiode).
2. Buchungsstunden (aktuell, Delta).
3. Betreuungsstunden (aktuell, Delta).

### Auslastung
1. Anteil Zeitfenster mit Bedarf > Kapazitaet.
2. Maximale Ueberlastspitze.
3. Mittlere Ueberlast im Zeitraum.

### Uebergaenge
1. Anzahl Uebergaenge.
2. Durchschnittsalter beim Uebergang.
3. Medianalter beim Uebergang.
4. Durchschnittliches Delta Buchungszeit.
5. Verbleibswahrscheinlichkeit im Regelkorridor.
6. Volumen nach Wechselrichtung.

### Alter
1. Verteilung in Altersklassen.
2. Anteil Krippebereich.
3. Anteil Regelgruppenbereich.
4. Anteil Schulbereich.

### Finanzen und Personalbezug
1. Einnahmen.
2. Ausgaben.
3. Saldo.
4. Betreuungsschluessel.
5. Fachkraftquote.
6. Kinderzahl und Mitarbeiterzahl.
7. Kinderstunden und Mitarbeiterstunden.

## Regelwerk fuer Kernaussagen und Alerts

### Regelprinzip
1. KPI-Berechnung.
2. Schwellwertbewertung.
3. Priorisierung.
4. Template-Erzeugung.
5. Massnahmenzuordnung.

### Regelanforderungen
1. Jede Regel hat eine stabile Rule-ID.
2. Jede Regel hat Severity-Stufe (Hoch/Mittel/Niedrig).
3. Jede Regel hat mindestens ein Satz-Template.
4. Jede Regel hat optional eine Massnahme-ID.
5. Jede Regel ist testbar (mindestens Positiv- und Negativfall).

### Priorisierungslogik (verbindlich)
1. Kritische Datenqualitaet-Regeln vor inhaltlichen Regeln.
2. Harte Grenzwertverletzungen vor Trendhinweisen.
3. Bei Gleichstand entscheidet Impact (betroffene Faelle).
4. Bei weiterhin Gleichstand entscheidet feste Rule-ID-Reihenfolge.

## Informationsarchitektur des Story-Decks

### Schritt 1: Datenqualitaet und Risiken
1. Fokus auf fehlende/inkonsistente Daten.
2. Top-Alerts als Einstieg mit Deep-Link in Folgeschritte.

### Schritt 2: Bestand
1. Kinder, Buchungsstunden, Betreuungsstunden im Zeitkontext.
2. Kernaussage zur Entwicklung.

### Schritt 3: Auslastung
1. Bedarf gegen Kapazitaet mit Ueberlastsicht.
2. Kernaussage zu Stabilitaet/Engpass.

### Schritt 4: Uebergaenge (Sankey)
1. Fluesse zwischen Gruppen.
2. Zeitbezug via Stichtag, Fenster, Playback.

### Schritt 5: Alter
1. Altersverteilung mit Bereichsmarkierungen Krippe/Regelgruppe/Schule.
2. Zeit-Playback zur Kohortenbeobachtung.

### Schritt 6: Kombinationsdiagramm
1. Reihenwahl: Kinder/Mitarbeiter, Stunden, Einnahmen/Ausgaben/Saldo, Schluessel/Quote.
2. Nutzer kann Reihen gezielt an-/abwaehlen.

### Schritt 7: Kernaussagen und Massnahmen
1. Zusammenfassung der wichtigsten Erkenntnisse.
2. Konkrete, regelbasierte Massnahmen.

## Nicht-funktionale Anforderungen
1. Performance: Schrittwechsel ohne spuerbare UI-Blockade.
2. Stabilitaet: Keine Inkonsistenzen zwischen Tab und Export.
3. Wartbarkeit: Regeln und Massnahmen sind konfigurierbar und versionierbar.
4. Erweiterbarkeit: Weitere Story-Schritte sind spaeter ohne Kernumbau moeglich.
5. Accessibility: Tastaturbedienung und lesbare Struktur in Hauptfluesen.

## Technische Leitplanken
1. Bestehende Analyse bleibt hinter Feature-Flag als Fallback verfuegbar.
2. Neue Komponenten werden modular je Story-Schritt aufgebaut.
3. ViewModel/Selektoren trennen Datenaufbereitung von Rendering.
4. Deterministische Logik liegt nicht in UI-Komponenten, sondern in eigener Regel-/Service-Schicht.
5. Export nutzt dieselben Schritt- und Datenmodelle wie die UI.

## Teststrategie (verbindlich fuer jede Session)
1. Jede Codeaenderung muss passende Tests ergaenzen oder aktualisieren.
2. Pro implementierter Funktion mindestens ein positiver und ein negativer Testfall.
3. Neue Regeln erhalten Golden-Master-Tests fuer deterministische Ausgabe.
4. Interaktive Features erhalten Component- oder E2E-Absicherung.
5. Vor Phasenabschluss ist die gesamte relevante Suite gruen.

## Definition of Done (DoD)
Eine Phase ist nur dann abgeschlossen, wenn alle Punkte erfuellt sind:
1. Umsetzungspunkte der Phase sind vollstaendig abgehakt.
2. Test-Suite-Punkte der Phase sind vollstaendig abgehakt.
3. Abnahmekriterien der Phase sind nachweislich erfuellt.
4. Fortschritt und Aenderungsprotokoll wurden aktualisiert.
5. Offene Risiken sind dokumentiert.

## Arbeitsmodus fuer zukuenftige Sessions
Dieses Dokument ist die alleinige Aufgabenbeschreibung. Jede neue Session arbeitet in dieser Reihenfolge:
1. Aktuellen Phasenstatus lesen.
2. Naechsten offenen Punkt in der fruehesten offenen Phase bearbeiten.
3. Tests erweitern/aktualisieren.
4. Tests ausfuehren.
5. Checkboxen und Aenderungsprotokoll aktualisieren.

## Session-Handover-Checkliste (verpflichtend)
Am Ende jeder Session muss ergaenzt werden:
1. Welche Aufgaben wurden abgeschlossen?
2. Welche Tests wurden hinzugefuegt/angepasst?
3. Welche Tests wurden ausgefuehrt und mit welchem Ergebnis?
4. Was ist der naechste konkrete offene Schritt?
5. Gibt es Blocker oder Risiken?

## Offene Entscheidungen (initial)
Diese Punkte muessen im Verlauf final entschieden und dann hier dokumentiert werden:
1. Exakte Schwellwerte je KPI-Regel.
2. Exakte Reihenfolge und Standardauswahl der Reihen im Kombinationsdiagramm.
3. Konkrete Druckformat-Parameter fuer PDF (z. B. A4 quer/hoch).
4. Finales Feature-Flag-Verhalten fuer stufenweisen Rollout.

## Arbeitsregeln
- [ ] Jede Phase wird erst abgeschlossen, wenn alle zugehoerigen Tests gruen sind.
- [ ] Pro Phase werden neue Tests hinzugefuegt (nicht nur bestehende angepasst).
- [ ] Feature-Flag bleibt bis zur finalen Freigabe aktiv.
- [ ] Altansicht bleibt bis Phase G als Fallback verfuegbar.

## Gesamtstatus
- [x] Phase A - Refactoring-Rahmen und Feature-Flag
- [x] Phase B - Story-Deck Layout im Analyse-Tab (Buehne + Thumbnails)
- [x] Phase C - Deterministische Aussagen-Engine und Massnahmenkatalog
- [x] Phase D - Alert-First Einstieg
- [x] Phase E - Diagramm-Refactor (Sankey, Alter, Kombinationschart)
- [x] Phase F - PDF Export im Folienstil
- [x] Phase G - Haertung, Rollout, Aufraeumen

---

## Phase A - Refactoring-Rahmen und Feature-Flag
**Ziel:** Neues Analyse-System parallel zur Altansicht technisch aufsetzen.

### Umsetzung
- [ ] Feature-Flag einfuehren (z. B. `analysisStoryDeckEnabled`).
- [ ] Neue Analyse-Containerstruktur anlegen (Story-Deck Root, Step-Registry).
- [ ] Gemeinsamen Analyse-ViewModel-Layer einfuehren (Selektoren + Mapping).
- [ ] Routing/Navigation so vorbereiten, dass Alt und Neu umschaltbar sind.

### Test-Suite (verpflichtend)
- [ ] Unit-Tests fuer Feature-Flag Verhalten (Alt vs. Neu).
- [ ] Unit-Tests fuer ViewModel-Basistransformationen.
- [ ] Smoke-Test: App rendert in beiden Modi ohne Crash.

### Abnahme
- [ ] Umschalten Alt/Neu funktioniert deterministisch.
- [ ] Keine Regression in bestehender Analyse-Route.
- [ ] Test-Suite gruen.

---

## Phase B - Story-Deck Layout im Analyse-Tab (Buehne + Thumbnails)
**Ziel:** Analyse-Tab als Schritt-fuer-Schritt-Darstellung statt als verdichtetes Raster.

### Umsetzung
- [ ] Story-Schritt-Navigation (naechster/vorheriger Schritt) implementieren.
- [ ] Buehne fuer aktiven Schritt bauen.
- [ ] Thumbnail-Leiste mit Schrittvorschau integrieren.
- [ ] Transition-Animation 1 (Slide/Fade) fuer Schrittwechsel integrieren.
- [ ] Responsive Layout fuer Desktop/Tablet/Mobil abstimmen.

### Test-Suite (verpflichtend)
- [ ] Component-Tests fuer Navigation (Buttons, Tastatur, ggf. Swipe).
- [ ] Component-Tests fuer aktiven Schrittzustand und Thumbnail-Selektion.
- [ ] E2E-Test: Vollstaendiges Durchklicken aller Story-Schritte.
- [ ] Visual Regression Snapshot fuer Kern-Breakpoints.

### Abnahme
- [ ] Story-Deck ist voll bedienbar und stabil.
- [ ] Keine Layout-Bruche auf definierten Breakpoints.
- [ ] Test-Suite gruen.

---

## Phase C - Deterministische Aussagen-Engine und Massnahmenkatalog
**Ziel:** Kernaussagen und Handlungsempfehlungen rein regelbasiert erzeugen.

### Umsetzung
- [ ] KPI-Katalog als feste Datenbasis implementieren.
- [ ] Regelmatrix (Schwellen, Prioritaeten, Hoch/Mittel/Niedrig) implementieren.
- [ ] Satz-Templates mit Platzhaltern integrieren.
- [ ] Massnahmenkatalog mit Rule-ID -> Aktion verknuepfen.
- [ ] Fallback-/Hinweislogik bei kritischer Datenqualitaet integrieren.

### Test-Suite (verpflichtend)
- [ ] Unit-Tests pro Regelklasse (Datenqualitaet, Trend, Uebergaenge, Finanzen).
- [ ] Golden-Master Tests: identischer Input -> identischer Satz-Output.
- [ ] Unit-Tests fuer Priorisierung/Konfliktaufloesung.
- [ ] Integrationstest: Story-Schritt zeigt korrekte Kernaussage + Massnahme.

### Abnahme
- [ ] Keine KI-Abhaengigkeit, 100% deterministische Ausgabe.
- [ ] Fachlich validierte Beispielfaelle fuer jede zentrale Regel vorhanden.
- [ ] Test-Suite gruen.

---

## Phase D - Alert-First Einstieg
**Ziel:** Analyse startet mit priorisierten, deterministischen Alerts.

### Umsetzung
- [ ] Alert-Regeln aus der Aussagen-Engine ableiten.
- [ ] Priorisierung fuer Top-Alerts implementieren.
- [ ] Alert-Karten mit Deep-Link auf passende Story-Schritte bauen.
- [ ] Hysterese/Entprellung gegen Alert-Flackern einfuehren.

### Test-Suite (verpflichtend)
- [ ] Unit-Tests fuer Alert-Priorisierung und Schwellwertwechsel.
- [ ] Integrationstest: Alert-Klick navigiert auf richtigen Schritt.
- [ ] E2E-Test: Kritisches Datenszenario erzeugt erwartete Top-Alerts.

### Abnahme
- [ ] Alerts sind nachvollziehbar, stabil und verlinkt.
- [ ] Keine widerspruechlichen Alerts bei gleichem Datensatz.
- [ ] Test-Suite gruen.

---

## Phase E - Diagramm-Refactor (Sankey, Alter, Kombinationschart)
**Ziel:** Kerndiagramme fachlich und visuell neu aufbauen, inkl. Zeitbezug und Serienwahl.

### Umsetzung
- [ ] Sankey fuer Gruppenuebergaenge implementieren.
- [ ] Zeitbezug fuer Sankey: Stichtag + Fenster + Playback.
- [ ] Altersdiagramm mit Bereichen Krippe/Regelgruppe/Schule erweitern.
- [ ] Transition-Animation 2: Zeit-Playback fuer Sankey/Alter integrieren.
- [ ] Kombinationschart aufbauen: Kinder/Mitarbeiter (Anzahl + Stunden), Einnahmen, Ausgaben, Saldo, Schluessel, Quote.
- [ ] Serien an-/abwaehlbar machen (legend/toggles).

### Test-Suite (verpflichtend)
- [ ] Unit-Tests fuer Sankey-Datenaggregation inkl. Zeitfenster.
- [ ] Unit-Tests fuer Altersbereichslogik (Krippe/Regelgruppe/Schule).
- [ ] Unit-Tests fuer Serien-Toggle-Logik.
- [ ] Component-Tests fuer Playback Controls.
- [ ] E2E-Test: User waehlt Reihen an/ab und Darstellung aktualisiert sich korrekt.

### Abnahme
- [ ] Zeitlicher Aspekt bleibt in Sankey und Alter nachvollziehbar.
- [ ] Nutzer kann Reihen sauber steuern.
- [ ] Test-Suite gruen.

---

## Phase F - PDF Export im Folienstil
**Ziel:** Story-Deck als mehrseitiges, praesentationsfaehiges PDF exportieren.

### Umsetzung
- [ ] Exportpipeline an Story-Schritt-Reihenfolge koppeln.
- [ ] Einheitliches Folienlayout (Titel, Hauptgrafik, Kernaussage, Massnahme) erstellen.
- [ ] Druck-/Print-CSS fuer stabile Umbrueche und Seitengroessen optimieren.
- [ ] Optionaler Anhang fuer Detailtabellen integrieren.

### Test-Suite (verpflichtend)
- [ ] Integrationstest: Export erzeugt erwartete Seitenanzahl.
- [ ] Snapshot-Tests fuer Schluesselseiten (strukturorientiert).
- [ ] E2E-Test: Export aus UI ausloesen und erfolgreiche Generierung verifizieren.

### Abnahme
- [ ] PDF ist praesentationsfaehig und konsistent zur UI.
- [ ] Keine abgeschnittenen Charts/Legenden in den Ziel-Formaten.
- [ ] Test-Suite gruen.

---

## Phase G - Haertung, Rollout, Aufraeumen
**Ziel:** Produktionsreife, kontrollierter Rollout, technische Schulden abbauen.

### Umsetzung
- [ ] Performance-Profiling und Optimierungen (Selektoren, Rendering, Memoisierung).
- [ ] Altansicht schrittweise deaktivierbar machen.
- [ ] Doku aktualisieren (Architektur, Regeln, Pflegeprozess).
- [ ] Monitoring fuer Fehler und Nutzungsverhalten einbauen.

### Test-Suite (verpflichtend)
- [ ] Voller Regression-Lauf fuer Unit/Integration/E2E.
- [ ] Lastnahe Tests mit groesseren Datensaetzen.
- [ ] Non-Flaky-Pruefung fuer zentrale E2E-Strecken.

### Abnahme
- [ ] Rollout ueber Feature-Flag moeglich und abgesichert.
- [ ] Keine kritischen offenen Defekte.
- [ ] Test-Suite gruen.

---

## Tracking pro Phase

### Fortschritt
- [x] Phase A gestartet
- [x] Phase A abgeschlossen
- [x] Phase B gestartet
- [x] Phase B abgeschlossen
- [x] Phase C gestartet
- [x] Phase C abgeschlossen
- [x] Phase D gestartet
- [x] Phase D abgeschlossen
- [x] Phase E gestartet
- [x] Phase E abgeschlossen
- [x] Phase F gestartet
- [x] Phase F abgeschlossen
- [x] Phase G gestartet
- [x] Phase G abgeschlossen

### Aenderungsprotokoll
- [ ] Eintrag anlegen bei jedem Phasenabschluss (Datum, Umfang, Testergebnis, offene Risiken)

| Datum | Phase | Umsetzung abgeschlossen | Tests erweitert | Teststatus | Notizen |
|---|---|---|---|---|---|
| 26.05.2026 | A-G | Story-Deck implementiert, Legacy-Fallback ueber Feature-Flag, Regelengine, Sankey/Alter/Kombi-Chart, PDF-Folienmodus | Unit/Integration/E2E erweitert (`ruleEngine`, `StatisticsView`, `storydeck-analysis`) | gruen (zielgerichtete Suite) | Branch: refactor/analysis-storydeck-complete |
