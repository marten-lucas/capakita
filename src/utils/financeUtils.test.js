import { describe, expect, it } from 'vitest';
import {
  calculateChildMonthlyRevenue,
  calculateMonthlyStaffCost,
  convertMonthlyAmountToPeriod,
  getPeriodBoundsForCategory,
  hasAnyBookingInWeek,
  getBayKiBiGWeightForChild,
} from './financeUtils';

describe('financeUtils', () => {
  it('uses the matching group fee catalog and BayKiBiG rule for a child', () => {
    const result = calculateChildMonthlyRevenue({
      item: { id: 'child-1', type: 'demand', dateofbirth: '2024-01-10', validFrom: '2026-01-01' },
      bookings: [
        {
          id: 'booking-1',
          startdate: '2026-01-01',
          enddate: '2026-12-31',
          times: [
            { day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
            { day_name: 'Di', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
            { day_name: 'Mi', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
            { day_name: 'Do', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
            { day_name: 'Fr', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
          ],
        },
      ],
      groupAssignments: {
        a1: { id: 'a1', groupId: 'g1', start: '2026-01-01', end: '2026-12-31' },
      },
      groupDefs: [{ id: 'g1', type: 'Krippe', name: 'Sonnen' }],
      financeScenario: {
        bayKiBiGRules: [{ id: 'b1', validFrom: '2026-01-01', baseValue: 120 }],
        groupFeeCatalogs: {
          g1: [
            { id: 'f1', validFrom: '2026-01-01', minHours: 0, maxHours: 20, monthlyAmount: 280 },
            { id: 'f2', validFrom: '2026-01-01', minHours: 20.01, maxHours: 30, monthlyAmount: 320 },
          ],
        },
      },
      referenceDate: '2026-04-15',
    });

    expect(result.weeklyHours).toBe(20);
    expect(result.parentFeeAmount).toBe(280);
    expect(result.bayKiBiGAmount).toBe(240);
    expect(result.totalAmount).toBe(520);
  });

  it('reduces sickness costs to zero after six weeks for partially paid absence', () => {
    const result = calculateMonthlyStaffCost({
      item: {
        id: 'staff-1',
        type: 'capacity',
        validFrom: '2026-01-01',
        absences: [
          {
            id: 'abs-1',
            start: '2026-01-10',
            end: '2026-03-31',
            payType: 'partially_paid',
          },
        ],
      },
      itemFinance: {
        salaryHistory: [{ id: 's1', validFrom: '2026-01-01', annualGrossSalary: 48000 }],
        employerOnCostHistory: [{ id: 'c1', validFrom: '2026-01-01', employerOnCostPercent: 20 }],
      },
      referenceDate: '2026-03-15',
      partialAbsenceThresholdDays: 42,
      partialAbsenceEmployerSharePercent: 0,
    });

    expect(result.baseMonthlyCost).toBe(4800);
    expect(result.adjustedMonthlyCost).toBe(0);
    expect(result.absenceCostFactor).toBe(0);
  });

  it('keeps full staff costs when no interruption is entered (absences empty)', () => {
    const result = calculateMonthlyStaffCost({
      item: {
        id: 'staff-no-absence',
        type: 'capacity',
        validFrom: '2026-01-01',
        absences: [],
      },
      itemFinance: {
        salaryHistory: [{ id: 's1', validFrom: '2026-01-01', annualGrossSalary: 48000 }],
        employerOnCostHistory: [{ id: 'c1', validFrom: '2026-01-01', employerOnCostPercent: 20 }],
      },
      referenceDate: '2026-03-15',
      partialAbsenceThresholdDays: 42,
      partialAbsenceEmployerSharePercent: 0,
    });

    expect(result.baseMonthlyCost).toBe(4800);
    expect(result.adjustedMonthlyCost).toBe(4800);
    expect(result.absenceCostFactor).toBe(1);
  });

  it('finds bookings overlapping the reference week', () => {
    const hasBooking = hasAnyBookingInWeek([
      {
        id: 'booking-1',
        startdate: '2026-04-20',
        enddate: '2026-05-10',
        times: [{ day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '10:00' }] }],
      },
    ], '2026-04-24');

    expect(hasBooking).toBe(true);
  });

  it('converts monthly amounts to the current period', () => {
    expect(convertMonthlyAmountToPeriod(1000, 'month')).toBe(1000);
    expect(convertMonthlyAmountToPeriod(1000, 'quarter')).toBe(3000);
    expect(convertMonthlyAmountToPeriod(1000, 'year')).toBe(12000);
    expect(convertMonthlyAmountToPeriod(1000, 'week')).toBeCloseTo(230.769, 3);
  });

  it('parses period bounds from chart categories', () => {
    expect(getPeriodBoundsForCategory('month', '2026-04')).toEqual({ start: '2026-04-01', end: '2026-04-30' });
    expect(getPeriodBoundsForCategory('quarter', '2026-Q2')).toEqual({ start: '2026-04-01', end: '2026-06-30' });
    expect(getPeriodBoundsForCategory('year', '2026')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(getPeriodBoundsForCategory('week', '2026-W17')).toEqual({ start: '2026-04-20', end: '2026-04-26' });
  });

  describe('BayKiBiG weight categories', () => {
    it('Category 1: children < 3 years get 2.0 weight', () => {
      const weight = getBayKiBiGWeightForChild(
        { id: 'child-1', dateofbirth: '2025-06-01' },
        { id: 'g1', type: 'Krippe', name: 'Sunny' },
        '2026-04-15'
      );
      expect(weight).toBe(2);
    });

    it('Category 2: children 3 to school get 1.0 weight (default)', () => {
      const weight = getBayKiBiGWeightForChild(
        { id: 'child-1', dateofbirth: '2023-04-15' },
        { id: 'g1', type: 'Krippe', name: 'Sunny' },
        '2026-04-15'
      );
      expect(weight).toBe(1);
    });

    it('Category 3: school-age children get 1.2 weight', () => {
      const weight = getBayKiBiGWeightForChild(
        { id: 'child-1', dateofbirth: '2018-04-15' },
        { id: 'g1', type: 'Schulkindgruppe', name: 'School' },
        '2026-04-15'
      );
      expect(weight).toBe(1.2);
    });

    it('Category 4: children with disability get 4.5 weight', () => {
      const weight = getBayKiBiGWeightForChild(
        { id: 'child-1', dateofbirth: '2023-04-15', hasDisability: true },
        { id: 'g1', type: 'Krippe', name: 'Sunny' },
        '2026-04-15'
      );
      expect(weight).toBe(4.5);
    });

    it('Category 5: temporary disability (within 6 months) gets 4.5 weight', () => {
      const weight = getBayKiBiGWeightForChild(
        { id: 'child-1', dateofbirth: '2023-04-15', temporaryDisabilityDate: '2026-03-15' },
        { id: 'g1', type: 'Krippe', name: 'Sunny' },
        '2026-04-15' // 31 days after application date
      );
      expect(weight).toBe(4.5);
    });

    it('Category 5: temporary disability expires after 6 months', () => {
      const weight = getBayKiBiGWeightForChild(
        { id: 'child-1', dateofbirth: '2023-04-15', temporaryDisabilityDate: '2025-10-01' },
        { id: 'g1', type: 'Krippe', name: 'Sunny' },
        '2026-04-15' // 197 days after application (> 180 days)
      );
      expect(weight).toBe(1); // Falls back to default
    });

    it('Category 6: children in day-care get 1.3 weight', () => {
      const weight = getBayKiBiGWeightForChild(
        { id: 'child-1', dateofbirth: '2023-04-15', isInDaycare: true },
        { id: 'g1', type: 'Krippe', name: 'Sunny' },
        '2026-04-15'
      );
      expect(weight).toBe(1.3);
    });

    it('Category 8: children of non-German-speaking parents get 1.3 weight', () => {
      const weight = getBayKiBiGWeightForChild(
        { id: 'child-1', dateofbirth: '2023-04-15', hasNonGermanSpeakingParents: true },
        { id: 'g1', type: 'Krippe', name: 'Sunny' },
        '2026-04-15'
      );
      expect(weight).toBe(1.3);
    });

    it('Disability weight takes precedence over other weights', () => {
      // Child with disability + day-care: disability wins (4.5 > 1.3)
      const weight = getBayKiBiGWeightForChild(
        {
          id: 'child-1',
          dateofbirth: '2023-04-15',
          hasDisability: true,
          isInDaycare: true,
        },
        { id: 'g1', type: 'Krippe', name: 'Sunny' },
        '2026-04-15'
      );
      expect(weight).toBe(4.5);
    });
  });

  describe('child finance recalculation and assignment', () => {
    it('recalculates child revenue when reference date changes and assigns the correct group/catalog', () => {
      const baseInput = {
        item: {
          id: 'child-rt-1',
          type: 'demand',
          dateofbirth: '2023-08-15',
          groupId: 'g1',
          validFrom: '2025-01-01',
        },
        bookings: [
          {
            id: 'booking-rt-1',
            startdate: '2025-01-01',
            enddate: '2025-12-31',
            times: [
              { day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '09:00' }] },
              { day_name: 'Di', segments: [{ booking_start: '08:00', booking_end: '09:00' }] },
              { day_name: 'Mi', segments: [{ booking_start: '08:00', booking_end: '09:00' }] },
              { day_name: 'Do', segments: [{ booking_start: '08:00', booking_end: '09:00' }] },
              { day_name: 'Fr', segments: [{ booking_start: '08:00', booking_end: '09:00' }] },
            ],
          },
        ],
        groupAssignments: {
          a1: { id: 'a1', groupId: 'g1', start: '2025-01-01', end: '2025-06-30' },
          a2: { id: 'a2', groupId: 'g2', start: '2025-07-01', end: '2025-12-31' },
        },
        groupDefs: [
          { id: 'g1', type: 'Krippe', name: 'Krippe A' },
          { id: 'g2', type: 'Kindergarten', name: 'Kiga B' },
        ],
        financeScenario: {
          bayKiBiGRules: [
            { id: 'b1', validFrom: '2025-01-01', validUntil: '2025-06-30', baseValue: 100 },
            { id: 'b2', validFrom: '2025-07-01', validUntil: '2025-12-31', baseValue: 200 },
          ],
          groupFeeCatalogs: {
            g1: [{ id: 'g1f1', validFrom: '2025-01-01', minHours: 0, maxHours: 10, monthlyAmount: 165 }],
            g2: [{ id: 'g2f1', validFrom: '2025-01-01', minHours: 0, maxHours: 10, monthlyAmount: 225 }],
          },
        },
      };

      const juneResult = calculateChildMonthlyRevenue({
        ...baseInput,
        referenceDate: '2025-06-15',
      });

      const julyResult = calculateChildMonthlyRevenue({
        ...baseInput,
        referenceDate: '2025-07-15',
      });

      expect(juneResult.groupId).toBe('g1');
      expect(juneResult.parentFeeAmount).toBe(165);
      expect(juneResult.bayKiBiGAmount).toBe(200); // 100 * weight 2.0 (under3)
      expect(juneResult.totalAmount).toBe(365);

      expect(julyResult.groupId).toBe('g2');
      expect(julyResult.parentFeeAmount).toBe(225);
      expect(julyResult.bayKiBiGAmount).toBe(400); // 200 * weight 2.0 (under3)
      expect(julyResult.totalAmount).toBe(625);
    });

    it('returns zero values when no valid BayKiBiG rule and no matching fee band exist at reference date', () => {
      const result = calculateChildMonthlyRevenue({
        item: {
          id: 'child-rt-2',
          type: 'demand',
          dateofbirth: '2023-08-15',
          groupId: 'g1',
          validFrom: '2025-01-01',
        },
        bookings: [
          {
            id: 'booking-rt-2',
            startdate: '2025-01-01',
            enddate: '2025-12-31',
            times: [
              { day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '08:30' }] },
              { day_name: 'Di', segments: [{ booking_start: '08:00', booking_end: '08:30' }] },
            ],
          },
        ],
        groupAssignments: {
          a1: { id: 'a1', groupId: 'g1', start: '2025-01-01', end: '2025-12-31' },
        },
        groupDefs: [{ id: 'g1', type: 'Krippe', name: 'Krippe A' }],
        financeScenario: {
          bayKiBiGRules: [
            { id: 'b1', validFrom: '2025-01-01', validUntil: '2025-06-30', baseValue: 100 },
          ],
          groupFeeCatalogs: {
            g1: [{ id: 'g1f1', validFrom: '2025-01-01', minHours: 3, maxHours: 10, monthlyAmount: 165 }],
          },
        },
        referenceDate: '2025-10-15',
      });

      expect(result.weeklyHours).toBe(1);
      expect(result.parentFeeAmount).toBe(0);
      expect(result.bayKiBiGAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.groupId).toBe('g1');
    });
  });
});