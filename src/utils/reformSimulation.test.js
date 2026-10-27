import { describe, expect, it } from 'vitest';
import { calculateReformForecast } from './reformSimulation';

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

  it('applies the year-on-year base-value rate, independent quality-bonus values and prior-guideline deductions', () => {
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
      qualityBonusByYear: { 2027: 693.28, 2028: 852.36, 2029: 857.87 },
      teamRatesByYear: {
        2027: { first50: 500, remaining100: 167.61 },
        2028: { first50: 700, remaining100: 242.37 },
        2029: { first50: 700, remaining100: 242.37 },
      },
    });
    const row2026 = result.results[0];
    const row2027 = result.results[1];

    expect(row2026.result).toBe(1398.01);
    expect(row2026.parentFeeSubsidyPassThrough).toBe(1200);
    expect(row2027.components.bookingTime).toBe(1020);
    expect(row2027.components.preparatoryCourses).toBe(102);
    expect(row2027.components.qualityBonus).toBe(693.28);
    expect(row2027.teamGrant).toBe(25167.61);
    expect(row2027.priorGuidelineFunding).toBe(60);
    expect(row2027.teamGrantNet).toBe(25107.61);
    expect(row2027.parentFeeSubsidyPassThrough).toBe(0);
    expect(row2027.result).toBe(26922.89);
    expect(row2027.changeFromPreviousYear).toBe(25524.88);
    expect(result.assumptions.parentFeeSubsidyIncludedInResult).toBe(false);
  });

  it('defaults unknown base-value increases to zero and leaves grants out when disabled', () => {
    const result = calculateReformForecast({
      actualFunding: { bookingTime: 1563.88 },
      approvedPlaces: 100,
      teamGrantEligible: false,
    });

    expect(result.results[1].components.bookingTime).toBe(1563.88);
    expect(result.results[1].teamGrant).toBe(0);
    expect(result.results[1].result).toBe(result.results[1].components.childRelatedFunding);
  });
});
