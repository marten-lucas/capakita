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

  it('uses the applicable BayKiBiG base value and quality-bonus benchmark progression', () => {
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
    }, {}, [
      { id: 'rule-2026', validFrom: '2026-01-01', validUntil: '2026-12-31', baseValue: 100 },
      { id: 'rule-2027', validFrom: '2027-01-01', baseValue: 120 },
      { id: 'rule-2028', validFrom: '2028-01-01', baseValue: 125 },
    ]);
    const row2026 = result.results[0];
    const row2027 = result.results[1];

    expect(row2026.result).toBe(1458.01);
    expect(row2026.continuingGuidelineFunding).toBe(60);
    expect(row2026.parentFeeSubsidyPassThrough).toBe(1200);
    expect(row2027.components.bookingTime).toBe(1200);
    expect(row2027.components.preparatoryCourses).toBe(120);
    expect(row2027.components.qualityBonus).toBeCloseTo(693.28);
    expect(row2027.teamGrant).toBe(25167.61);
    expect(row2027.priorGuidelineFunding).toBe(60);
    expect(row2027.teamGrantNet).toBe(25107.61);
    expect(row2027.parentFeeSubsidyPassThrough).toBe(0);
    expect(row2027.result).toBeCloseTo(27180.89);
    expect(row2027.changeFromPreviousYear).toBeCloseTo(25722.88);
    expect(result.results[2].components.qualityBonus).toBeCloseTo(852.36);
    expect(result.results[3].components.qualityBonus).toBeCloseTo(857.87);
    expect(result.assumptions.parentFeeSubsidyIncludedInResult).toBe(false);
    expect(Object.hasOwn(result.assumptions, 'baseValueIncreasePercent')).toBe(false);
  });

  it('reproduces workbook formulas for synthetic 2026 inputs and changing base values', () => {
    // Workbook B4/B7:E7 and C45:E46; funding inputs are synthetic.
    const base = 1563.88;
    const rows = calculateReformForecast({
      approvedPlaces: 51, teamGrantEligible: true,
      actualFunding: { bookingTime: base, qualityBonus: 268.01, preparatoryCourses: 100,
        under3Additional: 20, under3Federal: 10, parentFeeSubsidy: 1200,
        assistance: 10, personnelBonus: 20, languageSpecialists: 30 },
    }, {}, [
      { validFrom: '2026-01-01', baseValue: base },
      { validFrom: '2027-01-01', baseValue: base * 1.1 },
      { validFrom: '2028-01-01', baseValue: base * 1.1 * 1.05 },
      { validFrom: '2029-01-01', baseValue: base * 1.1 * 1.05 * 1.02 },
    ]).results;
    expect(rows[0].result).toBeCloseTo(base + 268.01 + 100 + 20 + 10 + 60, 2);
    for (const [index, ratio, quality, grant] of [
      [1, 1.1, 693.28, 25167.61],
      [2, 1.1 * 1.05, 852.36, 35242.37],
      [3, 1.1 * 1.05 * 1.02, 857.87, 35242.37],
    ]) {
      expect(rows[index].components.bookingTime).toBeCloseTo(base * ratio, 8);
      expect(rows[index].components.preparatoryCourses).toBeCloseTo(100 * ratio, 8);
      expect(rows[index].components.qualityBonus).toBeCloseTo(quality, 8);
      expect(rows[index].components.under3Additional).toBe(0);
      expect(rows[index].components.under3Federal).toBe(0);
      expect(rows[index].teamGrant).toBeCloseTo(grant, 2);
      expect(rows[index].result).toBeCloseTo(base * ratio + 100 * ratio + quality + grant, 2);
      expect(rows[index].parentFeeSubsidyPassThrough).toBe(0);
    }
  });

  it('matches both workbook annual comparison paths for a synthetic LibreOffice-recalculated example', () => {
    // Only workbook constants and synthetic inputs; values are not from the supplied facility.
    const base = 1563.88;
    const rows = calculateReformForecast({
      approvedPlaces: 51, teamGrantEligible: true,
      actualFunding: { bookingTime: 1000, qualityBonus: 268.01, preparatoryCourses: 100,
        under3Additional: 20, under3Federal: 10, parentFeeSubsidy: 1200,
        assistance: 10, personnelBonus: 20, languageSpecialists: 30 },
    }, {}, [
      { validFrom: '2026-01-01', baseValue: base },
      { validFrom: '2027-01-01', baseValue: base * 1.1 },
      { validFrom: '2028-01-01', baseValue: base * 1.1 * 1.05 },
      { validFrom: '2029-01-01', baseValue: base * 1.1 * 1.05 * 1.02 },
    ]).results;
    expect(rows[0].workbookComparison.baselineTotal).toBe(2658.01); // B59
    expect(rows.slice(1).map((row) => row.workbookComparison)).toEqual([
      { baselineTotal: 2658.01, reducedTotal: 27070.89, reducedChange: 24412.88, additionalPayment: 1200, additionalTotal: 28270.89, additionalChange: 25612.88 },
      { baselineTotal: 2658.01, reducedTotal: 37365.23, reducedChange: 10294.34, additionalPayment: 1200, additionalTotal: 38565.23, additionalChange: 10294.34 },
      { baselineTotal: 2658.01, reducedTotal: 37396.15, reducedChange: 30.92, additionalPayment: 1200, additionalTotal: 38596.15, additionalChange: 30.92 },
    ]);
  });

  it('rounds a negative half-cent in the workbook comparison away from zero', () => {
    const rows = calculateReformForecast({ actualFunding: { parentFeeSubsidy: 0.005 } }).results;
    expect(rows[1].workbookComparison.reducedChange).toBe(-0.01);
    expect(rows[1].workbookComparison.additionalChange).toBe(0);
  });

  it('does not invent a missing subsidy or prior-year result in workbook comparisons', () => {
    const missing = calculateReformForecast({ actualFunding: { bookingTime: 1000 } }).results;
    expect(missing[0].workbookComparison.baselineTotal).toBeNull();
    expect(missing[1].workbookComparison.additionalTotal).toBeNull();
    expect(missing[1].workbookComparison.reducedChange).toBeNull();
    const rows = calculateReformForecast({ approvedPlaces: 50, teamGrantEligible: true, actualFunding: { parentFeeSubsidy: 0 } }, {}, [
      { validFrom: '2027-01-01', validUntil: '2027-06-30', teamGrantRates: { first50: 500, remaining100: 100 } },
    ]).results;
    expect(rows[1].workbookComparison.reducedTotal).toBeNull();
    expect(rows[2].workbookComparison.reducedTotal).not.toBeNull();
    expect(rows[2].workbookComparison.reducedChange).toBeNull();
    expect(rows[2].workbookComparison.additionalChange).toBeNull();
  });

  it('weist den Nettozuschuss als Veränderung aus, ohne ihn vom kindbezogenen Betrag nochmals abzuziehen', () => {
    for (const prior of [0, 10000, 30000]) {
      const rows = calculateReformForecast({ approvedPlaces: 50, teamGrantEligible: true,
        actualFunding: { bookingTime: 1000, personnelBonus: prior } }).results;
      expect(rows[1].teamGrant).toBe(25000);
      expect(rows[1].teamGrantNet).toBe(25000 - prior);
      expect(rows[0].result).toBe(1000 + prior);
      expect(rows[1].result).toBe(26000);
    }
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
    expect(result.results[1].components.bookingTime).toBe(1025);
    expect(result.results[1].simulationParentFeesDelta).toBe(30);
    expect(result.results[1].combinedResult).toBeCloseTo(1748.28);
  });

  it('übernimmt keinen abgelaufenen Teamzuschusssatz ins Folgejahr', () => {
    const result = calculateReformForecast({ approvedPlaces: 50, teamGrantEligible: true }, {}, [
      { id: '2027', validFrom: '2027-01-01', validUntil: '2027-12-31', teamGrantRates: { first50: 500, remaining100: 167.61 } },
      { id: '2028', validFrom: '2028-01-01', validUntil: '2028-12-31', baseValue: 1563.88 },
    ]);
    expect(result.results[1].teamGrant).toBe(25000);
    expect(result.results[2].teamGrant).toBe(35000);
    expect(result.results[2].grantInputsValid).toBe(true);
    expect(result.results[2].teamGrantRateSources).toEqual({ first50: 'ADEBIS-Jahresvorgabe', remaining100: 'ADEBIS-Jahresvorgabe' });
    expect(result.assumptions.teamRatesByYear[2028]).toEqual({ first50: 700, remaining100: 242.37 });
  });

  it('uses the year-specific team-grant rates from the BayKiBiG master rule', () => {
    const result = calculateReformForecast({
      approvedPlaces: 51,
      teamGrantEligible: true,
    }, {}, [
      {
        id: 'rule-2027',
        validFrom: '2027-01-01',
        validUntil: '2027-12-31',
        teamGrantRates: { first50: 600, remaining100: 200 },
      },
    ]);

    expect(result.results.find((row) => row.year === 2027).teamGrant).toBe(30200);
    expect(result.assumptions.teamRatesByYear[2027]).toEqual({ first50: 600, remaining100: 200 });
  });

  it('verwendet nur ganzjährig gültige Regelwerte und ergänzt einzelne fehlende Werte aus der Jahresvorgabe', () => {
    const input = { approvedPlaces: 51, teamGrantEligible: true };
    const continuous = calculateReformForecast(input, {}, [
      { id: 'open', validFrom: '2027-01-01', teamGrantRates: { first50: 600, remaining100: 200 } },
      { id: '2028', validFrom: '2028-01-01', validUntil: '2028-12-31', baseValue: 100 },
    ]).results[2];
    expect(continuous.teamGrant).toBe(30200);
    expect(continuous.teamGrantRateSources).toEqual({ first50: 'Förderregel', remaining100: 'Förderregel' });
    const partial = calculateReformForecast(input, {}, [
      { id: 'partial', validFrom: '2028-01-01', validUntil: '2028-12-31', teamGrantRates: { first50: 800 } },
    ]).results[2];
    expect(partial.teamGrant).toBe(40242.37);
    expect(partial.teamGrantRateSources).toEqual({ first50: 'Förderregel', remaining100: 'ADEBIS-Jahresvorgabe' });
    for (const rules of [
      [{ validFrom: '2028-01-01', validUntil: '2028-06-30', teamGrantRates: { first50: 500, remaining100: 100 } }],
      [{ validFrom: '2028-07-01', validUntil: '2028-12-31', teamGrantRates: { first50: 500, remaining100: 100 } }],
      [{ validFrom: '2028-02-30', teamGrantRates: { first50: 500, remaining100: 100 } }],
      [{ validFrom: 2028, teamGrantRates: { first50: 500, remaining100: 100 } }],
    ]) {
      const year = calculateReformForecast(input, {}, rules).results[2];
      expect(year.teamGrantRatesValidForYear).toBe(false);
      expect(year.grantInputsValid).toBe(false);
      expect(year.teamGrant).toBeNull();
      expect(year.result).toBeNull();
      expect(year.changeFromPreviousYear).toBeNull();
    }
  });

  it('meldet ungültige Teamzuschuss-Sätze und Platzzahlen statt Vollständigkeit zu behaupten', () => {
    const invalidRates = calculateReformForecast({ approvedPlaces: 50, teamGrantEligible: true }, {}, [
      { validFrom: '2027-01-01', teamGrantRates: { first50: '', remaining100: 100 } },
    ]).results[1];
    expect(invalidRates.grantInputsValid).toBe(false);
    expect(invalidRates.teamGrant).toBeNull();
    expect(invalidRates.result).toBeNull();
    const explicitMissing = calculateReformForecast({ approvedPlaces: 50, teamGrantEligible: true }, {}, [
      { validFrom: '2028-01-01', validUntil: '2028-12-31', teamGrantRates: { first50: 700, remaining100: null } },
    ]).results[2];
    expect(explicitMissing.grantInputsValid).toBe(false);
    expect(explicitMissing.teamGrant).toBeNull();
    expect(explicitMissing.teamGrantRateSources.remaining100).toBe('Förderregel');
    expect(calculateReformForecast({ teamGrantEligible: true }).results[1].grantInputsValid).toBe(false);
    expect(calculateReformForecast({ approvedPlaces: -1, teamGrantEligible: true }).results[1].grantInputsValid).toBe(false);
    expect(calculateReformForecast({ approvedPlaces: 1.5, teamGrantEligible: true }).results[1].grantInputsValid).toBe(false);
    expect(calculateReformForecast({ approvedPlaces: 0, teamGrantEligible: true }).results[1].grantInputsValid).toBe(true);
  });

  it('follows the workbook baseline and drops prior guideline amounts even without a team grant', () => {
    const result = calculateReformForecast({
      actualFunding: { bookingTime: 1563.88, assistance: 120, personnelBonus: 80 },
      approvedPlaces: 100,
      teamGrantEligible: false,
    });

    expect(result.results[1].components.bookingTime).toBe(1563.88);
    expect(result.results[1].teamGrant).toBe(0);
    expect(result.results[1].priorGuidelineFunding).toBe(0);
    expect(result.results[0].continuingGuidelineFunding).toBe(200);
    expect(result.results[1].continuingGuidelineFunding).toBe(0);
    expect(result.results[1].result).toBeCloseTo(result.results[1].components.childRelatedFunding, 2);
    expect(REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear).toEqual({
      2026: 268.01,
      2027: 693.28,
      2028: 852.36,
      2029: 857.87,
    });
  });
});
