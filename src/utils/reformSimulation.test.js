import { describe, expect, it } from 'vitest';
import { calculateReformForecast, REFORM_FIXED_ASSUMPTIONS } from './reformSimulation';

describe('calculateReformForecast', () => {
  it('matches the workbook team-grant thresholds at 50, 51, 150 and 151 places', () => {
    const cases = [
      [50, 25000],
      [51, 25167.61],
      [150, 41761],
      [151, 41761],
    ];

    cases.forEach(([approvedPlaces, expectedGrant]) => {
      const result = calculateReformForecast({
        approvedPlaces,
        teamGrantEligible: true,
        actualFunding: { bookingTime: 1000 },
      });
      expect(result.results.find((row) => row.year === 2027).teamGrant).toBe(expectedGrant);
    });
  });

  it('uses the fixed base-value increase and quality-bonus benchmark progression', () => {
    const result = calculateReformForecast({
      approvedPlaces: 51,
      teamGrantEligible: true,
      actualFunding: {
        bookingTime: 1000,
        qualityBonus: 268.01,
        preparatoryCourses: 100,
        under3Additional: 20,
        under3Federal: 10,
        parentFeeSubsidy: 1200,
        assistance: 10,
        personnelBonus: 20,
        languageSpecialists: 30,
      },
      baseValueIncreasePercentByYear: { 2027: 2, 2028: 0, 2029: 0 },
      qualityBonusByYear: { 2027: 1, 2028: 1, 2029: 1 },
      teamRatesByYear: { 2027: { first50: 1, remaining100: 1 } },
    });
    const row2026 = result.results[0];
    const row2027 = result.results[1];

    expect(row2026.result).toBe(1398.01);
    expect(row2026.parentFeeSubsidyPassThrough).toBe(1200);
    expect(row2027.components.bookingTime).toBeCloseTo(1027.8);
    expect(row2027.components.preparatoryCourses).toBeCloseTo(102.78);
    expect(row2027.components.qualityBonus).toBeCloseTo(693.28);
    expect(row2027.teamGrant).toBe(25167.61);
    expect(row2027.priorGuidelineFunding).toBe(60);
    expect(row2027.teamGrantNet).toBe(25107.61);
    expect(row2027.parentFeeSubsidyPassThrough).toBe(0);
    expect(row2027.result).toBeCloseTo(26931.47);
    expect(row2027.changeFromPreviousYear).toBeCloseTo(25533.46);
    expect(result.results[2].components.qualityBonus).toBeCloseTo(852.36);
    expect(result.results[3].components.qualityBonus).toBeCloseTo(857.87);
    expect(result.assumptions.parentFeeSubsidyIncludedInResult).toBe(false);
    expect(result.assumptions.baseValueIncreasePercent).toBe(2.78);
  });

  it('combines each year of slider-derived changes with the reform result', () => {
    const result = calculateReformForecast({
      actualFunding: { bookingTime: 1000, qualityBonus: 268.01 },
    }, {
      2026: { deltaYearlyBayKiBiG: 100, deltaYearlyParentFees: 50, deltaYearlyParentSubsidy: -5 },
      2027: { deltaYearlyBayKiBiG: 25, deltaYearlyParentFees: 30, deltaYearlyParentSubsidy: 0 },
    });

    expect(result.results[0].components.bookingTime).toBe(1100);
    expect(result.results[0].simulationFundingDelta).toBe(100);
    expect(result.results[0].combinedResult).toBe(1413.01);
    expect(result.results[1].components.bookingTime).toBeCloseTo(1052.8);
    expect(result.results[1].simulationParentFeesDelta).toBe(30);
    expect(result.results[1].combinedResult).toBeCloseTo(1776.08);
  });

  it('does not apply new grant deductions when there is no out-of-key staff', () => {
    const result = calculateReformForecast({
      actualFunding: { bookingTime: 1563.88, assistance: 120, personnelBonus: 80 },
      approvedPlaces: 100,
      teamGrantEligible: false,
    });

    expect(result.results[1].components.bookingTime).toBeCloseTo(1607.355864);
    expect(result.results[1].teamGrant).toBe(0);
    expect(result.results[1].priorGuidelineFunding).toBe(0);
    expect(result.results[1].result).toBeCloseTo(result.results[1].components.childRelatedFunding, 2);
    expect(REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear).toEqual({
      2026: 268.01,
      2027: 693.28,
      2028: 852.36,
      2029: 857.87,
    });
  });
});
