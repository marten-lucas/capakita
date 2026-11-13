import { describe, expect, it } from 'vitest';
import { calculateAdebisChildMonthlyRevenue, calculateAdebisFinancePeriod, calculateAdebisMonthlyBaseFunding } from './adebisFinance';
import { calculateAdebisMonthMetrics } from './adebisAnalysis';

const booking = { id: 'b', rawdata: { ART: '0', ZEITKAT: '06', GEWKAT: 'D', BETRSTD: '20' } };
const item = { id: 'c', type: 'demand', groupId: 'g', dateofbirth: '2024-01-01' };
const financeScenario = {
  bayKiBiGRules: [{ baseValue: 1200, validFrom: '2026-01-01', validUntil: '2026-06-30' }, { baseValue: 2400, validFrom: '2026-07-01' }],
  groupFeeCatalogs: { g: [{ zeitkatId: '06', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-06-30' }, { zeitkatId: '06', monthlyAmount: 200, validFrom: '2026-07-01' }] },
};
const childInput = { item, bookings: [booking], groupAssignments: {}, groupDefs: [{ id: 'g' }], financeScenario, referenceDate: '2026-01-01' };
const scenarioInput = { effectiveDataItems: { c: item }, effectiveBookingsByItem: { c: { b: booking } }, effectiveGroupAssignmentsByItem: {}, effectiveGroupDefs: [{ id: 'g' }], financeScenario };

describe('ADEBIS finance snapshots', () => {
  it('uses the same weighted hours and annual basis as the annual analysis, not the stored ZEITKAT factor', () => {
    const child = calculateAdebisChildMonthlyRevenue(childInput);
    const metrics = calculateAdebisMonthMetrics({ monthlyFinance: { childRows: [{ itemId: 'c', item, groupId: 'g', bayKiBiGRule: financeScenario.bayKiBiGRules[0] }] }, simulationData: { dataItems: { c: item }, bookingsByItem: { c: { b: booking } } }, basisValue: 1200, referenceDate: '2026-01-01' });
    expect(child.weeklyHours).toBe(20);
    expect(child.bayKiBiGAmount).toBe(400); // 20 / 5 × 2 × 1200 / 24
    expect(metrics.estimatedFunding).toBe(child.bayKiBiGAmount);
    expect(child.totalAmount).toBe(500);
    expect(calculateAdebisMonthlyBaseFunding(299, 1563.88)).toBeCloseTo(19483.34, 2);
  });

  it('sums changing month snapshots instead of multiplying January by twelve', () => {
    expect(calculateAdebisFinancePeriod(scenarioInput, 'year', '2026')).toMatchObject({ income: 9000, expenses: 0, net: 9000 });
    expect(calculateAdebisFinancePeriod(scenarioInput, 'quarter', '2026-Q3').income).toBe(3000);
    const ending = { ...scenarioInput, effectiveBookingsByItem: { c: { b: { ...booking, enddate: '2026-06-30' } } } };
    expect(calculateAdebisFinancePeriod(ending, 'year', '2026').income).toBeNull();
    const departure = { ...scenarioInput, effectiveDataItems: { c: { ...item, enddate: '2026-06-30' } } };
    expect(calculateAdebisFinancePeriod(departure, 'year', '2026').income).toBe(3000);
    const staff = { ...scenarioInput, effectiveDataItems: { ...scenarioInput.effectiveDataItems, s: { type: 'capacity' } } };
    expect(calculateAdebisFinancePeriod(staff, 'month', '2026-01')).toMatchObject({ income: 500, expenses: null, net: null });
    const withCosts = { ...staff, financeScenario: { ...financeScenario, itemFinances: { s: { personnelCostHistory: [{ annualGrossSalary: 12000, employerOnCostPercent: 0 }] } } } };
    expect(calculateAdebisFinancePeriod(withCosts, 'month', '2026-01')).toMatchObject({ income: 500, expenses: 1000, net: -500 });
  });

  it('leaves missing funding, hours, tariffs and ambiguous bookings unresolved; accepts a zero tariff', () => {
    expect(calculateAdebisChildMonthlyRevenue({ ...childInput, referenceDate: '2025-01-01' }).bayKiBiGAmount).toBeNull();
    expect(calculateAdebisChildMonthlyRevenue({ ...childInput, bookings: [{ ...booking, rawdata: { ART: '0', ZEITKAT: '06', GEWKAT: 'D' } }] }).bayKiBiGAmount).toBeNull();
    expect(calculateAdebisChildMonthlyRevenue({ ...childInput, bookings: [booking, booking] }).totalAmount).toBeNull();
    expect(calculateAdebisChildMonthlyRevenue({ ...childInput, groupAssignments: { a: { assignmentMode: 'multiple', groupId: 'g' } } }).totalAmount).toBeNull();
    const unknownWeight = { ...booking, rawdata: { ...booking.rawdata, GEWKAT: '' } };
    expect(calculateAdebisChildMonthlyRevenue({ ...childInput, item: { ...item, dateofbirth: '2024-02-30' }, bookings: [unknownWeight] }).bayKiBiGAmount).toBeNull();
    expect(calculateAdebisChildMonthlyRevenue({ ...childInput, item: { ...item, absences: [{ start: '2026-01-15', end: '2026-01-20' }] } }).totalAmount).toBeNull();
    expect(calculateAdebisChildMonthlyRevenue({ ...childInput, financeScenario: { ...financeScenario, groupFeeCatalogs: {} } }).parentFeeAmount).toBeNull();
    const free = { ...financeScenario, groupFeeCatalogs: { g: [{ zeitkatId: '06', monthlyAmount: 0 }] } };
    expect(calculateAdebisChildMonthlyRevenue({ ...childInput, financeScenario: free }).totalAmount).toBe(400);
    const missing = { ...financeScenario, bayKiBiGRules: [financeScenario.bayKiBiGRules[0]] };
    expect(calculateAdebisFinancePeriod({ ...scenarioInput, financeScenario: missing }, 'year', '2026').income).toBeNull();
  });
});
