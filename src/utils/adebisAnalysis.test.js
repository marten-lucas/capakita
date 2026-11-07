import { describe, expect, it } from 'vitest';
import { calculateAdebisMonthMetrics } from './adebisAnalysis';

describe('calculateAdebisMonthMetrics', () => {
  it('uses weighted daily booking hours and the Basiswert for ADEBIS funding', () => {
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: {
        childRows: [{
          itemId: 'child-1',
          weeklyHours: 25,
          bayKiBiGWeight: 1.2,
          bayKiBiGRule: { baseValue: 1563.88 },
        }],
      },
      simulationData: { dataItems: {}, bookingsByItem: {}, qualificationAssignmentsByItem: {} },
      referenceDate: '2026-01-01',
    });

    expect(metrics.children).toBe(1);
    expect(metrics.overTwentyHoursPercent).toBe(100);
    expect(metrics.bookingHoursDaily).toBe(5);
    expect(metrics.weightedBookingHoursDaily).toBe(6);
    expect(metrics.minimumExpertHours).toBeCloseTo(6 / 4.4, 8);
    expect(metrics.estimatedFunding).toBeCloseTo(6 * 1563.88 / 24, 8);
  });

  it('uses exported BETRSTD and excludes alternative bookings from ADEBIS hour totals', () => {
    const booking = {
      itemId: 'child-1',
      startdate: '2026-01-01',
      enddate: '',
      buchungsart: { basis: true },
      rawdata: { ART: '0', BETRSTD: '25,5', GEWKAT: 'A' },
      times: [{ segments: [{ booking_start: '07:00', booking_end: '15:00' }] }],
    };
    const alternativeBooking = {
      ...booking,
      id: 'alternative',
      buchungsart: { basis: false },
      rawdata: { ART: 'A', BETRSTD: '80', GEWKAT: 'A' },
    };
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: {
        childRows: [{
          itemId: 'child-1',
          weeklyHours: 40,
          bayKiBiGWeight: 1,
          bayKiBiGRule: { baseValue: 1563.88 },
          groupId: 'g1',
          item: { type: 'demand', dateofbirth: '2022-01-01' },
        }],
      },
      simulationData: {
        dataItems: { 'child-1': { type: 'demand', dateofbirth: '2022-01-01' } },
        bookingsByItem: { 'child-1': { basis: booking, alternative: alternativeBooking } },
        qualificationAssignmentsByItem: {},
      },
      groupDefs: [{ id: 'g1', type: 'Regelgruppe' }],
      referenceDate: '2026-01-01',
    });

    expect(metrics.children).toBe(1);
    expect(metrics.weeklyBookingHours).toBe(25.5);
    expect(metrics.bookingHoursDaily).toBe(5.1);
    expect(metrics.weightedBookingHoursDaily).toBeCloseTo(6.63, 8);
  });

  it('reproduces the January funding shown in the ADEBIS screenshot', () => {
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: {
        childRows: [{
          itemId: 'weighted-bookings',
          weeklyHours: 1495,
          bayKiBiGWeight: 1,
          bayKiBiGRule: { baseValue: 1563.88 },
        }],
      },
      simulationData: { dataItems: {}, bookingsByItem: {}, qualificationAssignmentsByItem: {} },
      qualityBonusBenchmark: 268.01,
      referenceDate: '2026-01-01',
    });

    expect(metrics.weightedBookingHoursDaily).toBe(299);
    expect(metrics.estimatedFunding).toBeCloseTo(19483.34, 2);
    expect(metrics.qualityBonus).toBeCloseTo(1669.48, 2);
  });

  it('applies ADEBIS start-month and statistic-hide flags to staff hours', () => {
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: { childRows: [] },
      simulationData: {
        dataItems: {
          'staff-started-midmonth': {
            type: 'capacity',
            startdate: '2026-01-15',
            enddate: '',
            rawdata: { ARBZEIT: '30', QUALIFIK: 'E', BEGINNMODE: 'E' },
          },
          'staff-hidden': {
            type: 'capacity',
            startdate: '2025-01-01',
            enddate: '',
            rawdata: { ARBZEIT: '20', QUALIFIK: 'E', STATHIDE: '.T.' },
          },
        },
        bookingsByItem: {},
        qualificationAssignmentsByItem: {},
      },
      referenceDate: '2026-01-01',
    });

    expect(metrics.staffHours).toBe(30);
    expect(metrics.expertStaffHours).toBe(30);
  });

  it('calculates the U3 supplement from under-three child-months and the funding-table factor', () => {
    const childRows = Array.from({ length: 10 }, (_, index) => ({
      itemId: `u3-${index}`,
      weeklyHours: 25,
      bayKiBiGWeight: 2,
      bayKiBiGRule: { baseValue: 1563.88 },
      item: { type: 'demand', dateofbirth: '2024-01-01' },
    }));
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: { childRows },
      simulationData: { dataItems: {}, bookingsByItem: {}, qualificationAssignmentsByItem: {} },
      under3AdditionalFactor: 0.025,
      referenceDate: '2026-01-01',
    });

    expect(metrics.under3Children).toBe(10);
    expect(metrics.under3Additional).toBeCloseTo(390.97, 2);
  });

  it('reproduces the ADEBIS U3 supplement for 94 child-months without the regular U3 weighting factor', () => {
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: { childRows: [] },
      simulationData: { dataItems: {}, bookingsByItem: {}, qualificationAssignmentsByItem: {} },
      basisValue: 1563.88,
      under3AdditionalFactor: 0.025,
      under3ChildrenOverride: 94,
      referenceDate: '2026-01-01',
    });

    expect(metrics.under3Additional).toBeCloseTo(3675.118, 6);
  });

  it('counts active U3 child-months even when the booking has no measurable hours', () => {
    const activeBasisChildRecords = [{
      itemId: 'u3-without-hours',
      item: { id: 'u3-without-hours', type: 'demand', dateofbirth: '2024-01-01' },
      bookings: [{
        startdate: '2026-01-01',
        enddate: '',
        buchungsart: { basis: true },
        rawdata: { KRIPPENK: '.T.' },
      }],
    }];
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: { childRows: [] },
      simulationData: { dataItems: {}, bookingsByItem: {}, qualificationAssignmentsByItem: {} },
      activeBasisChildRecords,
      basisValue: 1563.88,
      under3AdditionalFactor: 0.025,
      referenceDate: '2026-01-01',
    });

    expect(metrics.children).toBe(0);
    expect(metrics.weeklyBookingHours).toBe(0);
    expect(metrics.under3Children).toBe(1);
    expect(metrics.under3Additional).toBeCloseTo(39.097, 6);
  });

  it('respects ADEBIS U3 exceptions and monthly U3 count/amount overrides', () => {
    const activeBasisChildRecords = [{
      itemId: 'u3-excepted',
      item: { id: 'u3-excepted', type: 'demand', dateofbirth: '2024-01-01' },
      bookings: [{
        startdate: '2026-01-01',
        enddate: '',
        buchungsart: { basis: true },
        rawdata: { ISKRIPPENKIND: '.T.', LLU3AUSNAHME: '.T.' },
      }],
    }];
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: { childRows: [] },
      simulationData: { dataItems: {}, bookingsByItem: {}, qualificationAssignmentsByItem: {} },
      activeBasisChildRecords,
      basisValue: 1563.88,
      under3AdditionalFactor: 0.025,
      under3ChildrenOverride: '2',
      under3AdditionalOverride: '78,19',
      referenceDate: '2026-01-01',
    });

    expect(metrics.under3Children).toBe(2);
    expect(metrics.under3ChildrenOverride).toBe(2);
    expect(metrics.under3AdditionalOverride).toBe(78.19);
    expect(metrics.under3Additional).toBe(78.19);
  });

  it('accepts ADEBIS monthly values for metrics absent from standard imports', () => {
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: { childRows: [] },
      simulationData: { dataItems: {}, bookingsByItem: {}, qualificationAssignmentsByItem: {} },
      integratedChildrenOverride: '0',
      expertRatioPercentOverride: '84,62',
      operatingDaysOverride: '20',
      referenceDate: '2026-01-01',
    });

    expect(metrics.integratedChildren).toBe(0);
    expect(metrics.expertRatioPercent).toBe(84.62);
    expect(metrics.operatingDays).toBe(20);
  });

  it('deduplicates child rows and leaves unsupported integration/operating-day values unset', () => {
    const metrics = calculateAdebisMonthMetrics({
      monthlyFinance: {
        childRows: [
          { itemId: 'child-1', weeklyHours: 10, bayKiBiGWeight: 1, bayKiBiGRule: { baseValue: 1200 } },
          { itemId: 'child-1', weeklyHours: 10, bayKiBiGWeight: 1, bayKiBiGRule: { baseValue: 1200 } },
        ],
      },
      simulationData: { dataItems: {}, bookingsByItem: {}, qualificationAssignmentsByItem: {} },
      referenceDate: '2026-01-01',
    });

    expect(metrics.children).toBe(1);
    expect(metrics.integratedChildren).toBeNull();
    expect(metrics.operatingDays).toBeNull();
  });
});
