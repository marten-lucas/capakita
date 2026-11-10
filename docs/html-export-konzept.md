# Konzept: datensparsamer, interaktiver HTML-Export der Beitragssimulation

## Ziel und Empfehlung

Der Export soll eine einzelne HTML-Datei erzeugen, die direkt per `file://` im Browser geöffnet werden kann. Tarifstaffeln lassen sich darin verändern; Elternbeiträge, Zuschussdurchlauf, Förderungen und Einnahmen werden anschließend lokal neu berechnet.

Für die weitergebbare Datei ohne personenbezogene Datensätze wird **kein anonymisierter Kinderdatensatz**, sondern ein explizit zusammengestellter, aggregierter Rechensnapshot exportiert. Familiennamen, Kind- oder Mitarbeitendenzeilen sind nicht Bestandteil dieser Variante.

## Umsetzungsstand

Die erste eigenständige HTML-Version ist implementiert. Im Ergebnisbereich kann vor dem Download eine Datenschutzvorschau geöffnet werden. Die einzelne HTML-Datei enthält eingebettetes Pico CSS und JavaScript, funktioniert offline unter `file://` und erlaubt Tarif- und Zuschussänderungen mit lokaler Neuberechnung der Elternbeiträge, Zuschussdurchläufe, Jahreseinnahmen sowie des Familien-Histogramms. Die Ausgangs-/Vorjahresförderung bleibt als exportierter Jahreswert erhalten; Tarifänderungen verändern daran nur den Elternbeitragszuschuss-Durchlauf. Seltene Familienprofile unter k=5 werden nicht exportiert, ihre Anzahl wird ausgewiesen. Wichtig: Deren Beitragsanteil bleibt in den Jahresgesamtsummen auf dem Export-Ausgangswert stehen. Nach interaktiven Änderungen zeigen Gesamtsummen und Histogramm daher nur die Auswirkungen der aufgeschlüsselten Profile und sind ausdrücklich unvollständig.

## Datenschutzgrenze

Die vorhandene Funktion `anonymizeSaveData` ist für diesen Zweck nicht ausreichend: Sie ersetzt Namen und direkte ADEBIS-IDs, erhält aber unter anderem Geburtsdaten, Betreuungszeiträume und Buchungsinformationen. Das ist Pseudonymisierung, keine Garantie, dass die Datei keine personenbezogenen Daten enthält.

Die HTML-Datei ist außerdem nicht verschlüsselt. Ihr eingebetteter Inhalt kann von jeder Person gelesen werden, die die Datei erhält. Deshalb gilt:

- Keine Namen, Familien- oder Kind-IDs, ADEBIS-IDs, Originaldatensätze oder Mitarbeiterdaten exportieren.
- Keine genauen Geburtsdaten, Eintritts-/Austrittsdaten oder individuellen Buchungszeiten exportieren.
- Stattdessen nur die für die Berechnung erforderlichen Monats- und Tarifaggregate aufnehmen.
- Gruppen nur als neutrale Namen wie `Gruppe 1` darstellen.
- Kleine Aggregate sind trotz fehlender Namen möglicherweise rückführbar. Der Export sollte kleine Zellen standardmäßig unterdrücken oder mit größeren Zellen zusammenfassen. Vorschlag für V1: Mindestbelegung **5**; unterdrückte Werte deutlich kennzeichnen.

Die Schwelle hat eine fachliche Folge: Wird eine seltene Tarif-/Gruppenkombination unterdrückt, lässt sich eine Änderung an genau dieser Kombination nicht exakt neu berechnen. Der Export muss dann entweder eine ausdrücklich als Schätzung markierte Änderung zeigen oder diese Änderung für die unterdrückte Zelle sperren. Eine „datenschutzsichere“ Datei darf nicht stillschweigend Einzelwerte enthalten, nur um exakte Ergebnisse zu erzwingen.

## Vorgeschlagenes Datenmodell

Der Export verwendet eine versionierte Allowlist, nicht die bestehende Szenario-Sanitizer-Funktion. Eingebettet werden nur Felder, die die Rechenengine tatsächlich benötigt, zum Beispiel:

- Exportversion, Szenariobezeichnung, Referenzjahr und Kennzeichen für ein fixiertes Basisjahr.
- Neutrale Gruppenbezeichnungen und Tarifstaffeln: ZEITKAT, Basistarif, Aktivstatus sowie der simulierte Tarif.
- Monatliche Aggregate je Gruppe und Tarifband: Kinderzahl, gewichtete und ungewichtete Buchungsstunden, U3-Zahl, Vorkurszahl und Zahl der zuschussberechtigten Kind-Monate.
- **Familien-Tarifprofile als Häufigkeiten, nicht als Familienliste:** z. B. „eine Buchung in ZEITKAT 04 und eine in ZEITKAT 05, davon ein zuschussberechtigt“ kommt bei 7 Familien vor. Diese profilebasierten Häufigkeiten reichen, um die Beitragssumme pro Familienprofil nach einer Tarifänderung neu zu berechnen, ohne Familiennamen oder Familien-IDs einzubetten.
- Förderregeln je Jahr: Basiswert, Qualitätsbonus-Benchmark, U3-Faktor, Vorkurs- und Teamzuschuss-Sätze.
- Manuelle **Jahressummen** für U3-Bundesmittel, Personalbonus, Assistenz und Sprachförderung; keine Einzelkosten oder Mitarbeiterdaten.
- ADEBIS-Monatskorrekturen nur als Aggregate (z. B. Integration, FKQ-Istwert, Betriebstage), sofern diese zur initialen Ergebnisreproduktion benötigt werden.

Die Aggregation für den Elternbeitrag muss die Zahl zuschussberechtigter Kinder **je Gruppe/Tarifband/Monat** erhalten. Eine bloße Jahressumme des Zuschusses reicht nicht aus, wenn der Betrag, das Enddatum oder die Tarife geändert werden können.

Der Snapshot sollte ein eigenes Format tragen, z. B. `capakita-aggregate-simulation` mit einer Schema-Version. `dataItems`, `bookingsByItem`, `originalData` und `rawdata` aus dem bestehenden Szenarioexport werden nicht übernommen.

## Welche Funktionen sind möglich?

| Funktion | In der aggregierten HTML-Datei | Grenze |
|---|---|---|
| Tarifstaffeln per Slider oder Zahlenfeld ändern | Ja | Für exportierte, nicht unterdrückte Tarifbänder exakt. |
| Zuschussbetrag und Enddatum ändern | Ja | Erfordert monatliche Zuschuss-Berechtigtenzahlen je Gruppe/Tarifband. |
| Elternbeiträge und Durchlauf des Zuschusses neu berechnen | Ja | Gesamtsummen und Jahresveränderungen, ohne einzelne Familien. |
| Jahresförderung und Einnahmen neu berechnen | Ja | Exakt nur, wenn die benötigten monatlichen ADEBIS-Aggregate und Förderregeln enthalten sind. |
| Gruppen filtern und Tarifänderungen zurücksetzen | Ja | Gruppen erscheinen nur mit neutralen Bezeichnungen. |
| Familien-Histogramm nach Beitragserhöhung | **Ja, aggregiert** | Wird bei jeder Tarifänderung aus den Häufigkeiten gemeinsamer Familien-Tarifprofile neu berechnet. Keine Namen oder Familien-IDs. Kleine/seltene Profile werden unterdrückt; diese Familien erscheinen als nicht aufgeschlüsselter Rest. |
| Änderungen an einer einzelnen Buchung oder einem einzelnen Kind simulieren | **Nein** | Keine individuellen Buchungen, Geburtstage oder Buchungszeiträume in der Datei. |
| Upgrade-/Downgrade-Potenzial mit einem Budget **pro Familie** exakt neu optimieren | **Nicht mit reinen Monatsaggregaten** | Die Auswahl hängt von der Verteilung der Kinder auf Familien ab. V1 sollte dies weglassen oder nur ein deutlich als aggregiert/geschätzt markiertes Potenzial anzeigen. |

Damit bleibt insbesondere der gewünschte Zuschuss-Übergang darstellbar: Die aggregierten Elternbeiträge steigen ab dem Enddatum um die berechtigten Kind-Monate × Zuschussbetrag. Die Förderseite wird gleichzeitig um den im Förderanspruch enthaltenen Zuschuss reduziert; sonstige Förderänderungen bleiben separat sichtbar.

## Familienauswirkungen als dynamisches Histogramm

Das Histogramm soll **bei jeder interaktiven Tarifänderung live neu berechnet** werden. Dazu exportiert CapaKita keine Familienzeilen, sondern fasst Familien mit derselben für Beiträge relevanten Tarif- und Zuschussstruktur zu einem Profil zusammen:

- Profilinhalt: Anzahl Kinder je neutraler Gruppe und ZEITKAT sowie die zuschussberechtigten Kind-Monate je Tarifband.
- Profilhäufigkeit: wie viele Familien diese Zusammensetzung haben.
- Nicht enthalten: Familienname, Familien-ID, Kind-ID, Geburtsdatum, konkrete Buchungszeiten oder Eintritts-/Austrittsdatum.

Ändert die Person im HTML einen Tarif oder den Zuschuss, berechnet das lokale JavaScript den Monatsbeitrag pro Profil neu und verschiebt dessen Familienhäufigkeit in die passenden Histogramm-Bins. Standardmäßig zeigt `Gesamtwirkung` die Summe aus Veränderung zum Vorjahr (z. B. Zuschusswegfall) und Tarifsimulation. Die Ansichten `Zum Vorjahr` und `Simulation` trennen die beiden Ursachen. Gezeigt werden z. B. `Senkung`, `1–49 €`, `50–99 €`, `100–149 €`, `150–199 €` und `200 € oder mehr` pro Familie und Monat. Das Diagramm aktualisiert sich ohne Serverzugriff unmittelbar mit den Reglern.

### Datenschutzbedingte Grenze

Ein Familienprofil ohne Namen ist nicht automatisch anonym: Eine seltene Tarifkombination kann in einer kleinen Kita eine einzelne Familie beschreiben. Für die weitergebbare V1 werden deshalb Profile mit weniger als **5 Familien** nicht einzeln eingebettet. Solche Familien fließen in eine sichtbar ausgewiesene Gruppe `Weitere Familien – nicht aufgeschlüsselt`; deren Beitragshöhe wird nicht einem Histogramm-Bin zugeordnet. Die sichtbaren Histogramm-Bins sind damit dynamisch, die Gesamtzahl der nicht aufgeschlüsselten Familien bleibt separat sichtbar.

Wenn zu viele Profile unterdrückt würden, weist die Exportvorschau darauf hin und bietet keinen exakten Gesamtanspruch für das Histogramm an. Ein Export ohne diese Unterdrückung könnte das Histogramm exakter machen, wäre aber nicht mehr als datenschutzsicherer, aggregierter Share-Export einzustufen und gehört nicht in V1. Die Mindestgröße 5 senkt das Risiko, garantiert aber keine formale Anonymität; eine Datenschutzprüfung bleibt erforderlich.

## Aufbau und Verhalten der HTML-Datei

1. **Kopfbereich:** Szenarioalias, Basisjahr, Erstellungszeitpunkt, Berechnungsversion und kurzer Datenschutzhinweis.
2. **Tarifbereich:** Slider-ähnliche Balken mit Ausgangstarif, aktuellem Tarif und Änderung. Elternbeitragszuschuss mit Betrag und Enddatum separat anzeigen.
3. **Jahrestabelle:** Förderanspruch, Elternbeiträge und Einnahmen; Vorjahres- und Simulationseffekte getrennt.
4. **Monatsdetails:** nur aggregierte Werte. Keine Drilldowns auf Kinder oder Familien.
5. **Aktionen:** Simulation zurücksetzen, aktualisierte HTML-Kopie herunterladen und drucken/als PDF speichern.

Die Datei arbeitet ausschließlich lokal. Sie enthält keine API-Aufrufe, externen Skripte, CDNs, Webfonts, Analytics, Service Worker oder automatisches `localStorage`. Änderungen bleiben zunächst im Arbeitsspeicher; „aktualisierte Kopie herunterladen“ erzeugt auf ausdrückliche Aktion eine neue HTML-Datei.

## CSS-Empfehlung

**Pico CSS**, eingebettet in die Datei, ist die Empfehlung: klein, classless und ohne JavaScript-Abhängigkeit. Es eignet sich für Formulare, Schaltflächen und Tabellen. Die Tarifbalken, Slider und Diagrammfarben erhalten wenige eigene CSS-Regeln.

Wichtig für `file://`: Pico CSS darf nicht von einem CDN geladen werden. CSS und der gebündelte JavaScript-Rechenkern müssen vollständig in der HTML-Datei stecken. Der Export darf keine ES-Module oder lokalen `fetch()`-Aufrufe voraussetzen. Alternativ ist handgeschriebenes CSS noch leichter; Bootstrap oder das Mantine-Laufzeitpaket wären für diese einzelne Datei unnötig groß.

## Technische Leitplanken

- Der Standalone-Export bettet seinen React-/Redux-unabhängigen Aggregat-Rechenkern inline ein. Da der bestehende CapaKita-Jahresrechner zusätzliche Daten und ADEBIS-Regeln benötigt, bleibt derzeit eine abgegrenzte Aggregatberechnung im Export; Tests müssen Tarif-, Zuschuss- und Rundungsfälle gegen die Anwendung absichern.
- HTML als einzelnes Artefakt mit eingebettetem versioniertem Aggregatmodell und gebündeltem JavaScript erzeugen.
- Datenmodell strikt per Allowlist erstellen und beim Export testen, dass keine verbotenen Schlüssel, ADEBIS-IDs, Geburtsdaten oder individuellen Zeitsegmente enthalten sind.
- Im HTML sichtbar angeben, wenn kleine Zellen unterdrückt wurden und Ergebnisse daher teilweise geschätzt sind.
- Nicht „anonym“ versprechen, bevor die Aggregation und ein mögliches Reidentifikationsrisiko fachlich/datenschutzrechtlich geprüft wurden.

## Abnahmekriterien für V1

1. Die Datei öffnet sich ohne Netzwerkzugriff per `file://` in aktuellen Desktop-Browsern.
2. Der unveränderte Export zeigt dieselben freigegebenen Jahresaggregate wie CapaKita.
3. Eine Tarifänderung aktualisiert Elternbeiträge, Einnahmen und das Familien-Histogramm; der Zuschussablauf wirkt monatsgenau auf aggregierte berechtigte Kind-Monate und Profile.
4. Änderungen am Tarif lassen keine Namen, IDs, Geburtstage, Familienzeilen, exakten Betreuungszeiträume oder individuellen Buchungszeiten im HTML zurück.
5. Das Histogramm gruppiert Familienprofile nur ab Mindesthäufigkeit 5; unterdrückte Profile werden sichtbar als Rest ausgewiesen, nicht stillschweigend einem Erhöhungs-Bin zugeordnet.
