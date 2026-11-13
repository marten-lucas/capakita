import { describe, expect, it } from 'vitest';
import {
  calculateFamilyFeePotentials,
  getFeeBandSimulationPriceKey,
  getFeeBandSimulationPriceOverride,
  simulateAnnualContributionChanges,
  simulateContributionChanges,
} from './foerderSimulation';

const REF = '2026-03-15';
const RULES = [{
  id: 'rule-1',
  baseValue: 132,
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
  it('isoliert Preisänderungen nach Tarifversion und liest alte Schlüssel weiterhin', () => {
    const fee2026 = { id: 'fee-2026', zeitkatId: '04', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-12-31' };
    const fee2027 = { id: 'fee-2027', zeitkatId: '04', monthlyAmount: 200, validFrom: '2027-01-01' };
    const key = getFeeBandSimulationPriceKey(fee2026);
    expect(key).not.toBe(getFeeBandSimulationPriceKey(fee2027));
    expect(getFeeBandSimulationPriceKey({ ...fee2026, monthlyAmount: 150, validUntil: '' })).toBe(key);
    expect(getFeeBandSimulationPriceKey({ ...fee2026, id: undefined })).not.toBe(getFeeBandSimulationPriceKey({ ...fee2027, id: undefined }));
    expect(getFeeBandSimulationPriceOverride(fee2026, { '04': 120, [key]: 0 })).toBe(0);
    expect(getFeeBandSimulationPriceOverride(fee2027, { '04': 120, [key]: 150 })).toBe(120);

    const run = (referenceDate, temporaryPrices) => simulateContributionChanges({
      demandBookings: [makeBooking()], dataItems: CHILD, bayKiBiGRules: RULES,
      groupFeeCatalogs: { g1: [fee2026, fee2027] }, temporaryPrices,
      parentFeeSubsidy: { enabled: false }, utilizationPercent: 0, referenceDate,
    });
    expect(run('2026-03-15', { g1: { [key]: 150 } }).perChild[0]).toMatchObject({ grossParentFeeBefore: 100, grossParentFeeAfter: 150 });
    expect(run('2027-03-15', { g1: { [key]: 150 } }).totals).toMatchObject({ monthlyParentFeesBefore: 200, monthlyParentFeesAfter: 200 });
    expect(run('2027-03-15', { g1: { '04': 120 } }).perChild[0].grossParentFeeAfter).toBe(120);
  });

  it('berechnet absolute Simulationspreise und anteilige Wechsel bei gleichem Staffelpreis', () => {
    const result = runSimulation({
      utilizationPercent: 50,
      temporaryPrices: { g1: { '04': 150, '05': 150 } },
    });

    // Hälfte von 3 h/Tag wechselt in die 5 h-Obergrenze: +1 Wochenstunde.
    expect(result.totals.bookingHoursBefore).toBe(3);
    expect(result.totals.bookingHoursAfter).toBe(4);
    expect(result.totals.migratedBookings).toBe(0.5);
    // Δ-Förderung = 132 €/Jahr ÷ 12 × (1,25 - 1,0) × 50 %.
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

  it('rechnet den Jahresbasiswert beim anteiligen ZEITKAT-Wechsel genau einmal in Monate um', () => {
    const options = {
      demandBookings: [makeBooking()], dataItems: CHILD,
      bayKiBiGRules: [{ ...RULES[0], baseValue: 1200 }],
      groupFeeCatalogs: makeCatalog({ source: 100, next: 100 }),
      utilizationPercent: 50,
    };
    const monthly = simulateContributionChanges({ ...options, referenceDate: REF });
    // 1.200 €/Jahr × 0,25 × 50 % = 150 €/Jahr bzw. 12,50 €/Monat.
    expect(monthly.totals).toMatchObject({ deltaMonthlyBayKiBiG: 12.5, deltaYearlyBayKiBiG: 150, deltaMonthlyTotal: 12.5, deltaYearlyTotal: 150 });
    expect(monthly.groups[0]).toMatchObject({ deltaMonthlyFunding: 12.5, deltaYearlyFunding: 150 });
    expect(monthly.perChild[0]).toMatchObject({ deltaMonthly: 12.5, deltaYearly: 150 });
    const annual = simulateAnnualContributionChanges({ ...options, year: 2026 });
    expect(annual.totals).toMatchObject({ deltaYearlyBayKiBiG: 150, deltaMonthlyBayKiBiG: 12.5, deltaYearlyTotal: 150 });
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

  it('diagnostiziert Potenziale ohne Zeitsegmente trotz BETRSTD, ohne Buchungen zu verändern', () => {
    const first = { ...makeBooking({ zone: '05', days: 0 }), rawdata: { ZEITKAT: '05', ART: '0', BETRSTD: '25,5', GEWKAT: 'D' } };
    const second = { ...makeBooking({ zone: '05', days: 0 }), id: 'second', rawdata: { ZEITKAT: '05', ART: '0', betrstd: '10', GEWKAT: 'A' } };
    const original = structuredClone([first, second]);
    const result = calculateFamilyFeePotentials({
      demandBookings: [first, second], dataItems: CHILD, bayKiBiGRules: RULES,
      groupFeeCatalogs: { g1: [
        { zeitkatId: '04', monthlyAmount: 80 },
        { zeitkatId: '05', monthlyAmount: 100 },
        { zeitkatId: '06', monthlyAmount: 150 },
      ] },
      parentFeeSubsidy: { enabled: false }, referenceDate: REF, monthlyBudget: 100,
    });
    expect(result[0]).toMatchObject({
      potentialUpgradeWeeklyHours: 0, potentialDowngradeWeeklyHours: 0,
      diagnostics: { potentialCalculationComplete: false, incompleteBookings: [
        expect.objectContaining({ bookingId: first.id, direction: 'upgrade', reason: 'missing-booking-segments' }),
        expect.objectContaining({ bookingId: second.id, direction: 'upgrade', reason: 'missing-booking-segments' }),
        expect.objectContaining({ bookingId: first.id, direction: 'downgrade', reason: 'missing-booking-segments' }),
        expect.objectContaining({ bookingId: second.id, direction: 'downgrade', reason: 'missing-booking-segments' }),
      ] },
    });
    expect([first, second]).toEqual(original);
  });

  it('verwirft unvollständige Optionen bei gemischten Segment- und BETRSTD-Buchungen', () => {
    const segment = makeBooking({ zone: '05', dailyHours: 5 });
    segment.rawdata.GEWKAT = 'B';
    const aggregate = { ...makeBooking({ zone: '05', days: 0 }), id: 'aggregate', rawdata: { ZEITKAT: '05', BETRSTD: '25', GEWKAT: 'D' } };
    const [family] = calculateFamilyFeePotentials({
      demandBookings: [segment, aggregate], dataItems: CHILD, bayKiBiGRules: RULES,
      groupFeeCatalogs: { g1: [
        { zeitkatId: '04', monthlyAmount: 80 }, { zeitkatId: '05', monthlyAmount: 100 }, { zeitkatId: '06', monthlyAmount: 150 },
      ] }, parentFeeSubsidy: { enabled: false }, referenceDate: REF, monthlyBudget: 100,
    });
    expect(family).toMatchObject({ potentialUpgradeWeeklyHours: 0, potentialDowngradeWeeklyHours: 0,
      diagnostics: { incompleteBookings: [
        expect.objectContaining({ bookingId: 'aggregate', direction: 'upgrade', reason: 'missing-booking-segments' }),
        expect.objectContaining({ bookingId: 'aggregate', direction: 'downgrade', reason: 'missing-booking-segments' }),
      ] } });
  });

  it('diagnostiziert den nicht berechenbaren Wechsel und erhält BETRSTD unverändert', () => {
    const booking = { ...makeBooking({ days: 0 }), rawdata: { ZEITKAT: '04', ART: '0', betrstd: '25,5', GEWKAT: 'A' } };
    const result = runSimulation({ bookings: [booking], source: 100, next: 100, utilizationPercent: 50 });
    expect(result.totals).toMatchObject({ bookingHoursBefore: 25.5, bookingHoursAfter: 25.5, deltaWeeklyDemandHours: 0, migratedBookings: 0 });
    expect(result.simulatedBookings[0]).toEqual(booking);
    expect(result.diagnostics.incompleteMigrations).toEqual([expect.objectContaining({ bookingId: booking.id, reason: 'missing-booking-segments' })]);
    expect(booking.rawdata.betrstd).toBe('25,5');
  });

  it.each(['', '0', '-5', 'unbekannt'])('diagnostiziert unbrauchbare Wochenstunden %s statt Potenziale zu erfinden', (betrstd) => {
    const booking = { ...makeBooking({ zone: '05', days: 0 }), rawdata: { ZEITKAT: '05', ART: '0', BETRSTD: betrstd } };
    const [family] = calculateFamilyFeePotentials({
      demandBookings: [booking], dataItems: CHILD, groupFeeCatalogs: { g1: [
        { zeitkatId: '04', monthlyAmount: 80 }, { zeitkatId: '05', monthlyAmount: 100 }, { zeitkatId: '06', monthlyAmount: 150 },
      ] }, parentFeeSubsidy: { enabled: false }, referenceDate: REF, monthlyBudget: 100,
    });
    expect(family).toMatchObject({ potentialUpgradeWeeklyHours: 0, potentialDowngradeWeeklyHours: 0,
      diagnostics: { potentialCalculationComplete: false, incompleteBookings: [
        expect.objectContaining({ bookingId: booking.id, direction: 'upgrade', reason: 'no-booking-hours' }),
        expect.objectContaining({ bookingId: booking.id, direction: 'downgrade', reason: 'no-booking-hours' }),
      ] } });
  });

  it('meldet fehlende Daten einer Teilbuchung und verwendet keine unvollständige Familienoption', () => {
    const good = makeBooking({ zone: '05', dailyHours: 5 });
    const bad = { ...makeBooking({ zone: '05', days: 0 }), id: 'bad' };
    const [family] = calculateFamilyFeePotentials({
      demandBookings: [good, bad], dataItems: CHILD, groupFeeCatalogs: { g1: [
        { zeitkatId: '04', monthlyAmount: 80 }, { zeitkatId: '05', monthlyAmount: 100 }, { zeitkatId: '06', monthlyAmount: 150 },
      ] }, parentFeeSubsidy: { enabled: false }, referenceDate: REF, monthlyBudget: 100,
    });
    expect(family).toMatchObject({ potentialUpgradeWeeklyHours: 0, potentialDowngradeWeeklyHours: 0,
      diagnostics: { potentialCalculationComplete: false, incompleteBookings: [
        expect.objectContaining({ bookingId: 'bad', reason: 'no-booking-hours' }),
        expect.objectContaining({ bookingId: 'bad', reason: 'no-booking-hours' }),
      ] } });
  });

  it('diagnostiziert eine nicht ableitbare ZEITKAT einer weiteren Buchung', () => {
    const good = makeBooking({ zone: '05', dailyHours: 5 });
    const unknown = { ...makeBooking({ zone: '', days: 0 }), id: 'unknown', rawdata: { BETRSTD: '10' } };
    const [family] = calculateFamilyFeePotentials({
      demandBookings: [good, unknown], dataItems: CHILD, groupFeeCatalogs: { g1: [
        { zeitkatId: '04', monthlyAmount: 80 }, { zeitkatId: '05', monthlyAmount: 100 }, { zeitkatId: '06', monthlyAmount: 150 },
      ] }, parentFeeSubsidy: { enabled: false }, referenceDate: REF, monthlyBudget: 100,
    });
    expect(family).toMatchObject({ potentialUpgradeWeeklyHours: 0, potentialDowngradeWeeklyHours: 0,
      diagnostics: { potentialCalculationComplete: false, incompleteBookings: [
        expect.objectContaining({ bookingId: 'unknown', reason: 'missing-zeitkat' }),
        expect.objectContaining({ bookingId: 'unknown', reason: 'missing-zeitkat' }),
      ] } });
  });

  it('verwendet die künstliche Katalogobergrenze der offenen ZEITKAT 13 nicht für zeitlose Buchungen', () => {
    const catalog = { g1: [
      { zeitkatId: '11', monthlyAmount: 80 }, { zeitkatId: '12', monthlyAmount: 100 }, { zeitkatId: '13', monthlyAmount: 150 },
    ] };
    const options = { dataItems: CHILD, groupFeeCatalogs: catalog, parentFeeSubsidy: { enabled: false }, referenceDate: REF, monthlyBudget: 100 };
    const booking = { ...makeBooking({ zone: '12', days: 0 }), rawdata: { ZEITKAT: '12', BETRSTD: '45' } };
    const [family] = calculateFamilyFeePotentials({ ...options, demandBookings: [booking] });
    expect(family).toMatchObject({ potentialUpgradeWeeklyHours: 0, potentialDowngradeWeeklyHours: 0,
      diagnostics: { potentialCalculationComplete: false, incompleteBookings: [
        expect.objectContaining({ direction: 'upgrade', reason: 'missing-booking-segments' }),
        expect.objectContaining({ direction: 'downgrade', reason: 'missing-booking-segments' }),
      ] } });
    const open = { ...booking, rawdata: { ZEITKAT: '13', BETRSTD: '65' } };
    const [openFamily] = calculateFamilyFeePotentials({ ...options, demandBookings: [open] });
    expect(openFamily).toMatchObject({ potentialDowngradeWeeklyHours: 0,
      diagnostics: { incompleteBookings: [expect.objectContaining({ direction: 'downgrade', reason: 'missing-booking-segments' })] } });
    const simulation = simulateContributionChanges({ ...options, demandBookings: [booking], groupFeeCatalogs: { g1: [
      { zeitkatId: '12', monthlyAmount: 100 }, { zeitkatId: '13', monthlyAmount: 100 },
    ] } });
    expect(simulation.totals).toMatchObject({ migratedBookings: 0, bookingHoursBefore: 45, bookingHoursAfter: 45 });
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

    expect(result.totals.deltaYearlyParentSubsidy).toBe(0); // Teilwert: Tarife unbekannt
    expect(result.totals.eligibleParentFeeSubsidyChildMonths).toBe(24);
    expect(result.diagnostics.feeCalculationComplete).toBe(false);
    expect(result.diagnostics.missingTariffs).toHaveLength(24);
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

  it.each([
    [150, 100, 50, 100],
    [50, 100, 0, 50],
    [100, 100, 0, 100],
    [0, 100, 0, 0],
  ])('bildet Zuschusswegfall für Tarif %s und Zuschuss %s konsistent ab', (fee, subsidy, before, relief) => {
    const result = simulateContributionChanges({
      demandBookings: [makeBooking()], dataItems: CHILD,
      groupFeeCatalogs: makeCatalog({ source: fee }),
      parentFeeSubsidy: { monthlyAmount: subsidy, endDate: '2026-12-31' },
      referenceDate: '2027-01-01',
    });
    expect(result.diagnostics).toMatchObject({ feeCalculationComplete: true, missingTariffs: [] });
    expect(result.diagnostics.subsidyExceedsTariff).toHaveLength(fee < subsidy ? 1 : 0);
    expect(result.familyContributions[0]).toMatchObject({
      monthlyParentFeesBefore: before, monthlyParentFeesAfter: fee, deltaMonthlyParentFees: relief,
    });
    expect(result.totals).toMatchObject({
      deltaParentFees: relief, deltaParentFeeSubsidy: -relief || 0, deltaMonthlyTotal: 0,
    });
    expect(result.groups[0]).toMatchObject({
      deltaMonthlyParentFees: relief, deltaMonthlyParentSubsidy: -relief || 0, deltaMonthlyTotal: 0,
    });
    if (relief) {
      expect(result.perChild[0]).toMatchObject({
        grossParentFeeBefore: fee, parentFeeBefore: before, parentFeeAfter: fee,
        parentFeeSubsidyBefore: relief, parentFeeSubsidyAfter: 0,
        deltaMonthlyParentFees: relief, deltaMonthlyParentSubsidy: -relief, deltaMonthlyTotal: 0,
      });
      expect(result.families[0].deltaMonthlyTotal).toBe(0);
    }
  });

  it('summiert beim Zuschusswegfall unter Tarifgrenze die tatsächlich berechenbare Entlastung monatsweise', () => {
    const result = simulateAnnualContributionChanges({
      year: 2027, demandBookings: [makeBooking()], dataItems: CHILD,
      groupFeeCatalogs: makeCatalog({ source: 50 }),
      parentFeeSubsidy: { monthlyAmount: 100, endDate: '2027-06-30' },
    });
    expect(result.diagnostics.feeCalculationComplete).toBe(true);
    expect(result.diagnostics.subsidyExceedsTariff).toHaveLength(12);
    expect(result.totals).toMatchObject({
      deltaYearlyParentFees: 300, deltaYearlyParentSubsidy: -300,
      deltaYearlyTotal: 0, annualParentFeeSubsidy: 600,
      annualBaselineNominalParentFeeSubsidy: 1200, deltaYearlyNominalParentFeeSubsidy: -600,
    });
  });

  it('weist Elternanteile unveränderter Tarife kindweise begrenzt in Monats- und Jahressummen aus', () => {
    const options = {
      demandBookings: [makeBooking(), makeBooking({ itemId: 'child-2', zone: '05' })],
      dataItems: { ...CHILD, 'child-2': { ...CHILD['child-1'], id: 'child-2', familyId: 'fam-2' } },
      groupFeeCatalogs: makeCatalog({ source: 50, next: 150 }),
      parentFeeSubsidy: { enabled: true, monthlyAmount: 100 }, utilizationPercent: 0,
    };
    const monthly = simulateContributionChanges({ ...options, referenceDate: REF });
    expect(monthly.perChild).toHaveLength(0);
    expect(monthly.familyContributions.map((family) => family.monthlyParentFeesAfter)).toEqual([0, 50]);
    expect(monthly.totals).toMatchObject({
      grossParentFees: 200, policyParentFeeSubsidy: 200,
      monthlyParentFeesBefore: 50, monthlyParentFeesAfter: 50, deltaParentFees: 0,
    });
    const annual = simulateAnnualContributionChanges({ ...options, year: 2026 });
    expect(annual.totals).toMatchObject({
      annualGrossParentFees: 2400, annualParentFeeSubsidy: 2400,
      annualParentFeesBefore: 600, annualParentFeesAfter: 600, deltaYearlyParentFees: 0,
    });
    expect(annual.diagnostics.feeCalculationComplete).toBe(true);
  });

  it('rechnet Tarifänderungen unter und über der Zuschusshöhe als Beitragsentlastung', () => {
    const result = runSimulation({ source: 50, temporaryPrices: { g1: { '04': 150 } } });
    expect(result.perChild[0]).toMatchObject({
      grossParentFeeBefore: 50, grossParentFeeAfter: 150,
      parentFeeBefore: 0, parentFeeAfter: 50,
      parentFeeSubsidyBefore: 50, parentFeeSubsidyAfter: 100,
      deltaMonthlyParentFees: 50, deltaMonthlyParentSubsidy: 50, deltaMonthlyTotal: 100,
    });
    expect(result.totals).toMatchObject({
      deltaParentFees: 50, deltaParentFeeSubsidy: 50, deltaMonthlyTotal: 100,
      policyParentFeeSubsidy: 100, baselineNominalParentFeeSubsidy: 100, deltaNominalParentFeeSubsidy: 0,
    });
    expect(result.groups[0].deltaMonthlyTotal).toBe(100);
    expect(result.families[0].deltaMonthlyTotal).toBe(100);
    expect(result.diagnostics.subsidyExceedsTariff[0]).toMatchObject({ grossParentFeeBefore: 50, nominalSubsidyBefore: 100 });
  });

  it('meldet fehlende Ausgangs- und Vergleichstarife und unterscheidet sie von Nulltarifen', () => {
    const common = { demandBookings: [makeBooking()], dataItems: CHILD, referenceDate: REF };
    const noBaseline = simulateContributionChanges({ ...common, groupFeeCatalogs: makeCatalog(), originalGroupFeeCatalogs: { g1: [] } });
    expect(noBaseline.diagnostics.missingTariffs).toEqual([{ itemId: 'child-1', groupId: 'g1', zeitkatId: '04', missingBaseline: true, missingCurrent: false, reason: 'missing-tariff' }]);
    expect(noBaseline.totals.deltaParentFees).toBe(0);
    const noCurrent = simulateContributionChanges({ ...common, groupFeeCatalogs: { g1: [] }, originalGroupFeeCatalogs: makeCatalog() });
    expect(noCurrent.diagnostics.missingTariffs[0]).toMatchObject({ missingBaseline: false, missingCurrent: true });
    const disabled = simulateContributionChanges({ ...common, groupFeeCatalogs: { g1: [{ ...makeCatalog().g1[0], enabled: false }] }, originalGroupFeeCatalogs: makeCatalog() });
    expect(disabled.diagnostics.feeCalculationComplete).toBe(false);
    expect(disabled.diagnostics.missingTariffs[0]).toMatchObject({ missingBaseline: false, missingCurrent: true });
    expect(disabled.totals).toMatchObject({ deltaParentFees: 0, deltaParentFeeSubsidy: 0, deltaMonthlyTotal: 0 });
    const zero = simulateContributionChanges({ ...common, groupFeeCatalogs: makeCatalog({ source: 0 }) });
    expect(zero.diagnostics.feeCalculationComplete).toBe(true);
    expect(zero.familyContributions[0].monthlyParentFeesBefore).toBe(0);
  });

  it('bewahrt Familienidentitäten unabhängig von gleichen Namen und erlaubt explizite Zuordnungen', () => {
    const children = {
      'child-1': { ...CHILD['child-1'], familyId: 'fam-1', familyLabel: 'Familie Gleich' },
      'child-2': { ...CHILD['child-1'], id: 'child-2', familyId: 'fam-2', familyLabel: 'Familie Gleich' },
      'child-3': { ...CHILD['child-1'], id: 'child-3', familyId: '', familyLabel: 'Familie Gleich' },
      'child-4': { ...CHILD['child-1'], id: 'child-4', familyId: 'fam-1', familyLabel: 'Familie Gleich' },
    };
    const common = {
      demandBookings: Object.keys(children).map((itemId) => makeBooking({ itemId })),
      dataItems: children, groupFeeCatalogs: makeCatalog(), temporaryPrices: { g1: { '04': 150 } }, referenceDate: REF,
    };
    const result = simulateContributionChanges(common);
    expect(result.totals.affectedFamilies).toBe(3);
    expect(result.familyContributions.find((row) => row.id === 'fam-1').childIds).toEqual(['child-1', 'child-4']);
    expect(result.families.map((row) => row.id).sort()).toEqual(['child:child-3', 'fam-1', 'fam-2']);
    expect(calculateFamilyFeePotentials(common).map((row) => row.id).sort()).toEqual(['child:child-3', 'fam-1', 'fam-2']);
    const mapped = { ...common, familyGroupIds: { 'child-1': 'explicit', 'child-2': 'explicit' } };
    expect(simulateContributionChanges(mapped).familyContributions.find((row) => row.id === 'explicit').childIds).toEqual(['child-1', 'child-2']);
    expect(calculateFamilyFeePotentials(mapped).find((row) => row.id === 'explicit').childIds).toEqual(['child-1', 'child-2']);
  });

  it('behandelt deaktivierte Ausgangs- und aktuelle Tarife als fehlend, aktive Nulltarife aber als echt', () => {
    const booking = makeBooking();
    const entry = { ...makeCatalog({ source: 150 }).g1[0] };
    const disabledCatalog = { g1: [{ ...entry, enabled: false }] };
    const enabledCatalog = { g1: [entry] };
    const common = { demandBookings: [booking], dataItems: CHILD, parentFeeSubsidy: { enabled: false }, referenceDate: REF };
    const disabled = simulateContributionChanges({ ...common, originalGroupFeeCatalogs: enabledCatalog, groupFeeCatalogs: disabledCatalog });
    expect(disabled.diagnostics.missingTariffs[0]).toMatchObject({ missingBaseline: false, missingCurrent: true });
    expect(disabled.totals).toMatchObject({ deltaParentFees: 0, monthlyParentFeesBefore: 0, monthlyParentFeesAfter: 0 });
    const disabledBaseline = simulateContributionChanges({ ...common, originalGroupFeeCatalogs: disabledCatalog, groupFeeCatalogs: enabledCatalog });
    expect(disabledBaseline.diagnostics.missingTariffs[0]).toMatchObject({ missingBaseline: true, missingCurrent: false });
    const activeZero = simulateContributionChanges({ ...common, originalGroupFeeCatalogs: enabledCatalog, groupFeeCatalogs: { g1: [{ ...entry, monthlyAmount: 0 }] } });
    expect(activeZero.diagnostics.feeCalculationComplete).toBe(true);
    expect(activeZero.totals).toMatchObject({ monthlyParentFeesBefore: 150, monthlyParentFeesAfter: 0, deltaParentFees: -150 });
    const yearly = simulateAnnualContributionChanges({ ...common, year: 2026, originalGroupFeeCatalogs: enabledCatalog, groupFeeCatalogs: disabledCatalog });
    expect(yearly.diagnostics.missingTariffs).toHaveLength(12);
    expect(yearly.totals).toMatchObject({ deltaYearlyParentFees: 0, annualParentFeesBefore: 0, annualParentFeesAfter: 0 });
    const alternative = simulateContributionChanges({ ...common, originalGroupFeeCatalogs: enabledCatalog, groupFeeCatalogs: { g1: [{ ...entry, enabled: false }, { ...entry, id: 'other', monthlyAmount: 75 }] } });
    expect(alternative.diagnostics.feeCalculationComplete).toBe(true);
    expect(alternative.totals.deltaParentFees).toBe(-75);
    const potential = calculateFamilyFeePotentials({ ...common, groupFeeCatalogs: disabledCatalog });
    expect(potential[0].diagnostics.missingTariffs[0]).toMatchObject({ itemId: 'child-1', zeitkatId: '04' });
  });

  it('diagnostiziert zeitlose Schulkindbuchungen unabhängig von der Zuschussberechtigung', () => {
    const child = { ...CHILD['child-1'], id: 'school' };
    const booking = { ...makeBooking({ itemId: 'school', days: 0 }), rawdata: { ZEITKAT: '04', ART: '0', SCHULKIND: '.T.' } };
    const record = { itemId: 'school', item: child, groupId: 'g1', bookings: [booking], isSchoolChild: true };
    const options = { dataItems: { school: child }, groupFeeCatalogs: makeCatalog({ source: 150 }), referenceDate: REF, parentFeeSubsidyChildren: [record] };
    const filtered = simulateContributionChanges({ ...options, demandBookings: [] });
    expect(filtered.totals.eligibleParentFeeSubsidyChildren).toBe(0);
    expect(filtered.diagnostics.activeChildrenCoverage).toBe('partial');
    expect(filtered.diagnostics.childrenWithoutBookingHours).toEqual([{ itemId: 'school', groupId: 'g1', reason: 'no-booking-hours' }]);
    expect(filtered.diagnostics.missingTariffs).toEqual([{ itemId: 'school', groupId: 'g1', zeitkatId: null, missingBaseline: true, missingCurrent: true, reason: 'missing-demand-booking' }]);
    expect(filtered.diagnostics.feeCalculationComplete).toBe(false);
    const independent = simulateContributionChanges({ ...options, demandBookings: [], parentFeeSubsidyChildren: [], activeChildren: [record] });
    expect(independent.diagnostics).toMatchObject({
      activeChildrenCoverage: 'caller-provided', feeCalculationComplete: false,
      childrenWithoutBookingHours: [{ itemId: 'school', groupId: 'g1', reason: 'no-booking-hours' }],
      missingTariffs: [{ itemId: 'school', reason: 'missing-demand-booking' }],
    });
    expect(independent.totals.eligibleParentFeeSubsidyChildren).toBe(0);
    const present = simulateContributionChanges({ ...options, demandBookings: [booking], activeChildren: [record] });
    expect(present.diagnostics).toMatchObject({ feeCalculationComplete: true, activeChildrenCoverage: 'caller-provided', missingTariffs: [] });
    expect(present.diagnostics.childrenWithoutBookingHours).toHaveLength(1);
    expect(present.totals.monthlyParentFeesAfter).toBe(150);
    const noMigration = simulateContributionChanges({ ...options, groupFeeCatalogs: makeCatalog({ source: 150, next: 150 }), bayKiBiGRules: RULES, demandBookings: [booking] });
    expect(noMigration.totals).toMatchObject({ migratedBookings: 0, deltaMonthlyBayKiBiG: 0 });
    expect(noMigration.simulatedBookings[0].rawdata.ZEITKAT).toBe('04');
    const withBetrstd = { ...booking, rawdata: { ...booking.rawdata, BETRSTD: '25' } };
    const measured = simulateContributionChanges({ ...options, demandBookings: [withBetrstd], activeChildren: [{ ...record, bookings: [withBetrstd] }] });
    expect(measured.diagnostics.childrenWithoutBookingHours).toEqual([]);
  });

  it('meldet aktive Kinder ohne Basisbuchung auch ohne Zuschuss und überspringt inaktive Datensätze', () => {
    const school = { ...CHILD['child-1'], id: 'school', dateofbirth: '2015-01-01' };
    const future = { ...CHILD['child-1'], id: 'future', startdate: '2027-01-01' };
    const records = [
      { itemId: 'school', item: school, groupId: 'g1', bookings: [] },
      { itemId: 'future', item: future, groupId: 'g1', bookings: [] },
      { itemId: 'school', item: school, groupId: 'g1', bookings: [] },
    ];
    const options = { activeChildren: records, demandBookings: [], dataItems: { school, future }, parentFeeSubsidyChildren: [], referenceDate: REF };
    const result = simulateContributionChanges(options);
    expect(result.diagnostics.activeChildrenCoverage).toBe('caller-provided');
    expect(result.diagnostics.childrenWithoutBookingHours).toEqual([{ itemId: 'school', groupId: 'g1', reason: 'missing-basis-booking' }]);
    expect(result.diagnostics.missingTariffs).toEqual([{ itemId: 'school', groupId: 'g1', zeitkatId: null, missingBaseline: true, missingCurrent: true, reason: 'missing-booking' }]);
    expect(result.totals.eligibleParentFeeSubsidyChildren).toBe(0);
    const annual = simulateAnnualContributionChanges({ ...options, year: 2026 });
    expect(annual.diagnostics.childrenWithoutBookingHours).toHaveLength(12);
    expect(annual.diagnostics.missingTariffs).toHaveLength(12);
    expect(annual.diagnostics.missingTariffs[0].referenceDate).toBe('2026-01-01');
  });

  it('kennzeichnet fehlende Tarife für indikative Familienpotenziale', () => {
    const families = calculateFamilyFeePotentials({ demandBookings: [makeBooking()], dataItems: CHILD, groupFeeCatalogs: { g1: [] }, referenceDate: REF });
    expect(families[0].diagnostics.missingTariffs).toEqual([{ itemId: 'child-1', groupId: 'g1', zeitkatId: '04', reason: 'missing-tariff' }]);
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
