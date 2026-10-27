# Konzept: Bedarfsdeckung – Histogramme, Förder-Simulation, Betroffenheitsanalyse

Status: **UMGESETZT (v2, 26.10.2026)** · Basis: Code-Ist-Analyse + Reverse-Engineering adebisKITA 7.5.5
(`adebis-re/docs/`)

## Umsetzung (26.10.2026)

| Phase | Umsetzung | Tests |
|---|---|---|
| A1 Buchungsstunden-Histogramm | Neuer Slide `hours-hist` im Bedarfsdeckung-Karussell; `BookingHistogram` prop-gesteuert (Store-Selector bleibt Fallback); Gruppen-Select im Slide | VisuView-Regression |
| A2 Buchungskategorien-Histogramm | `chartUtilsZeitkat.calculateZeitkatDistribution` (children/bookings-Modi, nur Basisbuchungen, „ohne Kategorie"-Bucket) + Slide `kategorie-hist` mit Zeitfaktor-Tooltip | `chartUtilsZeitkat.test.js` (4) |
| B Förderformel-Korrektur | `financeUtils.resolveZeitkatFactorForChild` + `applyZeitkatFactor`-Parameter in `calculateChildMonthlyRevenue` — **bewusst default OFF** (Decision: KPI-Sprung „später machen"); Simulation rechnet immer mit Faktor | `adebisFoerder.test.js` (10) |
| C Simulation + Betroffenheit | `foerderSimulation.simulateContributionChanges` + Story-Step 06 „Simulation von Beitragsänderungen": absolute lokale Simulationspreise je Gruppe/ZEITKAT (Optionen-Ausgangswert bleibt sichtbar, Einzel-/Gesamt-Reset), Mehrstunden-Ausschöpfungsquote 0–100 % bei identischem Preis benachbarter Staffeln und Ergebnisübersicht nach Gruppe/Gesamt (Stunden, Förderung, Elternbeiträge, Gesamteinnahmen); Kinder-/Familien-Detail bleibt verfügbar. Lokale Änderungen werden nicht gespeichert. | `foerderSimulation.test.js`, `FundingSimulationPanel.test.jsx` |
| Beitragssatz-Import | Reader liest `beitrart.xml`/`bartbetr.xml`; `adebisFeeCatalog.adebis2FeeCatalogs` mappt BETRAGZn direkt auf `zeitkatId` (historische Zone '03' übersprungen, einrichtungsweite Staffel → alle Gruppen, `__DEFAULT__` ohne Gruppen); tatsächliche Gebührenauswahl verwendet nun ZEITKAT statt Wochenstunden. Alte automatische Einträge mit `bart<BARTNR>-z<ZEITKAT>-…`-IDs werden beim Laden/Übertragen migriert; manuelle `maxHours`-Wochenbänder bleiben rückwärtskompatibel. Automatische Übernahme via `preparedImport.scenarioFinance`; auch beim ADEBIS-Anhängen werden fehlende ZEITKAT-Sätze zu bestehenden manuellen Wochenstunden-Bändern ergänzt, ohne diese zu überschreiben. Reimporte sind idempotent. | `adebisFeeCatalog.test.js` (7), `financeUtils.test.js` (ZEITKAT vs Wochenstunden + Legacy-Migration), `simFinanceSlice.test.js` (Legacy-ID-Migration), `feeCatalogTransfer.test.js`, Reader-Regression |

**Export-Nachtrag (26.10.2026, RE: frmxmlbackup):** Der Dialog „Sicherungsdatei erstellen“
(Datei → Export/Import) IST der XML-Export mit fester Tabellen-Registry — erzber/
adressen/beitrart/bartbetr sind bereits im Standardexport enthalten, keine Erweiterung
nötig. Reader-Fixes daraus: UTF-8-Erkennung (Export-Option „in UTF-8“) und
Record-Erkennung über direkte Root-Kinder (ERZBER-Feld/Tag-Kollision).

Entscheidungen des Users (27.10.2026): Simulation = absolute lokale Preise je Gruppe/ZEITKAT ·
Mehrstundenwechsel nur bei identischen benachbarten Simulationspreisen · Ausschöpfungsquote global ·
Buchungsstunden, Förder-, Elternbeitrags- und Gesamteinnahmenänderung je Gruppe und gesamt.

---

## 0. Ist-Analyse (geprüft, 26.10.2026)

### 0.1 Analyse „Bedarfsdeckung" heute

- Die Analyse ist eine **Story-View** (`src/views/VisuView.jsx`): Story-Steps 01 Datenqualität,
  **02 Bedarfsdeckung**, 03 Resilienz, 04 Finanzen, 05 Ausblick, 06 Optionen-Check, 07 Trend-Radar.
- Bedarfsdeckung rendert ein **Diagramm-Karussell** (`STATUS_CHART_SLIDES`, Zeile ~842) mit
  3 Slides: `demand` (Kapazität & Bedarf, `WeeklyChart`), `ratio` (Schlüssel),
  `heatmap` (alle Gruppen).
- Datenfluss: `chartState.filter.Groups` (`chartSlice`) → `filterBookings({ selectedGroups })` →
  `generateBookingDataSeries` / `generateCareRatioSeries`. Die Heatmap zeigt bereits das
  **Gruppen-Loop-Muster** (Zeile ~3030: pro Gruppe eigener `filterBookings`-Aufruf), das sich
  1:1 für gruppengefilterte Histogramme wiederverwenden lässt.

### 0.2 Histogramm-Pipeline existiert, ist aber verwaist

- `src/utils/chartUtils/chartUtilsHistogram.js` (`generateHistogramBins`,
  `calculateHistogramSeries`, `calculateChartDataHistogram`) + Komponente
  `src/components/SimDataCharts/BookingHistogram.jsx` sind **fertig implementiert, aber in
  keiner View eingebunden** (grep: nur chartSlice/chartSelectors referenzieren das Modul).
- Seit Commit `c5b9ea5` ist die Stunden-Ermittlung **BETRSTD-bewusst**:
  `sumWeightedBookingHours` (chartUtils) bevorzugt `belegung.BETRSTD` (autoritative
  adebis-Wochenstunden) vor der Segment-Summe; ohne BETRSTD im Export greift der
  Segment-Fallback.

### 0.3 Datenlage im Standard-Export (kita-anonym-*.zip, 690 Buchungen in 29247781)

| Feld | Gefüllt? | Bedeutung (RE) |
|---|---|---|
| `ZEITKAT` | ✅ 01–09 | **Buchungszeitkategorie** = Stundenzonenauswahl (förderrelevant, §19 AVBayKiBiG) |
| `BUZEITKAT` | ✅ (Kennzahl 1–9, korreliert 1:1 mit ZEITKAT) | abgeleitete Buchungszeitkategorie |
| `ART` | ✅ 0/F/K | Buchungsart (0=Regel, A/B=Alternativ, F/G/H=Ferien, K=Kurzzeit) |
| `BETRSTD` | ❌ leer | Betreuungsstunden (adesbis-Kalkulation) – Fallback: Segment-Summe ✅ |
| `GEWKAT`/`PANTEIL` | ❌ leer | Gewichtung/Anteil – Fallback: Flags/Heuristik ✅ |

→ Beide Histogramme sind **mit heutigen Exporten datenfähig** (ZEITKAT + Segment-Stunden);
BETRSTD/GEWKAT verbessern die Präzision, sobald der Export erweitert wird (XSD-Verträge
liegen in `schema/`).

### 0.4 Förderberechnung heute – GAP gegenüber RE-Formel ⚠️

`calculateChildMonthlyRevenue` (`src/utils/financeUtils.js` ~676):

```js
bayKiBiGAmount = baseValue × bayKiBiGWeight        // IST in Capakita
```

RE-verifizierte Formel (Handbuch Z. 8243, `adebis-re/docs/fachdomaene.md` §6.1):

```js
Förderbetrag = Basiswert × Buchungszeitfaktor × Gewichtungsfaktor
```

Der **Buchungszeitfaktor** (`getZeitkatFactor(ZEITKAT)`, Katalog in
`src/utils/adebisConstants.js` ZEITKAT_CATALOG, 0,5–2,5) fehlt → Capakita zahlt
Regel-/Kurzzeit- und Teilzeitbuchungen gleich — Teilzeitplätze werden
systematisch **über**-fördert, Vollzeit **nicht** zusätzlich ausgewiesen.
Diese Korrektur ist Voraussetzung für eine belastbare Förder-Simulation (A3).

---

## 1. A1 – Histogramm „Buchungsstunden" (filterbar nach Gruppe)

**Was**: Verteilung der Wochen-Buchungsstunden je Kind (X: Stunden-Bins, Y: Kinderanzahl).

**Wo**: neuer Slide im Bedarfsdeckung-Karussell:

```js
const STATUS_CHART_SLIDES = [
  { id: 'demand', title: 'Kapazität & Bedarf' },
  { id: 'ratio', title: 'Schlüssel' },
  { id: 'heatmap', title: 'Heatmap (alle Gruppen)' },
  { id: 'hours-hist', title: 'Buchungsstunden' },      // NEU
  { id: 'kategorie-hist', title: 'Buchungskategorien' } // NEU (A2)
];
```

**Wie**:

1. Daten: `calculateChartDataHistogram` (vorhanden, BETRSTD-bewusst) — Aufruf analog
   Heatmap-Loop mit `selectedGroups = [groupId]` für die Gruppenansicht bzw. globale
   Filterauswahl für „Alle".
2. Filterbarkeit: Slide-Kopf erhält ein `Select` (Alle / je Gruppe) — zusätzlich wirkt der
   globale ChartFilterForm-Filter (Konsistenz mit den anderen Slides).
3. Komponente: `BookingHistogram.jsx` wiederverwenden (compact-Variante fürs Karussell);
   Fehlende Einbindung = Chance, das Modul erstmals produktiv zu schalten.
4. Bins: beibehalten (0 / 1–4 / 5–8 / 9–12 …, 4-h-Raster); Tooltip zeigt Kinderanzahl +
   (wenn BETRSTD vorhanden) adebis-Stunden vs. Segment-Fallback-Hinweis.

**Tests**: `chartUtilsHistogram` bereits getestet; neu: Gruppenfilter-Regression
(pro Gruppe ≠ Gesamtsumme bei Mehrfachgruppenzuordnung), BETRSTD-Fallback-Variante.

---

## 2. A2 – Histogramm „Buchungskategorien" (filterbar nach Gruppe)

**Was**: Verteilung der Kinder je **Buchungszeitkategorie** (ZEITKAT 01–13, Labels +
Faktoren aus `ZEITKAT_CATALOG`: z. B. „>4–5 h → Faktor 1,25").

**Wie**:

1. Neues Util `calculateZeitkatDistribution(filteredDemandBookings, options)`:
   - zählt **Basisbuchungen** je Kategorie: `art ∈ ('0','K')` bzw. `buchungsart.basis === true`
     (RE-Befund #3: Alternativ/Ferien nicht doppelt zählen); Legacy ohne ART = Basis.
   - zwei Zählmodi: `bookings` (je Buchung) und `children` (distinct je Kind — bei
     Perioden-Nachfolgen zählt das Kind einmal in der Kategorie seiner aktuell gültigen
     Buchung am Referenzdatum).
   - Ausgabe: `{ categories: [ZEITKAT_CATALOG-Labels], counts, factors }` sortiert nach
     Stundenzonaufsteigend; unbekannte/leere ZEITKAT → Bucket „ohne Kategorie".
2. Chart: Säulendiagramm im Karussell-Slide `kategorie-hist`, sekundäre Achse optional mit
   Zeitfaktor (Vorbereitung auf A3: sichtbare Förderrelevanz je Zone).
3. Filterbarkeit: identisches Muster wie A1 (Slide-Select + globaler Filter).
4. Plausibilitätscheck (Datenqualität, Step 01 könnte ihn später nutzen): Segmentstunden
   der Buchung vs. untere Zonengrenze — Abweichung > 1 h → Warnung „Zeiten widersprechen
   Zeitkategorie" (adebis leitet BUZEITKAT normalerweise automatisch ab, Handbuch Z. 1440).

**Tests**: Distribution-Util (Basis-Filter, distinct-Modus, leerer ZEITKAT-Bucket,
Gruppenfilter), Regression gegen `kita-anonym-*.zip` (ZEITKAT-Verteilung nicht leer).

---

## 3. A3 – Simulation von Beitragsänderungen

**Ziel-Flow**: Analyse → „Simulation von Beitragsänderungen". Die geladenen Beitragsstaffeln aus dem Capakita-Datenspeicher werden gruppenweise als absolute Monatsbeträge angezeigt. ZEITKAT-Sätze werden bevorzugt; JSON-importierte Wochenstunden-Bänder sind ebenfalls verwendbar. Preise können lokal geändert und einzeln oder insgesamt zurückgesetzt werden; Optionen und Szenarien bleiben unverändert.

### 3.1 Simulationsmodell

- Ausschöpfungsquote (0–100 %) ist der erwartete Anteil der aktiven Basisbuchungen, der bei identischem Simulationspreis in die direkt nächste Staffel wechselt: ZEITKAT-Sätze werden nach Buchungskategorie, JSON-Wochenstunden-Bänder nach Wochenstunden ausgewählt.
- Wenn `rawdata.ZEITKAT` fehlt, wird die Kategorie aus mittleren Tagesstunden der gespeicherten Buchungssegmente abgeleitet. Ohne auswertbare Segmente bleibt die Förderwirkung für diesen Datensatz unbestimmt; ein Wochenstunden-Band kann weiterhin für Elternbeiträge und Mehrstunden verwendet werden.
- Stunden und Förderänderung werden mit der Quote anteilig hochgerechnet. Förderdelta je Wechsel: `Basiswert × Gewichtung × (Zeitfaktor Ziel − Zeitfaktor Ausgang)`, sofern eine ZEITKAT vorliegt oder abgeleitet werden kann.
- Elternanteil basiert auf dem geladenen Satz abzüglich des modellierten Elternbeitragszuschusses (Standard: 100 €/Monat für berechtigte Kinder ab 3 Jahren bis vor Schuleintritt, begrenzt auf den Bruttobeitrag). Der Simulationszuschuss ist lokal änderbar. Zuschuss-Einnahme und netto zu zahlender Elternanteil werden getrennt ausgewiesen; Gesamteinnahmen = Förderung + Elternanteil + Zuschuss.
- Preiseingaben sind rein lokale React-Komponentenzustände und werden beim Szenariowechsel
  zurückgesetzt. Nur aktive Basisbuchungen (Regel-/Kurzzeitbuchungen) fließen in die Berechnung;
  Alternativ- und Ferienbuchungen bleiben ausgeschlossen.
- Ergebnisaggregation: je organisatorischer Gruppe und gesamt Buchungsstunden vorher/nachher,
  monatliche Förderänderung, Elternbeitragsänderung und Gesamteinnahmenänderung (zusätzlich
  Jahresdelta); Kinder-/Familien-Details bleiben als Drilldown verfügbar.

### 3.2 Umsetzung und Tests

`src/utils/foerderSimulation.js` stellt `simulateContributionChanges` als reine
Transformationsfunktion bereit. Eingaben sind gefilterte Basisbuchungen, Gruppenkataloge,
`temporaryPrices` als `{ [groupId]: { [feeBandKey]: euroBetrag } }`, Ausschöpfungsquote,
Förderregeln und Stichtag. Ergebnisse enthalten `groups`, `totals`, Kinder-/Familien-Drilldown
und Overlay-artige simulierte Buchungskopien; Ausgangsdaten werden nicht mutiert.

Tests prüfen absolute statt prozentuale Preise, Wechsel nur bei identischen Preisen, Quoten
0/50/100 %, Förder-, Elternbeitrags- und Stundenwirkung, Gruppen-/Gesamtsummen sowie die
Unverändertheit geladener Optionen und Buchungen.

---

## 4. A4 – Betroffenheitsanalyse Kinder & Familien

**Was**: „welche Kinder oder Familien von den Änderungen am meisten betroffen wären."

**Wie** (baut direkt auf 3.2 `perChild` auf — keine eigene Engine nötig):

1. **Kinder-Ranking**: Tabelle sortiert nach |Δ Fördermonat| bzw. |Δ Wochenstunden|
   (umschaltbar), Spalten: Kind, Gruppe, Ist-Zone → Ziel-Zone, Δ Förder €/Monat,
   Δ €/Jahr, Δ Wochenstunden, Elternbeitrags-Bandwechsel-Flag.
2. **Familien-Aggregation**: Gruppierung über `item.familyId` (seit `c5b9ea5` vorhanden —
   erzber-basiert oder Haushalts-Fallback). Pro Familie: Summe Δ, Kinderanzahl betroffen,
   Familien-Label. Ranking „Top-Familien nach Auswirkung".
3. **Navigation**: Klick auf Kind/Familie → Sprung ins Kind-Detail
   (`setSelectedItem` — gleiches Muster wie der Geschwister-Sprung in
   `SimDataFamilySection`); Familien-Zeile aufklappbar zu ihren Kindern.
4. **Fairness-Sicht (optional)**: Verteil-Sicht Δ nach Gewichtungsfaktor (z. B. trifft ein
   Upgrade Kinder mit 4,5-Faktor stärker) — polygone Titel: „Wer profitiert?", unterstützt
   beim Kommunizieren gegenüber Elternbeirat/Jugendamt.
5. Export: CSV der perChild-/perFamily-Tabelle (optional, Phase C+).

**UI-Ort**: als zweiter Tab im Simulations-Slide aus A3 („Betroffenheit") — Daten kommen
aus derselben Simulation, kein zusätzlicher Berechnungslauf.

**Tests**: Familien-Aggregation (2 Geschwister → Familienzeile summiert), Sortierung,
leere Familienzuordnung (anonymisierter Import → nur Kinder-Ebene), Jump-Integration.

---

## 5. Umsetzungsplan (vorgeschlagen)

| Phase | Inhalt | Abhängigkeiten | Aufwand |
|---|---|---|---|
| **A – Histogramme** | 2 neue Slides (A1/A2), `calculateZeitkatDistribution`, BookingHistogram-Revival, Gruppen-Select | keine (datenfähig mit heutigen Exporten) | ~1 Tag |
| **B – Förderformel-Korrektur** | Buchungszeitfaktor in `calculateChildMonthlyRevenue`, Warnung bei fehlendem ZEITKAT, Regressionstests | keine | ~0,5 Tag |
| **C – Simulation + Betroffenheit** | `foerderSimulation.js`, Simulations-Slide (Optionen-Check), Betroffenheits-Tab (Kinder + Familien), Jump-Integration | Phase B | ~2–3 Tage |

Phase A + B sind unabhängig voneinander; C baut auf B auf.

## 6. Offene Fragen (vor Umsetzung klären)

1. **Zielzonenauswahl**: globale „+1 Zone"-Regel, fixe Zielzone oder Mindeststunden-Schwellwert
   (z. B. alles unter 6 h auf 6 h)? → Vorschlag: alle drei als `mode` (3.2), Default „nextZone".
2. **Förderjahr vs. Monat**: Reicht Δ×12 oder soll die semesterweise Buchungslage (hj1/hj2,
   kijas) einfließen? Letzteres koppelt an den offenen kijas-Gap aus `adebis-re/docs/capakita-gaps.md`.
3. **Nutzungsgrad-Granularität**: globaler Slider oder pro Zone/Gruppe? Vorschlag: global,
   pro-Zone später.
4. **Soll die Förderformel-Korrektur (0.4) die bestehenden Finanz-Views verändern** (KPIs der
   Story-Step 04 ändern sich für Teilzeitkinder!) — bewusst als eigener Commit mit klarem
   Changelog-Hinweis, da Summen springen.
5. **Buchungsstunden-Histogramm**: Wochenstunden je Buchung (Status quo) oder auch
   Verteilung über BETRTAGE (Wochentag-Abdeckung)? Zweiteres wäre ein drittes Histogramm
   (Reihenfolge im Karussell beachten).

## 7. Compliance

Alle Simulationen arbeiten ausschließlich auf **importierten/anonymisierten Daten** des
jeweiligen Szenarios (Capakita-Prinzip); keine Live-Daten von ct240. Die RE-Formel
(Basiswert × Zeitfaktor × Gewichtung) stammt aus Handbuch/Engine-Strings (§69e-UrhG-
Kontext: Interoperabilität), keine Engine-Reimplementierung über den Formelkern hinaus.
