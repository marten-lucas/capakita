import { pickApplicableValidityEntry, pickLatestValidityEntry } from './financeUtils';
import DEFAULT_ADEBIS_BAYKIBIG_TABLES from '../data/adebis-baykibig-foerdertabellen-2026-2029.json';

export const REFORM_YEARS = [2026, 2027, 2028, 2029];

const DEFAULT_TEAM_RATES_BY_YEAR = Object.fromEntries(
  DEFAULT_ADEBIS_BAYKIBIG_TABLES.rules
    .filter((rule) => rule.teamGrantRates)
    .map((rule) => [Number(String(rule.validFrom).slice(0, 4)), rule.teamGrantRates])
);

export const REFORM_FIXED_ASSUMPTIONS = {
  qualityBonusBenchmarkByYear: DEFAULT_ADEBIS_BAYKIBIG_TABLES.qualityBonusBenchmarkByYear,
  teamRatesByYear: DEFAULT_TEAM_RATES_BY_YEAR,
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

function roundWorkbookMoney(value) {
  const rounded = Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
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

function getTeamGrantRateInfo(year, bayKiBiGRules = []) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const rules = Array.isArray(bayKiBiGRules) ? bayKiBiGRules : [];
  const hasRates = (rule) => rule?.teamGrantRates != null
    && (typeof rule.teamGrantRates !== 'object' || Array.isArray(rule.teamGrantRates) || Object.keys(rule.teamGrantRates).length > 0);
  const rateRules = rules.filter(hasRates);
  const validDate = (value) => {
    if (value == null || value === '') return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const validDates = rateRules.every((rule) => validDate(rule.validFrom) && validDate(rule.validUntil)
    && (!rule.validFrom || !rule.validUntil || rule.validFrom <= rule.validUntil));
  const dates = [start, end];
  if (validDates) rateRules.forEach((rule) => {
    if (rule.validFrom > start && rule.validFrom <= end) dates.push(rule.validFrom);
    if (rule.validUntil >= start && rule.validUntil < end) {
      const next = new Date(`${rule.validUntil}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      dates.push(next.toISOString().slice(0, 10));
    }
  });
  const applicableRule = validDates ? pickApplicableValidityEntry(rateRules, start) : null;
  const validForYear = validDates && dates.every((date) => pickApplicableValidityEntry(rateRules, date) === applicableRule);
  const custom = applicableRule?.teamGrantRates;
  const validShape = custom == null || (typeof custom === 'object' && !Array.isArray(custom));
  const defaults = REFORM_FIXED_ASSUMPTIONS.teamRatesByYear[year] || {};
  const rates = { ...defaults, ...(validShape ? custom : {}) };
  const sources = Object.fromEntries(['first50', 'remaining100'].map((key) => [key,
    validShape && custom && Object.hasOwn(custom, key) ? 'Förderregel' : Object.hasOwn(defaults, key) ? 'ADEBIS-Jahresvorgabe' : 'nicht verfügbar',
  ]));
  return { rates, sources, validForYear: validForYear && validShape };
}

function getTeamGrant(approvedPlaces, rates) {
  const places = Math.floor(Number(approvedPlaces));
  const first50Places = Math.min(places, 50);
  const remainingPlaces = Math.min(Math.max(places - 50, 0), 100);
  return first50Places * Number(rates.first50) + remainingPlaces * Number(rates.remaining100);
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
  let baselineResult = null;
  const subsidyInput = input.actualFunding?.parentFeeSubsidy;
  const hasValidSubsidy = (typeof subsidyInput === 'number' || (typeof subsidyInput === 'string' && subsidyInput.trim() !== ''))
    && Number.isFinite(Number(subsidyInput)) && Number(subsidyInput) >= 0;
  const baselineSubsidy = hasValidSubsidy ? Number(subsidyInput) : null;

  REFORM_YEARS.forEach((year) => {
    const baseValueForYear = getBayKiBiGBaseValueForYear(bayKiBiGRules, year);
    const baseValueRatio = baseValue2026 > 0 && baseValueForYear > 0
      ? baseValueForYear / baseValue2026
      : 1;
    const bookingTime = bookingTime2026 * baseValueRatio;
    const simulatedChanges = simulatedChangesByYear[year] || simulatedChangesByYear[String(year)] || {};
    const simulationFundingDelta = amount(simulatedChanges.deltaYearlyBayKiBiG);
    const components = {
      bookingTime: bookingTime + simulationFundingDelta,
      qualityBonus: year === 2026
        ? amount(settings.actualFunding.qualityBonus)
        : amount(settings.actualFunding.qualityBonus)
          * REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear[year]
          / REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear[2026],
      preparatoryCourses: preparatoryCourses * baseValueRatio,
      under3Additional: year === 2026 ? amount(settings.actualFunding.under3Additional) : 0,
      under3Federal: year === 2026 ? amount(settings.actualFunding.under3Federal) : 0,
    };
    const childRelatedFunding = Object.values(components).reduce((sum, value) => sum + value, 0);
    const grantApplied = year >= 2027 && settings.teamGrantEligible === true;
    const rateInfo = getTeamGrantRateInfo(year, bayKiBiGRules);
    const { rates } = rateInfo;
    const validNonNegative = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
      && Number.isFinite(Number(value)) && Number(value) >= 0;
    const grantInputsValid = !grantApplied || (rateInfo.validForYear && validNonNegative(input.approvedPlaces)
      && Number.isInteger(Number(input.approvedPlaces)) && validNonNegative(rates.first50) && validNonNegative(rates.remaining100));
    const teamGrant = !grantApplied ? 0 : grantInputsValid ? getTeamGrant(input.approvedPlaces, rates) : null;
    const existingGuidelineFunding = amount(settings.actualFunding.assistance)
      + amount(settings.actualFunding.personnelBonus)
      + amount(settings.actualFunding.languageSpecialists);
    const priorGuidelineFunding = grantApplied ? existingGuidelineFunding : 0;
    const teamGrantNet = teamGrant == null ? null : teamGrant - priorGuidelineFunding;

    // The workbook includes the 2026 guideline amounts only in the baseline,
    // even when no team grant is calculated for subsequent years.
    const continuingGuidelineFunding = year === 2026 ? existingGuidelineFunding : 0;
    const unroundedResult = teamGrant == null ? null : childRelatedFunding + continuingGuidelineFunding + teamGrant;
    const parentFeesDelta = amount(simulatedChanges.deltaYearlyParentFees);
    const parentSubsidyDelta = amount(simulatedChanges.deltaYearlyParentSubsidy);
    if (year === 2026) baselineResult = unroundedResult;
    const workbookBaseline = baselineResult == null || baselineSubsidy == null ? null : baselineResult + baselineSubsidy;
    const workbookPrevious = year === 2027 ? workbookBaseline : previousResult;
    const workbookComparison = {
      baselineTotal: workbookBaseline == null ? null : roundWorkbookMoney(workbookBaseline),
      reducedTotal: year === 2026 || unroundedResult == null ? null : roundWorkbookMoney(unroundedResult),
      reducedChange: year === 2026 || unroundedResult == null || workbookPrevious == null ? null : roundWorkbookMoney(unroundedResult - workbookPrevious),
      additionalPayment: year === 2026 || baselineSubsidy == null ? null : baselineSubsidy,
      additionalTotal: year === 2026 || unroundedResult == null || baselineSubsidy == null ? null : roundWorkbookMoney(unroundedResult + baselineSubsidy),
      additionalChange: year === 2026 || unroundedResult == null || workbookPrevious == null || baselineSubsidy == null
        ? null : roundWorkbookMoney(unroundedResult + baselineSubsidy - (year === 2027 ? workbookPrevious : workbookPrevious + baselineSubsidy)),
    };
    results.push({
      year,
      components: { ...components, childRelatedFunding },
      simulationFundingDelta: roundMoney(simulationFundingDelta),
      simulationParentFeesDelta: roundMoney(parentFeesDelta),
      simulationParentSubsidyDelta: roundMoney(parentSubsidyDelta),
      teamGrant,
      grantInputsValid,
      teamGrantRates: rates,
      teamGrantRateSources: rateInfo.sources,
      teamGrantRatesValidForYear: rateInfo.validForYear,
      priorGuidelineFunding,
      continuingGuidelineFunding,
      teamGrantNet,
      parentFeeSubsidyPassThrough: year === 2026 ? amount(settings.actualFunding.parentFeeSubsidy) : 0,
      workbookComparison,
      result: unroundedResult == null ? null : roundMoney(unroundedResult),
      combinedResult: unroundedResult == null ? null : roundMoney(unroundedResult + parentFeesDelta + parentSubsidyDelta),
      changeFromPreviousYear: unroundedResult == null || previousResult == null ? null : roundMoney(unroundedResult - previousResult),
    });
    previousResult = unroundedResult;
  });

  const teamRatesByYear = { ...REFORM_FIXED_ASSUMPTIONS.teamRatesByYear };
  REFORM_YEARS.forEach((year) => {
    const { rates } = getTeamGrantRateInfo(year, bayKiBiGRules);
    if (Object.keys(rates).length > 0) teamRatesByYear[year] = rates;
  });

  return {
    results,
    assumptions: {
      approvedPlaces: Math.max(0, Math.floor(amount(settings.approvedPlaces))),
      teamGrantEligible: settings.teamGrantEligible === true,
      teamRatesByYear,
      qualityBonusBenchmarkByYear: REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear,
      hasActualBaseline: Object.values(settings.actualFunding).some((value) => amount(value) !== 0),
      parentFeeSubsidyIncludedInResult: false,
    },
  };
}
