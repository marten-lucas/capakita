/**
 * adebisKITA-Domainkataloge, verifiziert durch Reverse Engineering (adebisKITA 7.5.5).
 *
 * Quellen:
 * - Vendor-Seed-Tabellen aus dem offiziellen Update-Paket (system/zeitkat.dbf, gewkat.dbf, qualifik.dbf)
 * - FRX-Report-Decoder: icase(art=="0","R", art $"AB","A", art $"FGH","F", art=="K","K","")
 * - Handbuch adebisKITA 7 (Kap. 10 Analyse und Analysemodelle, BayKiBiG/AVBayKiBiG)
 *
 * Die Faktoren sind die Grundlage des BayKiBiG-Anstellungsschlüssels:
 *   Förderbetrag = Basiswert × Buchungszeitfaktor × Gewichtungsfaktor
 */

// Stundenzonen-Katalog (Buchungszeitkategorien). id = belegung.ZEITKAT (C2).
// faktor = Buchungszeitfaktor laut § 19 Abs. 1 AVBayKiBiG (Vendor-Default).
// minHours/maxHours = tagesbezogene Zonengrenzen (aus bez; maxHours = inklusive
// Obergrenze; Zone '>12' wird im Simulationsmodell bei 13 h gedeckelt).
export const ZEITKAT_CATALOG = [
  { id: '01', faktor: 0.5, kennz: '1', kurzbez: '>1-2', bez: 'über 1 bis incl. 2 Stunden', minHours: 1, maxHours: 2 },
  { id: '02', faktor: 0.75, kennz: '2', kurzbez: '>2-3', bez: 'über 2 bis incl. 3 Stunden', minHours: 2, maxHours: 3 },
  { id: '04', faktor: 1.0, kennz: '3', kurzbez: '>3-4', bez: 'über 3 bis incl. 4 Stunden', minHours: 3, maxHours: 4 },
  { id: '05', faktor: 1.25, kennz: '4', kurzbez: '>4-5', bez: 'über 4 bis incl. 5 Stunden', minHours: 4, maxHours: 5 },
  { id: '06', faktor: 1.5, kennz: '5', kurzbez: '>5-6', bez: 'über 5 bis incl. 6 Stunden', minHours: 5, maxHours: 6 },
  { id: '07', faktor: 1.75, kennz: '6', kurzbez: '>6-7', bez: 'über 6 bis incl. 7 Stunden', minHours: 6, maxHours: 7 },
  { id: '08', faktor: 2.0, kennz: '7', kurzbez: '>7-8', bez: 'über 7 bis incl. 8 Stunden', minHours: 7, maxHours: 8 },
  { id: '09', faktor: 2.25, kennz: '8', kurzbez: '>8-9', bez: 'über 8 bis incl. 9 Stunden', minHours: 8, maxHours: 9 },
  { id: '10', faktor: 2.5, kennz: '9', kurzbez: '>9-10', bez: 'über 9 bis incl. 10 Stunden', minHours: 9, maxHours: 10 },
  { id: '11', faktor: 2.5, kennz: '10', kurzbez: '>10-11', bez: 'über 10 bis incl. 11 Stunden', minHours: 10, maxHours: 11 },
  { id: '12', faktor: 2.5, kennz: '11', kurzbez: '>11-12', bez: 'über 11 bis incl. 12 Stunden', minHours: 11, maxHours: 12 },
  { id: '13', faktor: 2.5, kennz: '12', kurzbez: '>12', bez: 'über 12 Stunden', minHours: 12, maxHours: 13 },
];

// Gewichtungskategorien (KiföG/BayKiBiG). id = belegung.GEWKAT (C2).
// faktor = Gewichtungsfaktor (Vendor-Default, § 21 Abs. 4 BayKiBiG).
export const GEWKAT_CATALOG = [
  { id: 'R', faktor: 1.0, bez: 'Regelfall Kindergarten' },
  { id: 'A', faktor: 1.3, bez: 'Kindergarten/Ausländer' },
  { id: 'B', faktor: 4.5, bez: 'Kindergarten/behindert' },
  { id: 'D', faktor: 2.0, bez: 'Regelfall unter 3-Jährige' },
  { id: 'DA', faktor: 2.0, bez: 'unter 3 / Ausländer' },
  { id: 'DB', faktor: 4.5, bez: 'unter 3 / behindert' },
  { id: 'K', faktor: 1.2, bez: 'Schulkind in Kiga' },
  { id: 'KA', faktor: 1.3, bez: 'Schulkind in Kiga/Ausl.' },
  { id: 'KB', faktor: 4.5, bez: 'Schulkind in Kiga/beh.' },
  { id: 'S', faktor: 1.2, bez: 'Regelfall Hort' },
  { id: 'SA', faktor: 1.3, bez: 'Hort / Ausländer' },
  { id: 'SB', faktor: 4.5, bez: 'Hort / behindert' },
];

/**
 * Qualifikationskatalog (system/qualifik.dbf, Vendor-Default).
 * typ entspricht der adebis-Klassifikation für Anstellungsschlüssel/Fachkraftquote:
 * - 'Fachkraft' zählt in die Fachkraftquote (≥ 50 %)
 * - 'Ergänzungskraft' zählt NICHT als Fachkraft
 * - 'Fehlzeit'/'ungueltig' sind Fehlzeit-Codes (keine Anstellung)
 */
export const QUALIFIKATION_CATALOG = {
  E: { name: 'Erzieher/in - Fachkraft', typ: 'Fachkraft', isExpert: true },
  S: { name: 'Sozialpädagog/e/in - Fachkraft', typ: 'Fachkraft', isExpert: true },
  H: { name: 'Heilpädagog/e/in - Fachkraft', typ: 'Fachkraft', isExpert: true },
  P: { name: 'Heilerziehungspfleger/in - Fachkraft', typ: 'Fachkraft', isExpert: true },
  K: { name: 'Kinderpfleger/in - Ergänzungskraft', typ: 'Ergänzungskraft', isExpert: false },
  B: { name: 'Berufspraktikant/in - Ergänzungskraft', typ: 'Ergänzungskraft', isExpert: false },
  N: { name: 'hauswirtschaftl.- technisches Personal', typ: 'Ergänzungskraft', isExpert: false },
  V: { name: 'Erzieherpraktikant/in (SPS)', typ: null, isExpert: false },
  1: { name: 'Krankheit ( > 4 Wochen)', typ: 'ungueltig', isExpert: false },
  2: { name: 'Elternzeit', typ: 'Fehlzeit', isExpert: false },
  3: { name: 'Sabbatjahr', typ: 'Fehlzeit', isExpert: false },
  4: { name: 'Sonderurlaub', typ: 'Fehlzeit', isExpert: false },
};

/**
 * Buchungsarten (belegung.ART, C1) – exakt der FRX-Decoder aus adebisKITA 7.5.5:
 *   icase(art=="0","R", art $"AB","A", art $"FGH","F", art=="K","K","")
 * - 0            = Standard-/Regelbuchung (min. 15 Betriebstage, AVBayKiBiG §20)
 * - A / B        = Alternativbuchung 1 / 2 (max. 2 je Regelbuchung, Anteil in %)
 * - F / G / H    = Ferienbuchung 1 / 2 / 3 (innerhalb der Regelbuchung)
 * - K            = Kurzzeitbuchung (außerhalb der Regelbuchung)
 * - ''           = ältere Bestände ohne ART-Feld (wie Regel behandeln)
 */
export const BUCHUNGSART_CATALOG = {
  0: { code: '0', label: 'R', name: 'Standard-/Regelbuchung', gruppe: 'regel', basis: true },
  A: { code: 'A', label: 'A', name: 'Alternativbuchung 1', gruppe: 'alternativ', basis: false },
  B: { code: 'B', label: 'A', name: 'Alternativbuchung 2', gruppe: 'alternativ', basis: false },
  F: { code: 'F', label: 'F', name: 'Ferienbuchung 1', gruppe: 'ferien', basis: false },
  G: { code: 'G', label: 'F', name: 'Ferienbuchung 2', gruppe: 'ferien', basis: false },
  H: { code: 'H', label: 'F', name: 'Ferienbuchung 3', gruppe: 'ferien', basis: false },
  // K = Kurzzeit: adebis behandelt art IN ('0','K') als bedarfsrelevant
  // (Statistik-/Analyse-SQL in kita.exe) → basis=true, aber eigene Gruppe.
  K: { code: 'K', label: 'K', name: 'Kurzzeitbuchung', gruppe: 'kurzzeit', basis: true },
};

/**
 * Adebis-Logikflag (VFP-Export als ".T."/".F.") robust auswerten.
 * Zentrale Definition (zuvor in chartUtils, dort weiterhin re-exportiert).
 */
export function isAdebisTrue(value) {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const v = value.trim().toUpperCase();
  return v === '.T.' || v === 'T' || v === 'TRUE' || v === '1';
}

/** Liefert den Buchungszeitfaktor für eine Zeitkategorie-ID (null = unbekannt). */
export function getZeitkatFactor(zeitkatId) {
  if (!zeitkatId) return null;
  const id = String(zeitkatId).trim();
  const entry = ZEITKAT_CATALOG.find((z) => z.id === id);
  return entry ? entry.faktor : null;
}

/** Liefert die tagesbezogenen Zonengrenzen { minHours, maxHours } (null = unbekannt). */
export function getZeitkatZoneBounds(zeitkatId) {
  if (!zeitkatId) return null;
  const id = String(zeitkatId).trim();
  const entry = ZEITKAT_CATALOG.find((z) => z.id === id);
  return entry ? { minHours: entry.minHours, maxHours: entry.maxHours } : null;
}

/**
 * ZEITKAT-Schlüssel eines Beitragssatzes. Frühere Capakita-Imports speicherten
 * BETRAGZn fälschlich als Wochenstundenband, ließen den Schlüssel aber im stabilen
 * Import-ID-Muster `bart<BARTNR>-z<ZEITKAT>-...` stehen; damit werden solche bereits
 * gespeicherten Kataloge ohne Neuimport sicher migriert.
 */
export function getFeeBandZeitkatId(entry) {
  const explicit = String(entry?.zeitkatId || '').trim();
  if (ZEITKAT_CATALOG.some((zone) => zone.id === explicit)) return explicit;
  const legacyImportId = /^bart[^-]*-z(\d{2})-/i.exec(String(entry?.id || ''));
  const inferred = legacyImportId?.[1] || '';
  return ZEITKAT_CATALOG.some((zone) => zone.id === inferred) ? inferred : null;
}

/** Position einer Zeitkategorie im Katalog (für Zonensprünge; -1 = unbekannt). */
export function getZeitkatZoneIndex(zeitkatId) {
  if (!zeitkatId) return -1;
  const id = String(zeitkatId).trim();
  return ZEITKAT_CATALOG.findIndex((z) => z.id === id);
}

/** Liefert den Gewichtungsfaktor für eine Gewichtungskategorie-ID (null = unbekannt). */
export function getGewkatFactor(gewkatId) {
  if (!gewkatId) return null;
  const id = String(gewkatId).trim();
  const entry = GEWKAT_CATALOG.find((g) => g.id === id);
  return entry ? entry.faktor : null;
}

/**
 * Dekodiert belegung.ART in { code, label, name, gruppe, basis }.
 * Fehlender/leerer Code (ältere Bestände) wird wie Regelbuchung behandelt,
 * unbekannte Codes als regel-basiert mit roh-code erhalten.
 */
export function decodeBuchungsart(artCode) {
  const code = artCode == null ? '' : String(artCode).trim();
  if (code === '') {
    return { code: '', label: 'R', name: 'Standard-/Regelbuchung', gruppe: 'regel', basis: true };
  }
  const known = BUCHUNGSART_CATALOG[code];
  if (known) return { ...known };
  // Unbekannter Code: konservativ als regel-basiert behandeln (kann keine Doppelzählung erzeugen)
  return { code, label: 'R', name: `Unbekannte Buchungsart (${code})`, gruppe: 'regel', basis: true };
}

/** Klassifikation einer Qualifikation: { name, typ, isExpert } (null = unbekannt). */
export function qualifikationInfo(qualifikCode) {
  if (!qualifikCode) return null;
  const code = String(qualifikCode).trim();
  const entry = QUALIFIKATION_CATALOG[code];
  return entry ? { ...entry } : null;
}
