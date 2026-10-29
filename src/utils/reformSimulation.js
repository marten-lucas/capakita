import { pickApplicableValidityEntry, pickLatestValidityEntry } from './financeUtils';
import DEFAULT_ADEBIS_BAYKIBIG_TABLES from '../data/adebis-baykibig-foerdertabellen-2026-2029.json';

export const REFORM_YEARS = [2026, 2027, 2028, 2029];

export const REFORM_FIXED_ASSUMPTIONS = {
  qualityBonusBenchmarkByYear: DEFAULT_ADEBIS_BAYKIBIG_TABLES.qualityBonusBenchmarkByYear,
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

function getBayKiBiGBaseValueForYear(rules, year) {
  const date = `${year}-01-01`;
  const hasBaseValue = (rule) => Number(rule?.baseValue) > 0;
  const applicableRule = pickApplicableValidityEntry(rules, date, hasBaseValue);
  if (applicableRule) return Number(applicableRule.baseValue);

  const previousRule = pickLatestValidityEntry(rules, (rule) => (
    hasBaseValue(rule) && (!rule.validFrom || rule.validFrom <= date)
  ));
  return previousRule ? Number(previousRule.baseValue) : null;
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
export function calculateReformForecast(input = {}, simulatedChangesByYear = {}, bayKiBiGRules = []) {
  const settings = {
    ...DEFAULT_REFORM_FORECAST,
    ...input,
    actualFunding: { ...DEFAULT_REFORM_FORECAST.actualFunding, ...(input.actualFunding || {}) },
  };
  const results = [];
  const baseValue2026 = getBayKiBiGBaseValueForYear(bayKiBiGRules, 2026);
  const bookingTime2026 = amount(settings.actualFunding.bookingTime);
  const preparatoryCourses = amount(settings.actualFunding.preparatoryCourses);
  let previousResult = null;

  REFORM_YEARS.forEach((year) => {
    const baseValueForYear = getBayKiBiGBaseValueForYear(bayKiBiGRules, year);
    const bookingTime = baseValue2026 > 0 && baseValueForYear > 0
      ? bookingTime2026 * baseValueForYear / baseValue2026
      : bookingTime2026;
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
      qualityBonusBenchmarkByYear: REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear,
      hasActualBaseline: Object.values(settings.actualFunding).some((value) => amount(value) !== 0),
      parentFeeSubsidyIncludedInResult: false,
    },
  };
}
