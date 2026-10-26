import { describe, it, expect } from 'vitest';
import {
  ZEITKAT_CATALOG,
  GEWKAT_CATALOG,
  getZeitkatFactor,
  getGewkatFactor,
  decodeBuchungsart,
  qualifikationInfo,
} from './adebisConstants';

describe('adebisConstants – Zeitkataloge (RE: vendor seed system/zeitkat.dbf)', () => {
  it('liefert die BayKiBiG-Buchungszeitfaktoren (§ 19 Abs. 1 AVBayKiBiG)', () => {
    expect(getZeitkatFactor('01')).toBe(0.5);
    expect(getZeitkatFactor('02')).toBe(0.75);
    expect(getZeitkatFactor('04')).toBe(1.0);
    expect(getZeitkatFactor('08')).toBe(2.0);
    expect(getZeitkatFactor('09')).toBe(2.25);
    // Deckelung ab 9 Stunden
    expect(getZeitkatFactor('10')).toBe(2.5);
    expect(getZeitkatFactor('13')).toBe(2.5);
  });

  it('ist robust gegenüber Whitespace und unbekannten IDs', () => {
    expect(getZeitkatFactor(' 04 ')).toBe(1.0);
    expect(getZeitkatFactor('99')).toBeNull();
    expect(getZeitkatFactor('')).toBeNull();
    expect(getZeitkatFactor(null)).toBeNull();
  });

  it('enthält die 12 Vendor-Zeitzonen ohne Deckelungslücke', () => {
    expect(ZEITKAT_CATALOG).toHaveLength(12);
    expect(ZEITKAT_CATALOG.every((z) => z.faktor >= 0.5 && z.faktor <= 2.5)).toBe(true);
  });
});

describe('adebisConstants – Gewichtungskataloge (RE: vendor seed system/gewkat.dbf)', () => {
  it('liefert die Gewichtungsfaktoren (§ 21 Abs. 4 BayKiBiG)', () => {
    expect(getGewkatFactor('R')).toBe(1.0);
    expect(getGewkatFactor('A')).toBe(1.3);
    expect(getGewkatFactor('B')).toBe(4.5);
    expect(getGewkatFactor('D')).toBe(2.0);
    expect(getGewkatFactor('K')).toBe(1.2);
    expect(getGewkatFactor('S')).toBe(1.2);
    expect(getGewkatFactor('SA')).toBe(1.3);
    expect(getGewkatFactor('SB')).toBe(4.5);
  });

  it('kennt alle 12 Vendor-Gewichtungskategorien', () => {
    expect(GEWKAT_CATALOG).toHaveLength(12);
  });
});

describe('adebisConstants – Buchungsarten (RE: FRX-Decoder icase(art=="0","R", art $"AB","A", art $"FGH","F", art=="K","K"))', () => {
  it('dekodiert die ART-Codes wie adebisKITA 7.5.5', () => {
    expect(decodeBuchungsart('0')).toMatchObject({ label: 'R', gruppe: 'regel', basis: true });
    expect(decodeBuchungsart('A')).toMatchObject({ label: 'A', gruppe: 'alternativ', basis: false });
    expect(decodeBuchungsart('B')).toMatchObject({ label: 'A', gruppe: 'alternativ', basis: false });
    expect(decodeBuchungsart('F')).toMatchObject({ label: 'F', gruppe: 'ferien', basis: false });
    expect(decodeBuchungsart('G')).toMatchObject({ label: 'F', gruppe: 'ferien', basis: false });
    expect(decodeBuchungsart('H')).toMatchObject({ label: 'F', gruppe: 'ferien', basis: false });
    expect(decodeBuchungsart('K')).toMatchObject({ label: 'K', gruppe: 'kurzzeit', basis: true });
  });

  it('behandelt leere ART (ältere Bestände) wie Regelbuchung', () => {
    expect(decodeBuchungsart('')).toMatchObject({ gruppe: 'regel', basis: true });
    expect(decodeBuchungsart(null)).toMatchObject({ gruppe: 'regel', basis: true });
  });
});

describe('adebisConstants – Qualifikationen (RE: vendor seed system/qualifik.dbf)', () => {
  it('klassifiziert Fachkräfte korrekt', () => {
    expect(qualifikationInfo('E')).toMatchObject({ typ: 'Fachkraft', isExpert: true });
    expect(qualifikationInfo('S')).toMatchObject({ typ: 'Fachkraft', isExpert: true });
    expect(qualifikationInfo('H')).toMatchObject({ typ: 'Fachkraft', isExpert: true });
    expect(qualifikationInfo('P')).toMatchObject({ typ: 'Fachkraft', isExpert: true });
  });

  it('schließt Ergänzungskräfte und Fehlzeitcodes aus der Fachkraftquote aus', () => {
    expect(qualifikationInfo('K')).toMatchObject({ typ: 'Ergänzungskraft', isExpert: false });
    expect(qualifikationInfo('B')).toMatchObject({ typ: 'Ergänzungskraft', isExpert: false });
    expect(qualifikationInfo('N')).toMatchObject({ isExpert: false });
    expect(qualifikationInfo('V')).toMatchObject({ isExpert: false });
    expect(qualifikationInfo('2')).toMatchObject({ typ: 'Fehlzeit', isExpert: false });
    expect(qualifikationInfo('1')).toMatchObject({ typ: 'ungueltig', isExpert: false });
  });

  it('liefert null für unbekannte/leere Codes', () => {
    expect(qualifikationInfo('X9')).toBeNull();
    expect(qualifikationInfo('')).toBeNull();
    expect(qualifikationInfo(null)).toBeNull();
  });
});
