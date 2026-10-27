import { describe, expect, it } from 'vitest';
import { simulateContributionChanges } from './foerderSimulation';

const REF = '2026-03-15';
const RULES = [{
  id: 'rule-1',
  baseValue: 11,
  validFrom: '2026-01-01',
  weightFactors: { regelkind_3to6: 1 },
}];

function makeBooking({ itemId = 'child-1', groupId = 'g1', zone = '04', art = '0', dailyHours = 3, days = 1 } = {}) {
  return {
    id: `booking-${itemId}-${zone}`,
    itemId,
    groupId,
    startdate: '2026-01-01',
    enddate: '',
    buchungsart: { code: art, basis: art === '0' },
    rawdata: { ZEITKAT: zone, ART: art },
    times: Array.from({ length: days }, (_, index) => ({
      day: index + 1,
      segments: [{
        booking_start: '07:00',
        booking_end: `${String(7 + dailyHours).padStart(2, '0')}:00`,
        category: 'pedagogical',
      }],
    })),
  };
}

function makeCatalog({ source = 100, next = 200 } = {}) {
  return {
    g1: [
      { id: 'zone-04', zeitkatId: '04', monthlyAmount: source, validFrom: '2026-01-01' },
      { id: 'zone-05', zeitkatId: '05', monthlyAmount: next, validFrom: '2026-01-01' },
    ],
  };
}

const CHILD = {
  'child-1': { id: 'child-1', name: 'Kind A', dateofbirth: '2022-01-01', familyId: 'fam-1', familyLabel: 'Familie A', groupId: 'g1' },
};

function runSimulation({ utilizationPercent = 100, source = 100, next = 200, temporaryPrices = {}, bookings = [makeBooking()] } = {}) {
  return simulateContributionChanges({
    demandBookings: bookings,
    dataItems: CHILD,
    groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
    bayKiBiGRules: RULES,
    groupFeeCatalogs: makeCatalog({ source, next }),
    temporaryPrices,
    utilizationPercent,
    referenceDate: REF,
  });
}

describe('simulateContributionChanges', () => {
  it('berechnet absolute Simulationspreise und anteilige Wechsel bei gleichem Staffelpreis', () => {
    const result = runSimulation({
      utilizationPercent: 50,
      temporaryPrices: { g1: { '04': 150, '05': 150 } },
    });

    // Hälfte von 3 h/Tag wechselt in die 5 h-Obergrenze: +1 Wochenstunde.
    expect(result.totals.bookingHoursBefore).toBe(3);
    expect(result.totals.bookingHoursAfter).toBe(4);
    expect(result.totals.migratedBookings).toBe(0.5);
    // Δ-Förderung = 11 € × (1,25 - 1,0) × 50 %.
    expect(result.totals.deltaMonthlyBayKiBiG).toBe(1.38);
    // Der Beitrag wird auf den absoluten Simulationspreis 150 € gesetzt.
    expect(result.totals.deltaParentFees).toBe(50);
    expect(result.totals.deltaMonthlyTotal).toBe(51.38);
    expect(result.totals).toMatchObject({
      childrenWithMoreHours: 1,
      familiesWithMoreHours: 1,
      weeklyHoursAdded: 1,
      childrenWithHigherFees: 1,
      familiesWithHigherFees: 1,
      monthlyParentCostIncrease: 50,
      childrenWithLowerFees: 0,
      familiesWithLowerFees: 0,
    });
    expect(result.families[0]).toMatchObject({
      childrenWithMoreHours: 1,
      childrenWithHigherFees: 1,
      weeklyHoursAdded: 1,
      monthlyParentCostIncrease: 50,
    });
    expect(result.groups[0]).toMatchObject({
      name: 'Sonnengruppe',
      bookings: 1,
      migratedBookings: 0.5,
      bookingHoursBefore: 3,
      bookingHoursAfter: 4,
      deltaMonthlyFunding: 1.38,
      deltaMonthlyParentFees: 50,
      deltaMonthlyTotal: 51.38,
    });
    expect(result.perChild[0]).toMatchObject({
      parentFeeBefore: 100,
      parentFeeAfter: 150,
      deltaMonthlyParentFees: 50,
      deltaWeeklyHours: 1,
    });
  });

  it('wechselt nicht, wenn die absoluten Simulationspreise benachbarter Staffeln verschieden sind', () => {
    const result = runSimulation({
      utilizationPercent: 100,
      temporaryPrices: { g1: { '04': 150, '05': 200 } },
    });

    expect(result.totals.migratedBookings).toBe(0);
    expect(result.totals.bookingHoursAfter).toBe(3);
    expect(result.totals.deltaMonthlyBayKiBiG).toBe(0);
    expect(result.totals.deltaParentFees).toBe(50);
  });

  it('wendet Ausschöpfungsquote 0 auf Wechsel, aber nicht auf Preisänderungen an', () => {
    const result = runSimulation({
      utilizationPercent: 0,
      temporaryPrices: { g1: { '04': 150, '05': 150 } },
    });

    expect(result.totals.migratedBookings).toBe(0);
    expect(result.totals.deltaWeeklyDemandHours).toBe(0);
    expect(result.totals.deltaMonthlyBayKiBiG).toBe(0);
    expect(result.totals.deltaParentFees).toBe(50);
  });

  it('weist Elternbeitragsentlastungen getrennt von Mehrkosten aus', () => {
    const result = runSimulation({
      utilizationPercent: 0,
      temporaryPrices: { g1: { '04': 50 } },
    });

    expect(result.totals.childrenWithHigherFees).toBe(0);
    expect(result.totals.monthlyParentCostIncrease).toBe(0);
    expect(result.totals.childrenWithLowerFees).toBe(1);
    expect(result.totals.familiesWithLowerFees).toBe(1);
    expect(result.totals.monthlyParentCostReduction).toBe(50);
    expect(result.families[0].monthlyParentCostReduction).toBe(50);
  });

  it('berechnet Gruppen- und Gesamtwerte über mehrere Gruppen', () => {
    const bookings = [
      makeBooking({ itemId: 'child-1', groupId: 'g1' }),
      makeBooking({ itemId: 'child-2', groupId: 'g2' }),
    ];
    const result = simulateContributionChanges({
      demandBookings: bookings,
      dataItems: {
        ...CHILD,
        'child-2': { id: 'child-2', name: 'Kind B', dateofbirth: '2022-01-01', groupId: 'g2' },
      },
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }, { id: 'g2', name: 'Regenbogengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: {
        ...makeCatalog(),
        g2: [
          { id: 'g2-zone-04', zeitkatId: '04', monthlyAmount: 80, validFrom: '2026-01-01' },
          { id: 'g2-zone-05', zeitkatId: '05', monthlyAmount: 120, validFrom: '2026-01-01' },
        ],
      },
      temporaryPrices: { g1: { '04': 150, '05': 150 } },
      utilizationPercent: 100,
      referenceDate: REF,
    });

    expect(result.groups.map(({ name }) => name)).toEqual(['Regenbogengruppe', 'Sonnengruppe']);
    expect(result.totals.bookingHoursBefore).toBe(6);
    expect(result.totals.bookingHoursAfter).toBe(8);
    expect(result.totals.migratedBookings).toBe(1);
    expect(result.totals.deltaMonthlyBayKiBiG).toBe(2.75);
    expect(result.totals.deltaParentFees).toBe(50);
    expect(result.totals.deltaYearlyTotal).toBe(633);
  });

  it('ignoriert Alternativ- und Ferienbuchungen und zählt ZEITKAT ohne Buchungszeiten als nicht ableitbar', () => {
    const result = runSimulation({
      bookings: [makeBooking({ art: 'F' }), makeBooking({ itemId: 'child-2', zone: '', days: 0 })],
    });
    expect(result.totals.bookingHoursBefore).toBe(0);
    expect(result.totals.affectedChildren).toBe(0);
    expect(result.skippedNoZone).toBe(1);
  });

  it('leitet fehlende ZEITKAT aus Capakita-Buchungszeiten ab und simuliert JSON-Wochenstunden-Bänder', () => {
    const booking = makeBooking({ zone: '', dailyHours: 3, days: 3 });
    const result = simulateContributionChanges({
      demandBookings: [booking],
      dataItems: CHILD,
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: {
        g1: [
          { id: 'json-tier-10', label: 'Staffel bis 10 h', maxHours: 10, monthlyAmount: 100 },
          { id: 'json-tier-20', label: 'Staffel bis 20 h', maxHours: 20, monthlyAmount: 200 },
        ],
      },
      temporaryPrices: { g1: { 'band:json-tier-10': 150, 'band:json-tier-20': 150 } },
      utilizationPercent: 50,
      referenceDate: REF,
    });

    expect(result.perChild[0]).toMatchObject({
      fromZone: '02',
      toZone: '07',
      weeklyHoursBefore: 9,
      weeklyHoursAfter: 14.5,
      deltaWeeklyHours: 5.5,
      parentFeeBefore: 100,
      parentFeeAfter: 150,
      deltaMonthlyParentFees: 50,
      deltaMonthly: 5.5,
    });
    expect(result.totals).toMatchObject({
      childrenWithMoreHours: 1,
      familiesWithMoreHours: 1,
      weeklyHoursAdded: 5.5,
      childrenWithHigherFees: 1,
      monthlyParentCostIncrease: 50,
      migratedBookings: 0.5,
    });
    expect(result.simulatedBookings[0].rawdata.ZEITKAT).toBe('07');
    expect(booking.rawdata.ZEITKAT).toBe('');
  });

  it('mutiert weder die geladenen Staffeln noch Buchungen', () => {
    const booking = makeBooking();
    const catalog = makeCatalog();
    const result = simulateContributionChanges({
      demandBookings: [booking],
      dataItems: CHILD,
      groupDefs: [],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: catalog,
      temporaryPrices: { g1: { '04': 150, '05': 150 } },
      utilizationPercent: 100,
      referenceDate: REF,
    });

    expect(catalog.g1[0].monthlyAmount).toBe(100);
    expect(booking.rawdata.ZEITKAT).toBe('04');
    expect(result.simulatedBookings[0].rawdata.ZEITKAT).toBe('05');
  });
});
