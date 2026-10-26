# Konzept: Bedarfsdeckung – Histogramme, Förder-Simulation, Betroffenheitsanalyse

Status: **Konzept (v1, 26.10.2026)** · Basis: Code-Ist-Analyse + Reverse-Engineering adebisKITA 7.5.5
(`adebis-re/docs/`) · Umsetzung noch offen

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

## 3. A3 – Förder-Simulation „Buchungsgruppen verändern"

**Anforderung (User)**: vergleichen, wie die **Fördereinnahmen** wären, wenn Buchungen in
höhere Stundenzonen verschoben werden („mehrere Stunden umfassen") und die Eltern die
Zusatzstunden optional **voll ausnutzen**.

### 3.1 Modell (RE-basiert)

Die Stundenzonen sind die `ZEITKAT`-Kategorien; ein „Upgrade" = Zonensprung. Zwei getrennte
Wirkungen — bewusst entkoppelt, weil sie unterschiedliche Mechanismen treffen:

| Hebel | Wirkt auf | Mechanismus |
|---|---|---|
| **Zeitkat-Upgrade** | Förderbetrag | `Basiswert × ZeitkatFaktor(Zielzone) × Gewichtung` — Anspruch, nicht Nutzung |
| **Nutzungsgrad** (optional, 0–100 %) | Bedarf/Kapazitätsvergleich | Segmentausweitung: gebuchte Zeiten skalieren/erweitern auf die Zielzone (bei 100 % = Zonenvollausnutzung, z. B. Zone „>5–6 h" → 6,0 h) |

Förderseitig ist der Nutzungsgrad **irrelevant** (BayKiBiG fördert den Buchungsanspruch);
bedarfsseitig (Anstellungsschlüssel, Engpässe) wirkt nur der Nutzungsgrad. Das erklärt die
User-Beobachtung „optional" sauber aus dem Datenmodell heraus.

### 3.2 Simulations-Engine (rein funktional, keine Basisdaten-Mutation)

Neues `src/utils/foerderSimulation.js`:

```js
simulateZeitkatUpgrade({
  demandBookings,          // gefilterte Basisbuchungen (filterBookings-Ergebnis)
  children,                // dataByScenario-Items (für Gewichtung)
  groupDefs,
  bayKiBiGRule,            // { baseValue, weightFactors } aus simFinanceSlice
  upgrade: {
    mode: 'nextZone' | 'targetZone' | 'minHours',  // Zielzonenauswahl
    targetZeitkat: '07',                            // bei targetZone
    minHours: 6,                                    // bei minHours → kleinste Zone ≥ x h
    scope: 'all' | { fromZones: ['05','06'] },      // nur bestimmte Zonen anheben
    utilizationPercent: 100,                        // 0–100 (Eltern-Nutzung)
  },
  referenceDate,
})
→ {
  perChild: [{ itemId, kindnr, familyId, fromZone, toZone, zeitFactorBefore,
               zeitFactorAfter, weight, amountBefore, amountAfter, deltaMonthly,
               deltaYearly, feeBandChange: boolean, weeklyHoursBefore, weeklyHoursAfter }],
  totals: { deltaMonthlyBayKiBiG, deltaYearlyBayKiBiG, deltaParentFees,
            deltaWeeklyDemandHours, affectedChildren, affectedFamilies },
  simulatedBookings: [...],   // für Chart-Pipelines (Overlay-artige Kopien)
}
```

Regeln der Transformation:

- Nur **Basisbuchungen** (art 0/K) werden angehoben; Alternativ-/Ferienbuchungen bleiben
  unverändert (RE: kein doppelter Förderanspruch).
- Zonensprung: Zielzone = nächsthöhere bzw. gewählte Zone; `ZEITKAT_CATALOG` liefert die
  Faktoren (0,5→2,5, Deckelung >9 h — RE-Handbuch Z. 8247).
- Segmentausweitung bei Nutzungsgrad > 0: bestehende Segmente auf Zonenumfang erweitern
  (proportional bei <100 %), damit `generateCareRatioSeries`/Weekly-Chart die simulierten
  Engpässe realistisch zeigen.
- **Förderformel-Korrektur** (0.4) zuerst umsetzen: `calculateChildMonthlyRevenue` erhält
  den Buchungszeitfaktor (aus `rawdata.ZEITKAT` der aktiven Basisbuchung); ohne ZEITKAT
  → Faktor 1,0 = heutiges Verhalten (rückwärtskompatibel + Warnung im Import-Meta).
- Elternbeiträge: `feeEntry`-Bänder (maxHours) können durch den Zonensprung wechseln →
  `feeBandChange`-Flag und Δ Elternbeiträge separat ausweisen (wichtig für
  Elternkommunikation — und für A4).
- Jahresbetrachtung: `deltaYearly = deltaMonthly × 12` (Option „Förderjahr" mit
 semesterweiser Buchungslage kann später über die Midterm-Pipeline folgen).

### 3.3 UI

- Bedarfsdeckung/Optionen-Check (Story-Step 06 „Optionen-Check" ist für Szenarien-Ranking
  vorgesehen — Simulation gehört dort hin; alternativ eigener Slide im Step 02):
  - Parameterform: Zielzonenauswahl, Scope (alle/bestimmte Zonen), Nutzungsgrad-Slider,
    Förderjahr-Basiswert-Anzeige
  - Ergebnis-KPIs: Δ Fördermonat/−jahr, Δ Elternbeiträge, Δ Wochenbedarfsstunden,
    betroffene Kinder/Familien
  - Vorher/Nachher-Vergleichschart (Gruppen-Balken: Förderbetrag je Zone ist/nachher)

### 3.4 Tests

- Transformations-Unit-Tests: Zonensprung (Faktor 1,25→1,5), Scope-Begrenzung, Nutzungsgrad
  0/50/100, nur-Basis-Regel (F-Buchung unverändert), Bandwechsel Elternbeitrag.
- Förderformel-Regression: mit/ohne ZEITKAT, Deckelung >9 h.
- Integration: Simulation → calculateScenarioMonthlyFinance-Summen ändern sich konsistent.

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
