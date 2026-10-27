import { describe, expect, it } from 'vitest';
import {
  calculateChildMonthlyRevenue,
  resolveZeitkatFactorForChild,
} from './financeUtils';

const REF = '2026-03-15';

const basisBooking = (overrides = {}) => ({
  id: 'b1',
  startdate: '2026-01-01',
  enddate: '',
  buchungsart: { code: '0', label: 'R', name: 'Standard-/Regelbuchung', gruppe: 'regel', basis: true },
  rawdata: { ZEITKAT: '06', ART: '0' },
  times: [
    { day: 1, day_name: 'Mo', segments: [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' }] },
    { day: 2, day_name: 'Di', segments: [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' }] },
    { day: 3, day_name: 'Mi', segments: [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' }] },
    { day: 4, day_name: 'Do', segments: [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' }] },
    { day: 5, day_name: 'Fr', segments: [{ booking_start: '07:00', booking_end: '13:00', category: 'pedagogical' }] },
  ],
  ...overrides,
});

describe('adebisFörder – resolveZeitkatFactorForChild (RE §19/§21)', () => {
  it('liefert den Faktor der aktiven Basisbuchung', () => {
    expect(resolveZeitkatFactorForChild([basisBooking()], REF)).toBe(1.5);
  });

  it('ignoriert Alternativ-/Ferienbuchungen (kein eigener Förderanspruch)', () => {
    const ferien = basisBooking({ id: 'b0', startdate: '2026-03-01', rawdata: { ZEITKAT: '13', ART: 'F' }, buchungsart: { code: 'F', label: 'F', name: 'Ferienbuchung 1', gruppe: 'ferien', basis: false } });
    expect(resolveZeitkatFactorForChild([ferien, basisBooking()], REF)).toBe(1.5);
    expect(resolveZeitkatFactorForChild([ferien], REF)).toBeNull();
  });

  it('nutzt bei mehreren Basisbuchungen die mit dem neuesten Startdatum', () => {
    const older = basisBooking({ id: 'b-old', startdate: '2025-01-01', rawdata: { ZEITKAT: '04', ART: '0' } });
    const newer = basisBooking({ id: 'b-new', startdate: '2026-02-01', rawdata: { ZEITKAT: '08', ART: '0' } });
    expect(resolveZeitkatFactorForChild([older, newer], REF)).toBe(2.0);
  });

  it('ignoriert Buchungen, die am Stichtag nicht aktiv sind', () => {
    const past = basisBooking({ enddate: '2026-01-31' });
    expect(resolveZeitkatFactorForChild([past], REF)).toBeNull();
  });

  it('liefert null ohne ZEITKAT (Legacy-Daten)', () => {
    const legacy = basisBooking({ rawdata: { ART: '0' } });
    expect(resolveZeitkatFactorForChild([legacy], REF)).toBeNull();
  });
});

describe('adebisFörder – calculateChildMonthlyRevenue mit Zeitfaktor (gated)', () => {
  const item = {
    type: 'demand',
    startdate: '2026-01-01',
    enddate: '',
    dateofbirth: '2022-03-01', // 3 Jahre alt am Stichtag → Regelkind 1,0
  };
  const financeScenario = {
    bayKiBiGRules: [{ id: 'r1', baseValue: 11.0, validFrom: '2026-01-01', weightFactors: { regelkind_3to6: 1.0 } }],
  };

  it('Default (aus): bayKiBiGAmount = Basiswert × Gewicht, Zeitfaktor 1', () => {
    const result = calculateChildMonthlyRevenue({
      item, bookings: [basisBooking()], groupAssignments: {}, groupDefs: [],
      financeScenario, referenceDate: REF,
    });
    expect(result.bayKiBiGWeight).toBe(1);
    expect(result.bayKiBiGAmount).toBe(11.0);
    expect(result.zeitkatFactor).toBe(1);
  });

  it('Aktiviert: bayKiBiGAmount = Basiswert × Gewicht × Zeitfaktor (RE-Formel)', () => {
    const result = calculateChildMonthlyRevenue({
      item, bookings: [basisBooking()], groupAssignments: {}, groupDefs: [],
      financeScenario, referenceDate: REF, applyZeitkatFactor: true,
    });
    expect(result.zeitkatFactor).toBe(1.5);
    expect(result.bayKiBiGAmount).toBe(16.5);
  });

  it('ohne ZEITKAT fällt der aktivierte Faktor auf 1 zurück (rückwärtskompatibel)', () => {
    const result = calculateChildMonthlyRevenue({
      item, bookings: [basisBooking({ rawdata: { ART: '0' } })], groupAssignments: {}, groupDefs: [],
      financeScenario, referenceDate: REF, applyZeitkatFactor: true,
    });
    expect(result.zeitkatFactor).toBe(1);
    expect(result.bayKiBiGAmount).toBe(11.0);
  });
});
