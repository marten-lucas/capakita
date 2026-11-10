import { describe, expect, it } from 'vitest';
import {
  calculateFamilyFeePotentials,
  simulateAnnualContributionChanges,
  simulateContributionChanges,
} from './foerderSimulation';

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
      grossParentFeeBefore: 100,
      grossParentFeeAfter: 150,
      parentFeeBefore: 0,
      parentFeeAfter: 50,
      parentFeeSubsidyBefore: 100,
      parentFeeSubsidyAfter: 100,
      deltaMonthlyParentFees: 50,
      deltaMonthlyParentSubsidy: 0,
      deltaWeeklyHours: 1,
    });
  });

  it('berechnet Upgrade- und Downgrade-Stunden innerhalb des monatlichen Familienbudgets', () => {
    const result = calculateFamilyFeePotentials({
      demandBookings: [
        makeBooking({ itemId: 'child-1', zone: '05', dailyHours: 5 }),
        makeBooking({ itemId: 'child-2', zone: '05', dailyHours: 5 }),
      ],
      dataItems: {
        'child-1': { ...CHILD['child-1'], familyId: 'fam-1' },
        'child-2': { id: 'child-2', name: 'Kind B', dateofbirth: '2022-01-01', familyId: 'fam-1', familyLabel: 'Familie A', groupId: 'g1' },
      },
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: {
        g1: [
          { id: 'zone-04', zeitkatId: '04', monthlyAmount: 80, validFrom: '2026-01-01' },
          { id: 'zone-05', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' },
          { id: 'zone-06', zeitkatId: '06', monthlyAmount: 150, validFrom: '2026-01-01' },
        ],
      },
      parentFeeSubsidy: { enabled: false },
      referenceDate: REF,
      monthlyBudget: 50,
    });

    expect(result).toEqual([{
      id: 'fam-1',
      label: 'Familie A',
      childIds: ['child-1', 'child-2'],
      potentialUpgradeWeeklyHours: 1,
      potentialDowngradeWeeklyHours: 2,
      potentialUpgradeWeightedDailyHours: 0.2,
      potentialDowngradeWeightedDailyHours: 0.4,
      potentialUpgradeMonthlyParentFeeChange: 50,
      potentialDowngradeMonthlyParentFeeChange: -40,
    }]);
  });

  it('berechnet das Upgrade-Potenzial mit einem festen Monatszuschuss je Kind', () => {
    const result = calculateFamilyFeePotentials({
      demandBookings: [makeBooking({ zone: '05', dailyHours: 5 })],
      dataItems: CHILD,
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: {
        g1: [
          { id: 'zone-05', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' },
          { id: 'zone-06', zeitkatId: '06', monthlyAmount: 150, validFrom: '2026-01-01' },
        ],
      },
      parentFeeSubsidy: { enabled: true, monthlyAmount: 150 },
      referenceDate: REF,
      monthlyBudget: 0,
    });

    expect(result[0]).toMatchObject({
      potentialUpgradeWeeklyHours: 1,
      potentialUpgradeWeightedDailyHours: 0.2,
      potentialUpgradeMonthlyParentFeeChange: 0,
    });
  });

  it('zählt den festen Monatszuschuss für jedes berechtigte Kind, auch ohne passenden Tarif oder bei niedrigerem Beitrag', () => {
    const result = simulateContributionChanges({
      demandBookings: [
        makeBooking({ itemId: 'child-1', zone: '05' }),
        makeBooking({ itemId: 'child-2', zone: '06' }),
      ],
      dataItems: {
        'child-1': CHILD['child-1'],
        'child-2': { ...CHILD['child-1'], id: 'child-2', groupId: 'g1' },
      },
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: {
        g1: [{ id: 'zone-05', zeitkatId: '05', monthlyAmount: 50, validFrom: '2026-01-01' }],
      },
      parentFeeSubsidy: { enabled: true, monthlyAmount: 100 },
      referenceDate: REF,
    });

    expect(result.totals.policyParentFeeSubsidy).toBe(200);
    expect(result.totals.eligibleParentFeeSubsidyChildren).toBe(2);
  });

  it('summiert den Zuschuss für alle berechtigten Kinder über alle Monate des Jahres', () => {
    const result = simulateAnnualContributionChanges({
      year: 2026,
      demandBookings: [
        makeBooking({ itemId: 'child-1' }),
        makeBooking({ itemId: 'child-2' }),
      ],
      dataItems: {
        'child-1': CHILD['child-1'],
        'child-2': { ...CHILD['child-1'], id: 'child-2', groupId: 'g1' },
      },
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: { g1: [] },
      parentFeeSubsidy: { enabled: true, monthlyAmount: 100 },
      parentFeeSubsidiesByGroup: { g1: { enabled: false, monthlyAmount: 100 } },
      baselineParentFeeSubsidy: { enabled: true, monthlyAmount: 100 },
      baselineParentFeeSubsidiesByGroup: { g1: { enabled: true, monthlyAmount: 100 } },
    });

    expect(result.totals.deltaYearlyParentSubsidy).toBe(-2400);
    expect(result.totals.eligibleParentFeeSubsidyChildMonths).toBe(24);
  });

  it('verschiebt beim temporären Deaktivieren des Zuschusses den Betrag von Förderungen zu Elternbeiträgen', () => {
    const result = simulateContributionChanges({
      demandBookings: [makeBooking()],
      dataItems: CHILD,
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: makeCatalog(),
      parentFeeSubsidy: { enabled: true, monthlyAmount: 100 },
      parentFeeSubsidiesByGroup: { g1: { enabled: false, monthlyAmount: 100 } },
      baselineParentFeeSubsidy: { enabled: true, monthlyAmount: 100 },
      baselineParentFeeSubsidiesByGroup: { g1: { enabled: true, monthlyAmount: 100 } },
      referenceDate: REF,
    });

    expect(result.totals).toMatchObject({
      deltaParentFees: 100,
      deltaParentFeeSubsidy: -100,
      policyParentFeeSubsidy: 0,
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

  it('ignoriert lokale Zuschuss-Overrides und verwendet den festgelegten Betrag', () => {
    const result = simulateContributionChanges({
      demandBookings: [makeBooking()],
      dataItems: CHILD,
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: {
        g1: [
          { id: 'fee-04', zeitkatId: '04', monthlyAmount: 80, validFrom: '2026-01-01' },
          { id: 'fee-05', zeitkatId: '05', monthlyAmount: 120, validFrom: '2026-01-01' },
        ],
      },
      parentFeeSubsidy: { monthlyAmount: 100, minimumAgeYears: 3, maximumAgeYears: 7 },
      temporaryParentFeeSubsidyAmount: 50,
      utilizationPercent: 0,
      referenceDate: REF,
    });

    expect(result.perChild).toHaveLength(0);
    expect(result.totals).toMatchObject({
      deltaParentFees: 0,
      deltaParentFeeSubsidy: 0,
      deltaMonthlyTotal: 0,
      childrenWithHigherFees: 0,
      monthlyParentCostIncrease: 0,
    });
  });

  it('schließt Schulkind-markierte Kinder vom Zuschuss aus', () => {
    const schoolChildBooking = {
      ...makeBooking(),
      rawdata: { ...makeBooking().rawdata, SCHULKIND: '.T.' },
    };
    const result = simulateContributionChanges({
      demandBookings: [schoolChildBooking, makeBooking({ itemId: 'child-2' })],
      dataItems: {
        ...CHILD,
        'child-2': { ...CHILD['child-1'], id: 'child-2', groupId: 'g1' },
      },
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: { g1: [{ id: 'fee-04', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' }] },
      parentFeeSubsidy: { monthlyAmount: 100 },
      referenceDate: REF,
    });

    expect(result.totals.policyParentFeeSubsidy).toBe(100);
    expect(result.totals.eligibleParentFeeSubsidyChildren).toBe(1);
  });

  it('gewährt den Zuschuss im Jahr des dritten Geburtstags erst ab September', () => {
    const child = { ...CHILD['child-1'], dateofbirth: '2023-04-15' };
    const common = {
      demandBookings: [makeBooking()],
      dataItems: { 'child-1': child },
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      groupFeeCatalogs: { g1: [] },
      parentFeeSubsidy: { monthlyAmount: 100 },
    };

    expect(simulateContributionChanges({ ...common, referenceDate: '2026-08-01' }).totals.policyParentFeeSubsidy).toBe(0);
    expect(simulateContributionChanges({ ...common, referenceDate: '2026-09-01' }).totals.policyParentFeeSubsidy).toBe(100);
  });

  it('zählt aktive berechtigte Kinder auch ohne auswertbare Buchungsstunden', () => {
    const result = simulateContributionChanges({
      demandBookings: [],
      dataItems: CHILD,
      parentFeeSubsidyChildren: [{
        itemId: 'child-1',
        item: CHILD['child-1'],
        groupId: 'g1',
        bookings: [makeBooking()],
      }],
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      groupFeeCatalogs: { g1: [] },
      parentFeeSubsidy: { monthlyAmount: 100 },
      referenceDate: REF,
    });

    expect(result.totals.policyParentFeeSubsidy).toBe(100);
    expect(result.totals.eligibleParentFeeSubsidyChildren).toBe(1);
  });

  it('gewährt ohne Geburtsdatum keinen altersabhängigen Zuschuss', () => {
    const result = simulateContributionChanges({
      demandBookings: [makeBooking()],
      dataItems: { 'child-1': { id: 'child-1', type: 'demand', groupId: 'g1' } },
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      groupFeeCatalogs: { g1: [] },
      parentFeeSubsidy: { monthlyAmount: 100 },
      referenceDate: REF,
    });

    expect(result.totals.policyParentFeeSubsidy).toBe(0);
  });

  it('uses the parent-fee subsidy configured for each fee catalog', () => {
    const result = simulateContributionChanges({
      demandBookings: [makeBooking({ itemId: 'child-1', groupId: 'g1' }), makeBooking({ itemId: 'child-2', groupId: 'g2' })],
      dataItems: {
        'child-1': { ...CHILD['child-1'], groupId: 'g1' },
        'child-2': { ...CHILD['child-1'], id: 'child-2', groupId: 'g2' },
      },
      groupDefs: [{ id: 'g1', name: 'Kindergarten' }, { id: 'g2', name: 'Krippe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: {
        g1: [{ id: 'fee-1', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' }],
        g2: [{ id: 'fee-2', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' }],
      },
      parentFeeSubsidiesByGroup: {
        g1: { enabled: true, monthlyAmount: 100, endDate: '2026-12-31' },
        g2: { enabled: true, monthlyAmount: 40, endDate: '2026-12-31' },
      },
      referenceDate: REF,
    });

    expect(result.totals.policyParentFeeSubsidy).toBe(140);
  });

  it('bildet den Wegfall des Elternbeitragszuschusses ab 2027 als Elternmehrbelastung ab, nicht als Mehreinnahme', () => {
    const result = simulateContributionChanges({
      demandBookings: [makeBooking()],
      dataItems: CHILD,
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: { g1: [{ id: 'fee-04', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' }] },
      parentFeeSubsidy: { monthlyAmount: 100, endDate: '2026-12-31' },
      referenceDate: '2027-01-01',
    });

    expect(result.perChild[0]).toMatchObject({
      parentFeeSubsidyBefore: 100,
      parentFeeSubsidyAfter: 0,
      parentFeeBefore: 50,
      parentFeeAfter: 150,
      deltaMonthlyParentFees: 100,
      deltaMonthlyParentSubsidy: -100,
      deltaMonthlyTotal: 0,
    });
  });

  it('summiert Jahresbeiträge monatsgenau und beachtet das Zuschuss-Enddatum', () => {
    const result = simulateAnnualContributionChanges({
      year: 2027,
      demandBookings: [makeBooking()],
      dataItems: CHILD,
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: { g1: [{ id: 'fee-04', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' }] },
      parentFeeSubsidy: { monthlyAmount: 100, endDate: '2027-06-30' },
    });

    expect(result.months).toHaveLength(12);
    expect(result.totals).toMatchObject({
      deltaYearlyParentFees: 600,
      deltaYearlyParentSubsidy: -600,
      deltaYearlyTotal: 0,
      deltaMonthlyParentFees: 50,
      deltaMonthlyParentSubsidy: -50,
    });
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

  it('leitet eine fehlende ZEITKAT aus Buchungszeiten ab und simuliert den Wechsel zur nächsten Kategorie', () => {
    const booking = makeBooking({ zone: '', dailyHours: 3, days: 3 });
    const result = simulateContributionChanges({
      demandBookings: [booking],
      dataItems: CHILD,
      groupDefs: [{ id: 'g1', name: 'Sonnengruppe' }],
      bayKiBiGRules: RULES,
      groupFeeCatalogs: {
        g1: [
          { id: 'zeitkat-02', zeitkatId: '02', monthlyAmount: 100, validFrom: '2026-01-01' },
          { id: 'zeitkat-04', zeitkatId: '04', monthlyAmount: 200, validFrom: '2026-01-01' },
        ],
      },
      temporaryPrices: { g1: { '02': 150, '04': 150 } },
      utilizationPercent: 50,
      referenceDate: REF,
    });

    expect(result.perChild[0]).toMatchObject({
      fromZone: '02',
      toZone: '04',
      weeklyHoursBefore: 9,
      weeklyHoursAfter: 10.5,
      deltaWeeklyHours: 1.5,
      parentFeeBefore: 0,
      parentFeeAfter: 50,
      parentFeeSubsidyBefore: 100,
      parentFeeSubsidyAfter: 100,
      deltaMonthlyParentFees: 50,
      deltaMonthlyParentSubsidy: 0,
    });
    expect(result.totals).toMatchObject({
      childrenWithMoreHours: 1,
      familiesWithMoreHours: 1,
      weeklyHoursAdded: 1.5,
      childrenWithHigherFees: 1,
      monthlyParentCostIncrease: 50,
      migratedBookings: 0.5,
    });
    expect(result.simulatedBookings[0].rawdata.ZEITKAT).toBe('04');
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
