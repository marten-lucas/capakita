# ADEBIS-Import: Datenqualität und Referenzen

## Buchungen ohne auswertbare Zeiten

Eine Kindbelegung bleibt auch ohne gültige Zeitsegmente mit Zeitraum, Buchungsart, Rohmerkmalen und Kindreferenz erhalten. Das ist unter anderem für `SCHULKIND` bei der Zuschussprüfung relevant. Der Reader meldet die Anzahl betroffener Belegungen über `BELEGUNG_WITHOUT_TIMES`. Ungültige, unvollständige oder rückwärts laufende Zeitpaare erzeugen keine Segmente; leere Wochentagspositionen bleiben erhalten. Beschäftigungsbuchungen ohne auswertbare Segmente werden weiterhin nicht erzeugt.

Ohne Zeitsegmente und ohne exportiertes `BETRSTD` stehen keine belegbaren Stunden zur Verfügung; segmentbasierte Summen ergeben technisch 0, was nicht beweist, dass keine Betreuung stattfand. `BETRSTD` darf als ausdrücklich exportierter Wert genutzt werden. Eine ausdrücklich exportierte `ZEITKAT` kann auch ohne Segmente einen Katalogbeitrag bestimmen; ohne Zeitkategorie und ohne auswertbare Segmente wird keine Kategorie und daraus kein Elternbeitrag abgeleitet. Die synthetischen Tests in `src/utils/adebis-import.test.js` prüfen diese Fälle, den Bezug zum Kind sowie das erhaltene `SCHULKIND`-Merkmal. Sie enthalten keine personenbezogenen Daten.

## End-to-End-Befund: Wizard bis Monatsansicht

`src/utils/adebis-import-end-to-end.test.jsx` importiert ein synthetisches ZIP über die vom Wizard verwendeten Funktionen `prepareImport` und `applyImport` und prüft anschließend die echte Monatsansicht. Für zugeordnete Kinder bleiben auch zeitlose Basis- und Ferienbuchungen samt Zeitraum, `ART`, `SCHULKIND`, `ZEITKAT`, `GEWKAT` und `PANTEIL` im Store. Ein Standard-Reimport aktualisiert die Buchungen, wenn die Kinddatensätze identisch sind; eine Belegung ohne zugehörigen Kinddatensatz wird nicht angelegt. Der historische Modus erhält vergangene Buchungen; der Snapshot-Modus filtert abgelaufene Datensätze bewusst heraus.

Im synthetischen Beispiel endet eine zeitlich auswertbare Basisbuchung im August; ab September gilt eine zeitlose Basisbuchung mit `SCHULKIND=.T.`. Eine gleichzeitig vorhandene Ferienbuchung mit Schulkindmerkmal beeinflusst den Anspruch vorher nicht. Mit einem weiteren Kind mit zeitloser Nicht-Schulkind-Basisbuchung zeigt die Monatsansicht Januar 200 € und September 100 € modellierten Zuschuss (20 Kind-Monate/Jahr). Ein ansonsten identischer Standard-Reimport mit `SCHULKIND=.F.` zeigt im September 200 € (24 Kind-Monate/Jahr). Das sind konfigurierte Modellwerte, keine Bestätigung tatsächlicher Auszahlung.

Die Jahresbeitragsrechnung berücksichtigt für das erste Kind den gültigen ZEITKAT-05-Tarif von 150 € auch ohne Segmente und ohne `BETRSTD`; Stunden werden dadurch nicht erfunden. Der monatliche Zuschuss für dieses Kind beträgt bis August 100 € und ab September als Schulkind 0 €. Das zweite Kind ist ganzjährig zuschussfähig, hat aber keine verwertbare ZEITKAT und keinen berechenbaren Beitrag. Das dritte Kind hat nur eine Ferienbuchung und keinen Basisanspruch.

| Monate 2026 | Zuschuss Kind 1 / Kind 2 | Bekannter Elternbeitrag Kind 1 pro Monat |
| --- | --- | --- |
| Januar, Februar, März, April | 100 € / 100 € | 50 € |
| Mai, Juni, Juli, August | 100 € / 100 € | 50 € |
| September, Oktober, November, Dezember | 0 € / 100 € | 150 € |

Damit ergeben sich `8 × 50 € + 4 × 150 € = 1.000 €` bekannte Elternbeiträge; wegen des fehlenden Tarifs für Kind 2 bleibt die Beitragsrechnung unvollständig. Der angezeigte Zuschuss von 2.000 € ist ein modellierter Nominalwert, keine Bestätigung tatsächlicher Auszahlung. Beim Kontroll-Reimport ohne Schulkindmerkmal sind es 24 zuschussfähige Kind-Monate und `12 × 50 € = 600 €` bekannte Elternbeiträge. Mit explizit exportiertem `BETRSTD=25,5` zeigt die Ansicht ab September zusätzlich 5,1 Stunden/Tag; der Jahresbeitrag bleibt bei 1.000 €. Der Test prüft alle zwölf Monatszeilen und erhält die übrigen Buchungsdaten.

Der Test verwendet den Import-Hook und die Komponentenansicht, aber keinen Browser-Dateidialog und keinen Originalexport. Bei einem Append-Import mit abweichendem Kinddatensatz und Konfliktregel „überspringen“ kann der Wizard den betroffenen Datensatz samt Buchungen bewusst auslassen; dies ist von der Prüfung auf Zeitsegmente unabhängig.

## Feldreferenz aus einem anonymisierten Standardexport

Der bestehende Test `referenziert fehlende Felder im anonymisierten Standard-ZIP nur aggregiert` prüft `tests/testdata/kita-anonym-29247781.zip` im historischen Modus: 690 Belegungen, davon 0 mit gefülltem `BETRSTD`, `GEWKAT` oder `PANTEIL`, 685 mit `ZEITKAT` bzw. `BUZEITKAT` und 690 mit `ART`. Diese Zahlen beschreiben nur diese bestehende anonymisierte Testdatei, nicht alle Exporte. Der Reader warnt bei fehlendem oder leerem `BETRSTD` bzw. `GEWKAT`; fehlende und leere XML-Felder werden beim Einlesen gleichermaßen als leer behandelt. Fehlende Werte lassen sich nicht aus der Warnung selbst rekonstruieren.

Es ist nicht belegt, dass diese Testdatei das ursprüngliche ZIP des Screenshot-Szenarios ist. Für dieses Original-ZIP liegt hier keine verifizierte Feldinventur vor; dessen fehlende Felder oder Fallzahlen dürfen nicht aus dem Standardexport abgeleitet werden.

## Screenshot-Abgleich und offene Validierung

Der dokumentierte Vergleich in `docs/adebis-capakita-vergleich.md` enthält aggregierte Screenshotwerte, aber keinen vollständigen Import des zugehörigen Originalexports. Beispielsweise nennt er für Januar `BuStdGew = 299`, Basiswert `1.563,88 €` und Förderung `19.483,34 €`; der bestehende Rechentest in `src/utils/adebisAnalysis.test.js` prüft diese Formel mit synthetischen Eingabewerten, nicht die Wiederherstellung des Screenshot-Datensatzes. Der dokumentierte Jahresunterschied beim Elternbeitragszuschuss beträgt 1.900 €. Ob erhaltene Schulkindmerkmale diese Abweichung erklären, ist nicht nachgewiesen.

Für einen belastbaren Abgleich müssen Originalexport und Monatswerte in einer geeigneten geschützten Umgebung erneut verglichen werden; insbesondere fehlen der kind- und monatsbezogene Nachweis des `SCHULKIND`-Wechsels sowie der Nachweis der Stunden- und Beitragsdifferenzen. Keine personenbezogenen Rohdaten, Screenshots mit Personenbezug oder Originalexporte ins Repository aufnehmen. Nur freigegebene, nicht rückverfolgbare Aggregatwerte bzw. vollständig synthetische Tests dokumentieren.
