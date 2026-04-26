# Anwenderdokumentation

## Zweck der Anwendung

CapaKita unterstützt bei der Planung von Kita- und Kindergarten-Szenarien. Im Mittelpunkt stehen Import, Datenpflege, Szenarien und die Auswertung von Bedarf und Kapazität.

## Schnellstart

### 1. Daten importieren
- Startseite öffnen
- Aktion Daten importieren wählen
- Adebis-ZIP auswählen
- Import bestätigen

Alternativ kann ein leeres Szenario ohne Import gestartet werden.

### 2. Szenario bearbeiten
Unter Optionen können Szenarien, Gruppen und Qualifikationen gepflegt werden.

Typische Schritte:
- neues Szenario anlegen
- Gruppe definieren
- Qualifikation definieren
- Daten im Bereich Daten ergänzen oder anpassen

### 3. Daten pflegen
Im Bereich Daten können manuell angelegt oder importiert werden:
- Bedarfseinträge für Kinder
- Kapazitätseinträge für Mitarbeitende
- Buchungszeiträume
- Gruppenzuweisungen

### 4. Analyse verwenden
Im Bereich Analyse stehen aktuell diese Kernauswertungen bereit:
- Regelbetrieb
- Langzeit
- Buchungsverteilung

Zusätzlich können gesetzt werden:
- Stichtag
- Gruppenfilter
- Qualifikationsfilter
- Zeitdimension für Langzeit

## Diagrammdeutung

### Regelbetrieb
Zeigt Bedarf und Kapazität entlang der Öffnungszeit. Damit lassen sich Über- und Unterdeckungen schnell erkennen.

### Langzeit
Zeigt die Entwicklung über Woche, Monat, Quartal oder Jahr. Geeignet für saisonale oder szenariobedingte Veränderungen.

### Buchungsverteilung
Zeigt die Verteilung der Buchungsstunden und macht Häufungen sichtbar.

## Statistik-Seite

Die Statistik-Seite ist nur bei importierten Adebis-Daten sichtbar.

### Historische Kennzahlen
- Kinderzahl
- Buchungsstunden
- Betreuungsstunden

Die Darstellung ist umschaltbar nach:
- Monat
- Quartal
- Jahr

### Gruppenübergänge
Die Statistik zeigt für Gruppenwechsel:
- Datum und Wechselrichtung (von Gruppe zu Gruppe)
- Alter beim Übergang
- Buchungszeit vorher und nachher (90-Tage-Fenster)
- Delta in Stunden und Prozent

Zusätzlich gibt es ein Histogramm für das Alter beim Übergang.

### Filter
Für Gruppenübergänge sind folgende Filter verfügbar:
- Zeitraum: Gesamt, letzte 12 Monate, letzte 24 Monate
- Von-Gruppe
- Zu-Gruppe

## Auto-Events in Optionen

Im Tab Optionen → Ereignisse gibt es den Bereich Auto-Event Einstellungen.

Dort können für beide Standard-Wechsel konfiguriert werden:
- Zeitpunkt des Wechsels (Alter in Jahren)
- erwartete Änderung der Buchungszeit (Stunden pro Woche)

Konfigurierbare Wechsel:
- Krippe → Kita
- Kita → Schulkindbetreuung

Mit dem Button Werte in Statistik belegen werden die aktuellen Einstellungen als Referenz in die Statistik übernommen.
Diese Belegung wird auf der Statistik-Seite als eigene Hinweisbox angezeigt.

## Szenarien speichern und laden

### Speichern
- Aktionen öffnen
- Szenario speichern wählen
- Passwort vergeben und bestätigen
- Datei lokal sichern

### Laden
- auf der Startseite Szenario laden wählen
- gespeicherte Datei auswählen
- Passwort eingeben
- Szenario laden

## Qualitätssicherung

Das Projekt wird über Smoke-Tests, End-to-End-Tests, Linting und Build-Prüfungen abgesichert.
