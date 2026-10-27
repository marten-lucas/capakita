export const REFORM_YEARS = [2026, 2027, 2028, 2029];

export const REFORM_FIXED_ASSUMPTIONS = {
  baseValueIncreasePercent: 2.78,
  qualityBonusBenchmarkByYear: {
    2026: 268.01,
    2027: 693.28,
    2028: 852.36,
    2029: 857.87,
  },
  teamRatesByYear: {
    2027: { first50: 500, remaining100: 167.61 },
    2028: { first50: 700, remaining100: 242.37 },
    2029: { first50: 700, remaining100: 242.37 },
  },
};

export const DEFAULT_REFORM_FORECAST = {
  approvedPlaces: 0,
  teamGrantEligible: false,
  actualFunding: {
    bookingTime: 0,
    qualityBonus: 0,
    preparatoryCourses: 0,
    under3Additional: 0,
    under3Federal: 0,
    parentFeeSubsidy: 0,
    assistance: 0,
    personnelBonus: 0,
    languageSpecialists: 0,
  },
};

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((amount(value) + Number.EPSILON) * 100) / 100;
}

function getTeamGrant(year, approvedPlaces, teamGrantEligible) {
  if (year < 2027 || !teamGrantEligible) return 0;
  const ratesForYear = REFORM_FIXED_ASSUMPTIONS.teamRatesByYear[year];
  if (!ratesForYear) return 0;
  const places = Math.max(0, Math.floor(amount(approvedPlaces)));
  const first50Places = Math.min(places, 50);
  const remainingPlaces = Math.min(Math.max(places - 50, 0), 100);
  return first50Places * ratesForYear.first50
    + remainingPlaces * ratesForYear.remaining100;
}

/**
 * Calculates annual reform totals from the 2026 actual funding baseline.
 * Slider-derived funding and parent-income changes are supplied per year and
 * remain separate in the returned breakdown. The parent-fee subsidy is a
 * pass-through and is excluded from the reform result.
 */
export function calculateReformForecast(input = {}, simulatedChangesByYear = {}) {
  const settings = {
    ...DEFAULT_REFORM_FORECAST,
    ...input,
    actualFunding: { ...DEFAULT_REFORM_FORECAST.actualFunding, ...(input.actualFunding || {}) },
  };
  const results = [];
  let bookingTime = amount(settings.actualFunding.bookingTime);
  let preparatoryCourses = amount(settings.actualFunding.preparatoryCourses);
  let previousResult = null;

  REFORM_YEARS.forEach((year, index) => {
    if (index > 0) {
      bookingTime *= 1 + REFORM_FIXED_ASSUMPTIONS.baseValueIncreasePercent / 100;
      preparatoryCourses *= 1 + REFORM_FIXED_ASSUMPTIONS.baseValueIncreasePercent / 100;
    }

    const simulatedChanges = simulatedChangesByYear[year] || simulatedChangesByYear[String(year)] || {};
    const simulationFundingDelta = amount(simulatedChanges.deltaYearlyBayKiBiG);
    const components = {
      bookingTime: bookingTime + simulationFundingDelta,
      qualityBonus: year === 2026
        ? amount(settings.actualFunding.qualityBonus)
        : amount(settings.actualFunding.qualityBonus)
          * REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear[year]
          / REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear[2026],
      preparatoryCourses,
      under3Additional: year === 2026 ? amount(settings.actualFunding.under3Additional) : 0,
      under3Federal: year === 2026 ? amount(settings.actualFunding.under3Federal) : 0,
    };
    const childRelatedFunding = Object.values(components).reduce((sum, value) => sum + value, 0);
    const teamGrant = getTeamGrant(year, settings.approvedPlaces, settings.teamGrantEligible === true);
    const priorGuidelineFunding = year >= 2027 && settings.teamGrantEligible === true
      ? amount(settings.actualFunding.assistance)
        + amount(settings.actualFunding.personnelBonus)
        + amount(settings.actualFunding.languageSpecialists)
      : 0;
    const teamGrantNet = teamGrant - priorGuidelineFunding;

    const unroundedResult = childRelatedFunding + teamGrantNet;
    const parentFeesDelta = amount(simulatedChanges.deltaYearlyParentFees);
    const parentSubsidyDelta = amount(simulatedChanges.deltaYearlyParentSubsidy);
    results.push({
      year,
      components: { ...components, childRelatedFunding },
      simulationFundingDelta: roundMoney(simulationFundingDelta),
      simulationParentFeesDelta: roundMoney(parentFeesDelta),
      simulationParentSubsidyDelta: roundMoney(parentSubsidyDelta),
      teamGrant,
      priorGuidelineFunding,
      teamGrantNet,
      parentFeeSubsidyPassThrough: year === 2026 ? amount(settings.actualFunding.parentFeeSubsidy) : 0,
      result: roundMoney(unroundedResult),
      combinedResult: roundMoney(unroundedResult + parentFeesDelta + parentSubsidyDelta),
      changeFromPreviousYear: previousResult == null ? null : roundMoney(unroundedResult - previousResult),
    });
    previousResult = unroundedResult;
  });

  return {
    results,
    assumptions: {
      approvedPlaces: Math.max(0, Math.floor(amount(settings.approvedPlaces))),
      teamGrantEligible: settings.teamGrantEligible === true,
      baseValueIncreasePercent: REFORM_FIXED_ASSUMPTIONS.baseValueIncreasePercent,
      qualityBonusBenchmarkByYear: REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear,
      hasActualBaseline: Object.values(settings.actualFunding).some((value) => amount(value) !== 0),
      parentFeeSubsidyIncludedInResult: false,
    },
  };
}
