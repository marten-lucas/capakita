import { describe, expect, it } from 'vitest';
import { computeUpgradeTarget, simulateZeitkatUpgrade } from './foerderSimulation';

const REF = '2026-03-15';
const RULE = [{ id: 'r1', baseValue: 11.0, validFrom: '2026-01-01', weightFactors: { regelkind_3to6: 1.0 } }];

const makeBooking = ({ itemId = 'child-1', zone = '05', art = '0', dailyHours = 4, days = 2 } = {}) => {
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const times = Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    day_name: dayNames[index],
    segments: [{
      booking_start: '07:00',
      booking_end: `${String(7 + dailyHours).padStart(2, '0')}:00`,
      category: 'pedagogical',
    }],
  }));
  return {
    id: `booking-${itemId}-${zone}`,
    itemId,
    groupId: 'g1',
    startdate: '2026-01-01',
    enddate: '',
    buchungsart: { code: art, label: art === '0' ? 'R' : art, gruppe: art === '0' ? 'regel' : 'ferien', basis: art === '0' },
    rawdata: { ZEITKAT: zone, ART: art },
    times,
  };
};

describe('computeUpgradeTarget (Zonensprünge)', () => {
  it('nextZone: nächsthöhere Zone', () => {
    expect(computeUpgradeTarget('05', { mode: 'nextZone' })).toBe('06');
    expect(computeUpgradeTarget('13', { mode: 'nextZone' })).toBeNull(); // höchste Zone
  });

  it('targetZone: nur aufwärts, sonst null', () => {
    expect(computeUpgradeTarget('05', { mode: 'targetZone', targetZeitkat: '07' })).toBe('07');
    expect(computeUpgradeTarget('07', { mode: 'targetZone', targetZeitkat: '05' })).toBeNull();
    expect(computeUpgradeTarget('07', { mode: 'targetZone', targetZeitkat: '07' })).toBeNull();
  });

  it('minHours: kleinste Zone ≥ Ziel, keine Änderung wenn abgedeckt', () => {
    expect(computeUpgradeTarget('04', { mode: 'minHours', minHours: 6 })).toBe('06');
    expect(computeUpgradeTarget('06', { mode: 'minHours', minHours: 6 })).toBeNull();
  });

  it('unbekannte Zone → null', () => {
    expect(computeUpgradeTarget('', {})).toBeNull();
    expect(computeUpgradeTarget('99', {})).toBeNull();
  });
});

describe('simulateZeitkatUpgrade – Förderdelta (RE-Formel)', () => {
  it('nextZone: Basiswert × Gewicht × ΔZeitfaktor, ×12 fürs Jahr', () => {
    // Zone 05 (1,25) → 06 (1,5): Δ = 11,0 × 1,0 × 0,25 = 2,75/Monat
    const result = simulateZeitkatUpgrade({
      demandBookings: [makeBooking({ zone: '05' })],
      dataItems: { 'child-1': { id: 'child-1', name: 'Kind A', dateofbirth: '2022-01-01' } },
      groupDefs: [{ id: 'g1', name: 'Fuchs' }],
      bayKiBiGRules: RULE,
      upgrade: { mode: 'nextZone', utilizationPercent: 100 },
      referenceDate: REF,
    });

    expect(result.totals.affectedChildren).toBe(1);
    expect(result.perChild[0].deltaMonthly).toBe(2.75);
    expect(result.perChild[0].deltaYearly).toBe(33);
    expect(result.totals.deltaMonthlyBayKiBiG).toBe(2.75);
    expect(result.totals.deltaYearlyBayKiBiG).toBe(33);
    expect(result.perChild[0].fromZone).toBe('05');
    expect(result.perChild[0].toZone).toBe('06');
  });

  it('Nutzungsgrad streckt Wochenstunden auf die Zielzone (100 % = voll)', () => {
    // 2 Tage × 4 h = 8 h; Zone 05 („>4-5") → 06 („>5-6", Obergrenze 6 h/Tag):
    // 100 % → 2 × 6 h = 12 h
    const full = simulateZeitkatUpgrade({
      demandBookings: [makeBooking({ zone: '05', dailyHours: 4, days: 2 })],
      dataItems: { 'child-1': { id: 'child-1', dateofbirth: '2022-01-01' } },
      groupDefs: [],
      bayKiBiGRules: RULE,
      upgrade: { mode: 'nextZone', utilizationPercent: 100 },
      referenceDate: REF,
    });
    expect(full.perChild[0].weeklyHoursAfter).toBe(12);
    expect(full.perChild[0].deltaWeeklyHours).toBe(4);
    expect(full.totals.deltaWeeklyDemandHours).toBe(4);

    // 0 % → Stunden unverändert, Förderdelta trotzdem voll (Anspruch)
    const none = simulateZeitkatUpgrade({
      demandBookings: [makeBooking({ zone: '05', dailyHours: 4, days: 2 })],
      dataItems: { 'child-1': { id: 'child-1', dateofbirth: '2022-01-01' } },
      groupDefs: [],
      bayKiBiGRules: RULE,
      upgrade: { mode: 'nextZone', utilizationPercent: 0 },
      referenceDate: REF,
    });
    expect(none.perChild[0].weeklyHoursAfter).toBe(8);
    expect(none.perChild[0].deltaWeeklyHours).toBe(0);
    expect(none.totals.deltaMonthlyBayKiBiG).toBe(2.75);
  });

  it('simulierte Buchungen tragen kein BETRSTD (Segment-Summe gilt nach Umstellung)', () => {
    const booking = makeBooking({ zone: '05', dailyHours: 4, days: 2 });
    booking.rawdata.BETRSTD = '25,5';
    const result = simulateZeitkatUpgrade({
      demandBookings: [booking],
      dataItems: { 'child-1': { id: 'child-1', dateofbirth: '2022-01-01' } },
      groupDefs: [],
      bayKiBiGRules: RULE,
      upgrade: { mode: 'nextZone', utilizationPercent: 100 },
      referenceDate: REF,
    });
    expect(result.simulatedBookings[0].rawdata.BETRSTD).toBeUndefined();
    expect(result.simulatedBookings[0].rawdata.ZEITKAT).toBe('06');
    // Wochenstunden nachher = skalierte Segmente (2 × 6 h), nicht 25,5
    expect(result.perChild[0].weeklyHoursAfter).toBe(12);
  });

  it('Alternativ-/Ferienbuchungen werden weder angehoben noch gezählt', () => {
    const result = simulateZeitkatUpgrade({
      demandBookings: [makeBooking({ zone: '05', art: 'F' })],
      dataItems: { 'child-1': { id: 'child-1', dateofbirth: '2022-01-01' } },
      groupDefs: [],
      bayKiBiGRules: RULE,
      upgrade: { mode: 'nextZone', utilizationPercent: 100 },
      referenceDate: REF,
    });
    expect(result.totals.affectedChildren).toBe(0);
    expect(result.perChild).toHaveLength(0);
  });

  it('Kinder ohne ZEITKAT werden als skippedNoZone gemeldet', () => {
    const booking = makeBooking({ zone: '' });
    const result = simulateZeitkatUpgrade({
      demandBookings: [booking],
      dataItems: { 'child-1': { id: 'child-1', dateofbirth: '2022-01-01' } },
      groupDefs: [],
      bayKiBiGRules: RULE,
      upgrade: { mode: 'nextZone', utilizationPercent: 100 },
      referenceDate: REF,
    });
    expect(result.totals.affectedChildren).toBe(0);
    expect(result.skippedNoZone).toBe(1);
  });

  it('minHours hebt nur an, wenn die Zone das Ziel nicht abdeckt', () => {
    const result = simulateZeitkatUpgrade({
      demandBookings: [makeBooking({ zone: '04', dailyHours: 3, days: 5 }), makeBooking({ itemId: 'child-2', zone: '06', dailyHours: 5, days: 5 })],
      dataItems: {
        'child-1': { id: 'child-1', name: 'Kleines Kind', dateofbirth: '2022-01-01' },
        'child-2': { id: 'child-2', name: 'Großes Kind', dateofbirth: '2022-01-01' },
      },
      groupDefs: [],
      bayKiBiGRules: RULE,
      upgrade: { mode: 'minHours', minHours: 6, utilizationPercent: 100 },
      referenceDate: REF,
    });
    expect(result.totals.affectedChildren).toBe(1);
    expect(result.perChild[0].name).toBe('Kleines Kind');
    expect(result.perChild[0].toZone).toBe('06');
  });
});

describe('simulateZeitkatUpgrade – Familien + Elternbeitragsbänder', () => {
  it('aggregiert Geschwister zur Familie (neue familyId-Logik)', () => {
    const result = simulateZeitkatUpgrade({
      demandBookings: [
        makeBooking({ itemId: 'child-1', zone: '05' }),
        makeBooking({ itemId: 'child-2', zone: '05' }),
      ],
      dataItems: {
        'child-1': { id: 'child-1', name: 'A', familyId: 'fam-1', familyLabel: 'Familie Reuter', dateofbirth: '2022-01-01' },
        'child-2': { id: 'child-2', name: 'B', familyId: 'fam-1', familyLabel: 'Familie Reuter', dateofbirth: '2019-01-01' },
      },
      groupDefs: [],
      bayKiBiGRules: RULE,
      upgrade: { mode: 'nextZone', utilizationPercent: 100 },
      referenceDate: REF,
    });

    expect(result.totals.affectedFamilies).toBe(1);
    expect(result.families[0]).toMatchObject({ label: 'Familie Reuter', affectedChildren: 2, deltaMonthly: 5.5 });
  });

  it('markiert Elternbeitrags-Bandwechsel bei Stundenanstieg', () => {
    // 1 Tag × 4 h = 4 h → Band 4 (40 €); nach Upgrade (Zone 05): 5 h → Band 9 (70 €)
    const catalogs = {
      g1: [
        { id: 'band-4', maxHours: 4, monthlyAmount: 40 },
        { id: 'band-9', maxHours: 9, monthlyAmount: 70 },
      ],
    };
    const result = simulateZeitkatUpgrade({
      demandBookings: [makeBooking({ zone: '04', dailyHours: 4, days: 1 })],
      dataItems: { 'child-1': { id: 'child-1', dateofbirth: '2022-01-01' } },
      groupDefs: [],
      bayKiBiGRules: RULE,
      groupFeeCatalogs: catalogs,
      upgrade: { mode: 'nextZone', utilizationPercent: 100 },
      referenceDate: REF,
    });

    expect(result.perChild[0].parentFeeBefore).toBe(40);
    expect(result.perChild[0].parentFeeAfter).toBe(70);
    expect(result.perChild[0].feeBandChange).toBe(true);
    expect(result.totals.deltaParentFees).toBe(30);
  });
});
