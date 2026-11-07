# ADEBIS ↔ Capakita: Vergleich der Teilergebnisse

Verglichen wurden die beiden vom Auftraggeber bereitgestellten Screenshots für 2026. Das ist ein Screenshot-Abgleich, keine vollständige Neuberechnung des Originalexports: Die zugrunde liegenden ADEBIS-/Capakita-Datensätze waren in diesem Arbeitsschritt nicht als Datei verfügbar.

## Gefundene Abweichungen

### 1. Buchungszeitenförderung: Capakita verwendet eine andere Berechnungsbasis

ADEBIS Januar zeigt `BuStdGew = 299`, `Basiswert = 1.563,88 €` und `vorauss. Förderung = 19.483,34 €`. Die Zahlen passen zur ADEBIS-Formel:

`BuStdGew × Basiswert ÷ 24 = 299 × 1.563,88 € ÷ 24 = 19.483,34 €` (auf Cent gerundet)

Capakita zeigt für Januar `10.282,51 €`. Vor der Korrektur wurde in `FundingSimulationPanel` dagegen `Basiswert × Gewichtungsfaktor × Zeitfaktor` berechnet und für den Monatswert zusätzlich durch 12 geteilt. Die bestehende Darstellung lag damit für 2026 bei **116.476,48 €** Jahres-Basisförderung gegenüber **218.656,49 €** in ADEBIS – eine Unterberechnung um **102.180,01 €** (rund 46,7 % des ADEBIS-Werts).

**Korrektur:** Die monatliche Teilergebnis-Tabelle berechnet den Basisbetrag jetzt aus den gewichteten täglichen Buchungsstunden und dem Basiswert (`BuStdGew × Basiswert ÷ 24`); die Jahresförderung ist die Summe der zwölf Monatsbeträge. Dadurch wird die ADEBIS-Einheitenlogik abgebildet, statt einen Jahresbetrag erneut zu teilen.

### 2. Elternbeitragszuschuss: Monatsverteilung und Jahreswert weichen ab

| Zeitraum | Capakita | ADEBIS | Abweichung Capakita – ADEBIS |
|---|---:|---:|---:|
| Januar–Februar | 2.300 €/Monat | 2.100 €/Monat | +200 €/Monat |
| März–Mai | 2.500 €/Monat | 2.100 €/Monat | +400 €/Monat |
| Juni–Juli | 2.300 €/Monat | 2.100 €/Monat | +200 €/Monat |
| August | 2.500 € | 2.100 € | +400 € |
| September | 1.700 € | 1.900 € | −200 € |
| Oktober–Dezember | 1.800 €/Monat | 1.900 €/Monat | −100 €/Monat |
| **Jahr** | **26.300 €** | **24.400 €** | **+1.900 €** |

Die Capakita-Anspruchslogik wurde ergänzt: Ein aktives ADEBIS-`SCHULKIND`-Merkmal schließt das Kind beim Monatszuschuss aus. Damit kann der Septemberwechsel aus dem Buchungsexport übernommen werden. Die Alters- und Gruppenregeln bleiben für Datensätze ohne dieses Merkmal der Fallback; die Screenshot-Jahresdifferenz von 1.900 € muss nach Import des Originalexports erneut verifiziert werden. Ein pauschaler Korrekturfaktor wäre nicht sachgerecht.

### 3. U3-Zusatzförderung und Qualitätsbonus

Im Screenshot weist ADEBIS **3.675,12 € Zusatzförderung U3** und **18.736,15 € Qualitätsbonus** aus; Vorkurse und U3-Bundesmittel sind dort 0,00 €.

Capakita berechnet diese beiden Beträge jetzt monatsweise aus den Buchungsdaten und den jährlichen Förderregeln. Die im Screenshot nachvollziehbaren Berechnungen sind `U3-Kinder × Basiswert × 0,025` und `BuStdGew × Qualitätsbonus-Basiswert ÷ 48`. Der U3-Faktor und der Qualitätsbonus-Basiswert sind pro Förderregel in **Optionen → BayKiBiG-Rahmen** konfigurierbar. Vorkurse werden anhand des `VORKURS`-Buchungsmerkmals mit dem pro-Regel hinterlegten Betrag je Kind/Jahr berechnet. Der Standardwert ist 0, bis ein gültiger Satz in der Förderregel gepflegt ist.

U3-Bundesmittel, Personalbonus, Assistenzkräfte- und Sprachförderung bleiben manuelle Jahreswerte, sind jetzt aber pro Jahr direkt in der Ergebnistabelle editierbar und gehen in Förderanspruch und Einnahmen ein.

### 4. Buchungsstunden: kleiner, aber sichtbarer Eingabe-/Aggregationsunterschied

Im Screenshot stehen bei Capakita **1.132,0 Buchungsstunden/Woche** (= **226,4** tägliche Stunden bei Division durch fünf), bei ADEBIS **BuStd = 223,00**. Der ADEBIS-Vergleich nutzt jetzt `BELEGUNG.BETRSTD` als autoritative Wochenstundenzahl, wenn vorhanden, und zählt Alternativ-/Ferienbuchungen nicht mit. Die Screenshots enthalten keine Kinderdatensätze; deshalb ist noch offen, ob die frühere Differenz von **3,4 täglichen Stunden** damit vollständig verschwindet. Ein erneuter Vergleich mit dem Originalexport ist erforderlich.

## ADEBIS-Spalten in der Tabelle

Die Capakita-Ansicht enthält jetzt die Spalten `Kinder`, `integ.`, `% > 3 Std.`, `BuStd`, `BuStdGew`, `ArbStd`, `ArbStdFK`, `MindStdFK`, `FK +/-`, `FKQ`, `AS`, Förderungskennzeichen, die Förderbeträge, `Basiswert` und `Betriebstage`.

- `% > 3 Std.` wird entsprechend der ADEBIS-Erklärung als Anteil der Kinder mit mindestens 20 Wochenstunden berechnet.
- `MindStdFK` wird nach der im ADEBIS-Vergleich erkennbaren Relation `BuStdGew ÷ 4,4` gebildet; `FK +/-` ist `ArbStdFK − MindStdFK`.
- `AS` wird aus gewichteten Wochenbuchungsstunden geteilt durch die gesamten Wochenarbeitsstunden abgeleitet.
- `ArbStd`/`ArbStdFK` verwenden importierte Vertragswochenstunden (`ANSTELL.ARBZEIT`), Qualifikation und die aus ADEBIS importierten Start-/Ende-Modi. `STATHIDE`-Anstellungen werden ausgeschlossen. Fehlzeiten und nicht abbildbare Sondermodi wie 42-Tage-Fristen sind weiterhin nicht vollständig modelliert.
- `FKQ` wird aus verfügbaren Stunden vorbefüllt, ist aber nicht nachgewiesen identisch mit ADEBIS. Die Monatszelle kann jetzt mit dem Originalwert überschrieben werden; im Screenshot sind es 84,62 %, während `115 ÷ 223` 51,57 % ergibt.
- Integration und Betriebstage sind nicht in den Standardfeldern des Imports enthalten. Für beide können jetzt monatsbezogene ADEBIS-Istwerte direkt in der Tabelle eingegeben werden; sie werden in den Szenarioeinstellungen gespeichert.
- U3-Zusatzförderung, Qualitätsbonus und Vorkurse werden je Monat aus Kind-/Buchungsdaten und den Fördersätzen der Jahresregel berechnet. U3-Bundesmittel, Personalbonus, Assistenzkräfte- und Sprachförderung werden als Jahreswerte pro Jahr in der Ergebnistabelle eingegeben.

## Verbleibende Validierung

1. Den Originalexport des Screenshot-Szenarios importieren und die Änderungen gegen die ADEBIS-Monatswerte validieren; dafür gibt es Rechentests für `BETRSTD`, Alternativbuchungen, U3-Zuschlag und Qualitätsbonus.
2. Nachprüfen, ob `SCHULKIND` die EB-Zuschussmonate im September exakt abbildet; die Monatsberechnung nutzt das Merkmal, sofern es im Export gesetzt ist. Betrag und Enddatum sind je Beitragsordnung konfigurierbar und werden beim Katalogimport mit übernommen.
3. Für `FKQ`, Integration und Betriebstage können ADEBIS-Monatswerte direkt in der Detailtabelle eingetragen werden. Eine exakte automatische Fachkraftquote und die 42-Tage-/Fehlzeitlogik erfordern weiterhin die ADEBIS-Analysemodell-Quelldaten bzw. eine vollständige Regelabbildung.
