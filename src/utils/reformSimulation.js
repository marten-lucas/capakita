export const REFORM_YEARS = [2026, 2027, 2028, 2029];

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
  baseValueIncreasePercentByYear: { 2027: 0, 2028: 0, 2029: 0 },
  qualityBonusByYear: { 2026: 268.01, 2027: 693.28, 2028: 852.36, 2029: 857.87 },
  preparatoryCoursesByYear: {},
  under3AdditionalByYear: {},
  under3FederalByYear: {},
  teamRatesByYear: {
    2027: { first50: 500, remaining100: 167.61 },
    2028: { first50: 700, remaining100: 242.37 },
    2029: { first50: 700, remaining100: 242.37 },
  },
};

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((amount(value) + Number.EPSILON) * 100) / 100;
}

function yearValue(values, year, fallback = 0) {
  const candidate = values?.[year] ?? values?.[String(year)];
  return candidate === '' || candidate == null ? fallback : amount(candidate);
}

function getTeamGrant(year, approvedPlaces, teamGrantEligible, rates) {
  if (year < 2027 || !teamGrantEligible) return 0;
  const places = Math.max(0, Math.floor(amount(approvedPlaces)));
  const ratesForYear = rates?.[year] || rates?.[String(year)];
  if (!ratesForYear) return 0;
  const first50Places = Math.min(places, 50);
  const remainingPlaces = Math.min(Math.max(places - 50, 0), 100);
  return first50Places * amount(ratesForYear.first50)
    + remainingPlaces * amount(ratesForYear.remaining100);
}

/**
 * Calculates the annual reform worksheet using its published row logic.
 * Values are annual totals; the parent-fee subsidy is intentionally exposed as
 * a pass-through and excluded from the result, as in the source workbook.
 */
export function calculateReformForecast(input = {}) {
  const settings = {
    ...DEFAULT_REFORM_FORECAST,
    ...input,
    actualFunding: { ...DEFAULT_REFORM_FORECAST.actualFunding, ...(input.actualFunding || {}) },
    baseValueIncreasePercentByYear: {
      ...DEFAULT_REFORM_FORECAST.baseValueIncreasePercentByYear,
      ...(input.baseValueIncreasePercentByYear || {}),
    },
    qualityBonusByYear: { ...DEFAULT_REFORM_FORECAST.qualityBonusByYear, ...(input.qualityBonusByYear || {}) },
    preparatoryCoursesByYear: { ...DEFAULT_REFORM_FORECAST.preparatoryCoursesByYear, ...(input.preparatoryCoursesByYear || {}) },
    under3AdditionalByYear: { ...DEFAULT_REFORM_FORECAST.under3AdditionalByYear, ...(input.under3AdditionalByYear || {}) },
    under3FederalByYear: { ...DEFAULT_REFORM_FORECAST.under3FederalByYear, ...(input.under3FederalByYear || {}) },
    teamRatesByYear: Object.fromEntries(Object.entries(DEFAULT_REFORM_FORECAST.teamRatesByYear).map(([year, rates]) => [
      year,
      { ...rates, ...(input.teamRatesByYear?.[year] || {}) },
    ])),
  };
  const results = [];
  let bookingTime = amount(settings.actualFunding.bookingTime);
  let preparatoryCourses = amount(settings.actualFunding.preparatoryCourses);
  let previousResult = null;

  REFORM_YEARS.forEach((year, index) => {
    if (index > 0) {
      const increasePercent = amount(settings.baseValueIncreasePercentByYear[year]);
      bookingTime *= 1 + increasePercent / 100;
      preparatoryCourses = yearValue(
        settings.preparatoryCoursesByYear,
        year,
        preparatoryCourses * (1 + increasePercent / 100)
      );
    }

    const components = {
      bookingTime,
      qualityBonus: year === 2026
        ? amount(settings.actualFunding.qualityBonus)
        : yearValue(settings.qualityBonusByYear, year),
      preparatoryCourses,
      under3Additional: yearValue(settings.under3AdditionalByYear, year, year === 2026 ? amount(settings.actualFunding.under3Additional) : 0),
      under3Federal: yearValue(settings.under3FederalByYear, year, year === 2026 ? amount(settings.actualFunding.under3Federal) : 0),
    };
    const childRelatedFunding = Object.values(components).reduce((sum, value) => sum + value, 0);
    const teamGrant = getTeamGrant(year, settings.approvedPlaces, settings.teamGrantEligible, settings.teamRatesByYear);
    const priorGuidelineFunding = year === 2026 ? 0 : (
      amount(settings.actualFunding.assistance)
      + amount(settings.actualFunding.personnelBonus)
      + amount(settings.actualFunding.languageSpecialists)
    );
    const teamGrantNet = teamGrant - priorGuidelineFunding;

    const unroundedResult = childRelatedFunding + teamGrantNet;
    results.push({
      year,
      components: { ...components, childRelatedFunding },
      teamGrant,
      priorGuidelineFunding,
      teamGrantNet,
      parentFeeSubsidyPassThrough: year === 2026 ? amount(settings.actualFunding.parentFeeSubsidy) : 0,
      result: roundMoney(unroundedResult),
      changeFromPreviousYear: previousResult == null ? null : roundMoney(unroundedResult - previousResult),
    });
    previousResult = unroundedResult;
  });

  return {
    results,
    assumptions: {
      approvedPlaces: Math.max(0, Math.floor(amount(settings.approvedPlaces))),
      teamGrantEligible: settings.teamGrantEligible === true,
      hasActualBaseline: Object.values(settings.actualFunding).some((value) => amount(value) !== 0),
      parentFeeSubsidyIncludedInResult: false,
    },
  };
}
