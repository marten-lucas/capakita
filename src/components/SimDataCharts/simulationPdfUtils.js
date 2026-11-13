import { getFeeBandZeitkatId, ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import { pickApplicableValidityEntry } from '../../utils/financeUtils';

function findPdfFeeEntry(catalog, zoneId, referenceDate) {
  return pickApplicableValidityEntry(catalog, referenceDate, (entry) => {
    const amount = finiteNumber(entry.monthlyAmount);
    return entry.enabled !== false && getFeeBandZeitkatId(entry) === zoneId && amount != null && amount >= 0;
  });
}

export function buildSimulationFeePdfRows({
  tariffGroups = [],
  groupFeeCatalogs = {},
  effectiveFeeCatalogs = {},
  parentFeeSubsidiesByGroup = {},
  parentFeeSubsidy = {},
  referenceDate,
}) {
  return tariffGroups.flatMap((group) => {
    const subsidy = parentFeeSubsidiesByGroup[group.id] || parentFeeSubsidy;
    return ZEITKAT_CATALOG.map((zone) => {
      const baselineEntry = findPdfFeeEntry(groupFeeCatalogs[group.id] || [], zone.id, referenceDate);
      const simulatedEntry = findPdfFeeEntry(effectiveFeeCatalogs[group.id] || [], zone.id, referenceDate);
      const baselineAmount = finiteNumber(baselineEntry?.monthlyAmount);
      const simulatedAmount = finiteNumber(simulatedEntry?.monthlyAmount);
      return {
        groupName: group.name,
        subsidy,
        category: `ZEITKAT ${zone.id} (${zone.kurzbez}h)`,
        hours: zone.maxHours,
        baselineAmount,
        simulatedAmount,
        baselineActive: Boolean(baselineEntry),
        simulatedActive: Boolean(simulatedEntry),
        delta: baselineAmount == null || simulatedAmount == null ? null : rounded(simulatedAmount - baselineAmount),
      };
    });
  }).filter((row) => row.baselineActive || row.simulatedActive);
}

// Legacy drilldown: contains family labels and is not suitable for an aggregate-only export.
export function buildAnnualFamilyImpactPdfGroups(annualIncomeRows = []) {
  return annualIncomeRows
    .map((row) => ({
      year: row.year,
      families: (row.familyImpacts || []).map((family) => ({
        label: family.label,
        averageMonthlyParentFeesBefore: family.averageMonthlyParentFeesBefore,
        averageMonthlyParentFeesAfter: family.averageMonthlyParentFeesAfter,
        averageMonthlyDelta: family.averageMonthlyDelta,
        averageMonthlyYearOverYearDelta: family.averageMonthlyYearOverYearDelta,
        yearOverYearAnnualDelta: family.yearOverYearAnnualDelta,
      })),
    }))
    .filter((group) => group.families.length > 0);
}

/** The API's fee flag alone does not establish complete cohort or booking-hours coverage. */
export function summarizeSimulationDiagnostics(diagnostics) {
  const missingTariffs = Array.isArray(diagnostics?.missingTariffs) ? diagnostics.missingTariffs : null;
  const childrenWithoutBookingHours = Array.isArray(diagnostics?.childrenWithoutBookingHours) ? diagnostics.childrenWithoutBookingHours : null;
  return {
    feeCalculationComplete: diagnostics?.feeCalculationComplete === true && missingTariffs !== null,
    activeChildrenComplete: diagnostics?.activeChildrenCoverage === 'caller-provided',
    bookingHoursComplete: childrenWithoutBookingHours !== null && childrenWithoutBookingHours.length === 0,
    missingTariffs: missingTariffs || [],
    childrenWithoutBookingHours: childrenWithoutBookingHours || [],
  };
}

/** Compare annual contributions only when both independently calculated sides are complete. */
export function buildSavedScenarioComparisonRows(leftRows = [], rightRows = []) {
  const left = indexYears(leftRows);
  const right = indexYears(rightRows);
  return [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a - b).map((year) => {
    const leftRow = left.get(year);
    const rightRow = right.get(year);
    const a = leftRow?.feeCalculationComplete === true ? finiteNumber(leftRow.contributions) : null;
    const b = rightRow?.feeCalculationComplete === true ? finiteNumber(rightRow.contributions) : null;
    return {
      year,
      left: a,
      right: b,
      delta: a == null || b == null ? null : rounded(b - a),
      leftMissing: leftRow?.missingTariffChildMonths ?? null,
      rightMissing: rightRow?.missingTariffChildMonths ?? null,
    };
  });
}

export const SAVED_SCENARIO_FINANCIAL_FIELDS = [
  { key: 'totalFunding', label: 'Förderung inkl. Zuschuss' },
  { key: 'annualParentFeeSubsidy', label: 'Davon Elternbeitragszuschuss (nominal)' },
  { key: 'contributions', label: 'Elternbeiträge' },
  { key: 'totalIncome', label: 'Gesamteinnahmen' },
];

/** Compare independently calculated complete years; subsidy is already included in funding. */
function incompleteFinancialReasons(row) {
  if (!row) return ['Jahr fehlt'];
  const reasons = [];
  if (row.missingTariffChildMonths > 0) reasons.push(`${row.missingTariffChildMonths} Kind-Monate ohne Beitrag`);
  else if (row.feeCalculationComplete === false) reasons.push('Beitragsberechnung unvollständig');
  if (row.unusableBookingChildMonths > 0) reasons.push(`${row.unusableBookingChildMonths} Kind-Monate ohne Buchungszeiten`);
  if (row.activeChildrenCoveragePartialMonths > 0) reasons.push('Bestandserfassung unvollständig');
  if (row.forecastComplete === false) reasons.push('Forecast unvollständig');
  if (row.outsideForecastMonths > 0) reasons.push(`${row.outsideForecastMonths} Monate vor Forecast-Stichtag`);
  if (row.missingFundingRuleMonths > 0) reasons.push(`${row.missingFundingRuleMonths} Monate ohne gültige Förderregel`);
  if (row.missingBirthDateChildMonths > 0) reasons.push(`${row.missingBirthDateChildMonths} Kind-Monate ohne gültiges Geburtsdatum`);
  if (row.reformBaselineIncomplete) reasons.push('Reformbasis 2026 unvollständig oder nicht verfügbar');
  if (row.reformYearUnavailable) reasons.push('Reformmodell für dieses Jahr nicht verfügbar');
  if (row.missingManualFunding?.length) reasons.push(`Manuelle Förderangaben fehlen oder sind ungültig: ${row.missingManualFunding.join(', ')}`);
  if (row.invalidReformInputs?.length) reasons.push(`Reformeingaben fehlen oder sind ungültig: ${row.invalidReformInputs.join(', ')}`);
  if (row.estimatedInflow) reasons.push('Geschätzter Zulauf ist im sicheren Vergleich nicht verfügbar');
  if (row.yearComplete === true && SAVED_SCENARIO_FINANCIAL_FIELDS.some(({ key }) => finiteNumber(row[key]) == null)) reasons.push('Finanzwert fehlt oder ist ungültig');
  return reasons.length ? reasons : row.yearComplete === true ? [] : ['Vollständigkeit nicht nachgewiesen'];
}

const MANUAL_FUNDING_FIELDS = [
  ['under3Federal', 'U3-Bund'], ['personnelBonus', 'Personalbonus'],
  ['assistance', 'Assistenz'], ['languageSpecialists', 'Sprache'],
];

export function resolveManualFundingInputs(year, reformSettings = {}) {
  const inputs = reformSettings.annualFundingInputsByYear?.[String(year)] || {};
  const fallback = year === 2026 ? reformSettings.actualFunding || {} : {};
  const values = Object.fromEntries(MANUAL_FUNDING_FIELDS.map(([key]) => [key,
    Object.hasOwn(inputs, key) ? inputs[key] : fallback[key],
  ]));
  const missing = MANUAL_FUNDING_FIELDS.filter(([key]) => {
    const number = finiteNumber(values[key]);
    return number == null || number < 0;
  }).map(([, label]) => `${label} (${year})`);
  return { values, missing };
}

export function invalidReformInputs(actualFunding, settings, fixed2026, grantApplied, year = 2027) {
  const invalid = [];
  if (year >= 2027 && Object.hasOwn(settings, 'teamGrantEligible') && typeof settings.teamGrantEligible !== 'boolean') invalid.push('Anspruch auf Teamzuschuss');
  if (fixed2026) {
    const fields = ['bookingTime', 'qualityBonus', 'preparatoryCourses', 'under3Additional', 'under3Federal', 'assistance', 'personnelBonus', 'languageSpecialists'];
    fields.forEach((field) => {
      const value = finiteNumber(actualFunding[field]);
      if (value == null || value < 0) invalid.push(`2026-Ist ${field}`);
    });
  }
  if (grantApplied) {
    const places = finiteNumber(settings.approvedPlaces);
    if (places == null || places < 0 || !Number.isInteger(places)) invalid.push('genehmigte Plätze');
  }
  return invalid;
}

/** Apply stricter comparison eligibility without changing the underlying simulation. */
export function qualifySavedScenarioRows(rows, options, reformSettings = {}) {
  return rows.map((row) => {
    const inputYear = options.fixedBaseYearEnabled ? options.fixedBaseYear : row.year;
    const missingForYear = (year) => resolveManualFundingInputs(year, reformSettings).missing;
    const missingManualFunding = missingForYear(inputYear);

    const estimatedInflow = !options.fixedBaseYearEnabled && options.stockMode === 'projected' && options.forecastInflowEnabled;
    return {
      ...row, missingManualFunding, estimatedInflow,
      yearComplete: row.yearComplete === true && missingManualFunding.length === 0 && !estimatedInflow && !row.invalidReformInputs?.length,
    };
  });
}

export function buildSavedScenarioFinancialComparisonRows(leftRows = [], rightRows = []) {
  const left = indexYears(leftRows);
  const right = indexYears(rightRows);
  return [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a - b).map((year) => {
    const a = left.get(year);
    const b = right.get(year);
    const leftReasons = incompleteFinancialReasons(a);
    const rightReasons = incompleteFinancialReasons(b);
    const leftComplete = a?.yearComplete === true && leftReasons.length === 0;
    const rightComplete = b?.yearComplete === true && rightReasons.length === 0;
    return {
      year,
      leftComplete,
      rightComplete,
      leftReasons,
      rightReasons,
      values: Object.fromEntries(SAVED_SCENARIO_FINANCIAL_FIELDS.map(({ key }) => [key, compareValues(
        leftComplete ? finiteNumber(a[key]) : null,
        rightComplete ? finiteNumber(b[key]) : null,
      )])),
    };
  });
}

const PDF_MIN_FAMILY_COUNT = 5;
const ANNUAL_FIELDS = [
  'totalFunding', 'additionalFunding', 'annualParentFeeSubsidy',
  'contributions', 'totalIncome', 'averageDailyBookingHours',
];

// Missing and invalid values must not silently become zero.
function finiteNumber(value) {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rounded(value) {
  const result = Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;
  return Object.is(result, -0) ? 0 : result;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function yearNumber(value) {
  const year = finiteNumber(value);
  return Number.isInteger(year) && year >= 1 && year <= 9999 ? year : null;
}

function compareValues(baseline, scenario) {
  return {
    baseline,
    scenario,
    delta: baseline == null || scenario == null ? null : rounded(scenario - baseline),
  };
}

function indexYears(rows) {
  const years = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const year = yearNumber(row?.year);
    if (year == null) throw new Error('Ungültiges Jahr im PDF-Vergleich');
    if (years.has(year)) throw new Error(`Doppeltes Jahr im PDF-Vergleich: ${year}`);
    years.set(year, row);
  });
  return years;
}

function indexGroups(groups) {
  const result = new Map();
  (Array.isArray(groups) ? groups : []).forEach((group) => {
    if (group?.id == null || (typeof group.id !== 'string' && typeof group.id !== 'number')) {
      throw new Error('Gruppen-ID fehlt im PDF-Vergleich');
    }
    const id = String(group.id);
    if (result.has(id)) throw new Error('Doppelte Gruppen-ID im PDF-Vergleich');
    result.set(id, group);
  });
  return result;
}

function assumptions(input, groupCount) {
  return {
    referenceDate: validDate(input.referenceDate),
    fixedBaseYearEnabled: typeof input.fixedBaseYearEnabled === 'boolean' ? input.fixedBaseYearEnabled : null,
    fixedBaseYear: input.fixedBaseYearEnabled === true ? yearNumber(input.fixedBaseYear) : null,
    potentialMonthlyBudget: finiteNumber(input.potentialMonthlyBudget),
    groupCount,
  };
}

function familyAggregate(row, minimumFamilyCount) {
  if (!row || row.yearComplete === false || !Array.isArray(row.familyImpacts)) return { status: 'unavailable' };
  const values = row.familyImpacts.map((family) => finiteNumber(family?.averageMonthlyDelta));
  if (values.some((value) => value == null)) return { status: 'unavailable' };
  const changed = values.filter((value) => Math.abs(value) >= 0.005).sort((a, b) => a - b);
  if (changed.length === 0) return { status: 'empty', affectedFamilies: 0, average: null, median: null };
  if (changed.length < minimumFamilyCount) return { status: 'suppressed' };
  const middle = Math.floor(changed.length / 2);
  return {
    status: 'available',
    affectedFamilies: changed.length,
    average: rounded(changed.reduce((sum, value) => sum + value / changed.length, 0)),
    median: rounded(changed.length % 2 ? changed[middle] : (changed[middle - 1] / 2 + changed[middle] / 2)),
  };
}

function tariffValue(input, groupId, groups, zone) {
  if (!groups.has(groupId) || !validDate(input.referenceDate)) return null;
  const catalog = input.effectiveFeeCatalogs?.[groupId];
  if (!Array.isArray(catalog)) return null;
  const entry = catalog.filter((item) => item && item.enabled !== false
    && getFeeBandZeitkatId(item) === zone.id
    && (!item.validFrom || item.validFrom <= input.referenceDate)
    && (!item.validUntil || item.validUntil >= input.referenceDate))
    .sort((a, b) => String(b.validFrom || '').localeCompare(String(a.validFrom || ''))
      || String(a.id || '').localeCompare(String(b.id || '')))[0];
  if (!entry) return { active: false, monthlyAmount: null };
  const amount = finiteNumber(entry.monthlyAmount);
  return { active: true, monthlyAmount: amount == null ? null : rounded(amount) };
}

function subsidyValue(input, groupId, groups) {
  if (!groups.has(groupId)) return null;
  const rule = input.parentFeeSubsidiesByGroup?.[groupId] ?? input.parentFeeSubsidy;
  if (!rule || typeof rule !== 'object') return null;
  return {
    enabled: typeof rule.enabled === 'boolean' ? rule.enabled : null,
    monthlyAmount: finiteNumber(rule.monthlyAmount),
    endDate: rule.endDate === '' ? '' : validDate(rule.endDate),
  };
}

/**
 * Aggregate-only comparison of two independently calculated scenarios.
 * Inputs: { referenceDate, fixedBaseYearEnabled, fixedBaseYear, potentialMonthlyBudget,
 * tariffGroups, effectiveFeeCatalogs, parentFeeSubsidiesByGroup, parentFeeSubsidy,
 * annualIncomeRows }. Group IDs are used only for matching, never exported. The
 * caller must provide the same group IDs for equivalent groups in both scenarios.
 * Financial values are annual EUR; tariff/subsidy and family values are monthly EUR.
 * totalFunding already includes annualParentFeeSubsidy, and totalIncome includes
 * totalFunding plus contributions. Family statistics describe affected families
 * and their simulation delta, not a matched family-by-family scenario difference.
 *
 * Small family aggregates are suppressed, but this is not anonymisation against
 * linkage or differencing across multiple exports. Review the PDF before sharing.
 */
export function buildSimulationPdfComparison({ baseline = {}, scenario = {}, minimumFamilyCount = PDF_MIN_FAMILY_COUNT } = {}) {
  const requestedMinimum = finiteNumber(minimumFamilyCount);
  const minimum = requestedMinimum == null ? PDF_MIN_FAMILY_COUNT : Math.max(PDF_MIN_FAMILY_COUNT, Math.ceil(requestedMinimum));
  const base = baseline || {};
  const next = scenario || {};
  const baseGroups = indexGroups(base.tariffGroups);
  const nextGroups = indexGroups(next.tariffGroups);
  const groupIds = [...new Set([...baseGroups.keys(), ...nextGroups.keys()])].sort();
  const baseYears = indexYears(base.annualIncomeRows);
  const nextYears = indexYears(next.annualIncomeRows);
  const years = [...new Set([...baseYears.keys(), ...nextYears.keys()])].sort((a, b) => a - b).map((year) => {
    const left = baseYears.get(year);
    const right = nextYears.get(year);
    const values = Object.fromEntries(ANNUAL_FIELDS.map((field) => [field, compareValues(
      left?.yearComplete === false ? null : finiteNumber(left?.[field]),
      right?.yearComplete === false ? null : finiteNumber(right?.[field])
    )]));
    return {
      year,
      values,
      changedFields: ANNUAL_FIELDS.filter((field) => values[field].delta != null && values[field].delta !== 0),
      families: { baseline: familyAggregate(left, minimum), scenario: familyAggregate(right, minimum) },
    };
  });
  const groups = groupIds.map((id, index) => {
    const tariffs = ZEITKAT_CATALOG.map((zone) => {
      const left = tariffValue(base, id, baseGroups, zone);
      const right = tariffValue(next, id, nextGroups, zone);
      if (!left?.active && !right?.active) return null;
      const delta = left?.active && right?.active && left.monthlyAmount != null && right.monthlyAmount != null
        ? rounded(right.monthlyAmount - left.monthlyAmount) : null;
      let changed = null;
      if (left && right) {
        if (left.active !== right.active) changed = true;
        else if (delta != null) changed = delta !== 0;
      }
      return {
        category: `ZEITKAT ${zone.id} (${zone.kurzbez}h)`,
        hours: zone.maxHours,
        baseline: left,
        scenario: right,
        delta,
        changed,
      };
    }).filter(Boolean);
    return {
      label: `Gruppe ${index + 1}`,
      subsidy: { baseline: subsidyValue(base, id, baseGroups), scenario: subsidyValue(next, id, nextGroups) },
      tariffs,
    };
  });
  return {
    format: 'capakita-pdf-scenario-comparison',
    version: 1,
    assumptions: { baseline: assumptions(base, baseGroups.size), scenario: assumptions(next, nextGroups.size) },
    years,
    groups,
    privacy: { minimumFamilyCount: minimum, familyMode: 'simulation', note: 'Kleine Familienaggregate unterdrückt; Verknüpfung und Differenzbildung zwischen Exporten können Rückschlüsse ermöglichen.' },
  };
}
