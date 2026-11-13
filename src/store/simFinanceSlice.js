import { createSlice } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';
import { getFeeBandZeitkatId, getZeitkatIdForMaximumHours } from '../utils/adebisConstants';
import DEFAULT_ADEBIS_BAYKIBIG_TABLES from '../data/adebis-baykibig-foerdertabellen-2026-2029.json';

const DEFAULT_PARENT_FEE_SUBSIDY = {
  enabled: true,
  monthlyAmount: 100,
  minimumAgeYears: 3,
  maximumAgeYears: 7,
  excludeSchoolChildren: true,
  endDate: '2026-12-31',
};

function normalizeParentFeeSubsidy(subsidy = {}) {
  const source = typeof subsidy === 'number' ? { monthlyAmount: subsidy } : (subsidy || {});
  const monthlyAmount = Number(source.monthlyAmount ?? DEFAULT_PARENT_FEE_SUBSIDY.monthlyAmount);
  const minimumAgeYears = Number(source.minimumAgeYears ?? DEFAULT_PARENT_FEE_SUBSIDY.minimumAgeYears);
  const maximumAgeYears = Number(source.maximumAgeYears ?? DEFAULT_PARENT_FEE_SUBSIDY.maximumAgeYears);
  return {
    ...DEFAULT_PARENT_FEE_SUBSIDY,
    ...source,
    enabled: source.enabled !== false,
    monthlyAmount: Number.isFinite(monthlyAmount) ? Math.max(0, monthlyAmount) : DEFAULT_PARENT_FEE_SUBSIDY.monthlyAmount,
    minimumAgeYears: Number.isFinite(minimumAgeYears) ? Math.max(0, minimumAgeYears) : DEFAULT_PARENT_FEE_SUBSIDY.minimumAgeYears,
    maximumAgeYears: Number.isFinite(maximumAgeYears) ? Math.max(0, maximumAgeYears) : DEFAULT_PARENT_FEE_SUBSIDY.maximumAgeYears,
    excludeSchoolChildren: source.excludeSchoolChildren !== false,
    endDate: source.endDate === '' ? '' : (source.endDate ?? DEFAULT_PARENT_FEE_SUBSIDY.endDate),
  };
}

function getRuleYear(value) {
  const year = Number(String(value || '').slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : null;
}

function ruleCoversYear(rule, year) {
  if (!(Number(rule?.baseValue) > 0)) return false;
  const startYear = getRuleYear(rule?.validFrom);
  const endYear = getRuleYear(rule?.validUntil);
  if (!startYear && !endYear) return true;
  if (startYear === year) return true;
  if (!startYear) return endYear >= year;
  return endYear != null && startYear < year && endYear >= year;
}

function mergeDefaultBayKiBiGRules(rules = []) {
  const mergedRules = Array.isArray(rules) ? [...rules] : [];
  const base2026Rule = mergedRules.find((rule) => getRuleYear(rule.validFrom) === 2026)
    || mergedRules.find((rule) => ruleCoversYear(rule, 2026));
  const defaultWeights = DEFAULT_ADEBIS_BAYKIBIG_TABLES.rules[0].weightFactors;
  const inheritedWeights = base2026Rule?.weightFactors || defaultWeights;

  DEFAULT_ADEBIS_BAYKIBIG_TABLES.rules.forEach((defaultRule) => {
    const year = getRuleYear(defaultRule.validFrom);
    const alreadyConfigured = mergedRules.some((rule) => ruleCoversYear(rule, year));
    if (alreadyConfigured) return;
    mergedRules.push({
      ...defaultRule,
      weightFactors: { ...inheritedWeights },
    });
  });

  return mergedRules;
}

function createEmptyScenarioFinance() {
  return {
    parentFeeSubsidy: normalizeParentFeeSubsidy(),
    parentFeeSubsidiesByGroup: {},
    settings: {
      partialAbsenceThresholdDays: 42,
      partialAbsenceEmployerSharePercent: 0,
    },
    bayKiBiGRules: mergeDefaultBayKiBiGRules(),
    groupFeeCatalogs: {},
    itemFinances: {},
  };
}

function normalizeValidityEntry(entry = {}, defaultValues = {}) {
  return {
    id: String(entry.id || createId('finance')),
    validFrom: entry.validFrom || '',
    validUntil: entry.validUntil || '',
    ...defaultValues,
    ...entry,
  };
}

function normalizeBayKiBiGRule(rule = {}) {
  const year = Number(String(rule.validFrom || '').slice(0, 4));
  const defaultRule = DEFAULT_ADEBIS_BAYKIBIG_TABLES.rules.find((entry) => getRuleYear(entry.validFrom) === year);
  const defaultQualityBonusBenchmark = DEFAULT_ADEBIS_BAYKIBIG_TABLES.qualityBonusBenchmarkByYear[year] ?? 0;
  return normalizeValidityEntry(rule, {
    label: rule.label || '',
    baseValue: rule.baseValue ?? '',
    qualityBonusBenchmark: rule.qualityBonusBenchmark ?? defaultQualityBonusBenchmark,
    under3AdditionalFactor: rule.under3AdditionalFactor ?? 0.025,
    preparatoryCoursePerChild: rule.preparatoryCoursePerChild ?? 0,
    teamGrantRates: {
      ...(defaultRule?.teamGrantRates || {}),
      ...(rule.teamGrantRates || {}),
    },
    weightFactors: {
      regelkind_3to6: rule.weightFactors?.regelkind_3to6 ?? 1.0,
      schulkind: rule.weightFactors?.schulkind ?? 1.2,
      migration: rule.weightFactors?.migration ?? 1.3,
      under3: rule.weightFactors?.under3 ?? 2.0,
      disabled: rule.weightFactors?.disabled ?? 4.5,
    },
  });
}

function normalizeFeeBand(entry = {}) {
  const {
    minHours: _legacyMinHours,
    maxHours: legacyMaxHours,
    hoursTo: legacyHoursTo,
    hoursFrom: _legacyHoursFrom,
    ...rest
  } = entry;
  const hasLegacyHours = legacyMaxHours !== undefined || legacyHoursTo !== undefined
    || entry.minHours !== undefined || entry.hoursFrom !== undefined;
  const inferredZeitkatId = getFeeBandZeitkatId(entry)
    || (hasLegacyHours
      ? getZeitkatIdForMaximumHours(legacyMaxHours ?? legacyHoursTo ?? entry.minHours ?? entry.hoursFrom)
      : null);

  return normalizeValidityEntry({
    ...rest,
    ...(inferredZeitkatId ? { zeitkatId: inferredZeitkatId } : {}),
  }, {
    monthlyAmount: entry.monthlyAmount ?? '',
    label: entry.label || '',
  });
}

function normalizeFeeCatalog(entries = []) {
  return (Array.isArray(entries) ? entries : []).map((entry) => normalizeFeeBand(entry));
}

function hasFeeIdentityConflict(entry, entries) {
  const zeitkatId = getFeeBandZeitkatId(entry);
  return Boolean(zeitkatId) && entries.some((other) => (
    getFeeBandZeitkatId(other) === zeitkatId
    && (other.validFrom || '') === (entry.validFrom || '')
    && (other.validUntil || '') === (entry.validUntil || '')
  ));
}

function normalizeSalaryHistoryEntry(entry = {}) {
  return normalizeValidityEntry(entry, {
    annualGrossSalary: entry.annualGrossSalary ?? '',
    note: entry.note || '',
  });
}

function normalizeEmployerCostEntry(entry = {}) {
  return normalizeValidityEntry(entry, {
    employerOnCostPercent: entry.employerOnCostPercent ?? '',
    note: entry.note || '',
  });
}

function normalizePersonnelCostEntry(entry = {}) {
  return normalizeValidityEntry(entry, {
    annualGrossSalary: entry.annualGrossSalary ?? '',
    employerOnCostPercent: entry.employerOnCostPercent ?? '',
    note: entry.note || '',
  });
}

function buildPersonnelCostHistoryFromLegacy(itemFinance = {}) {
  const salaryHistory = Array.isArray(itemFinance.salaryHistory)
    ? itemFinance.salaryHistory.map((entry) => normalizeSalaryHistoryEntry(entry))
    : [];
  const employerOnCostHistory = Array.isArray(itemFinance.employerOnCostHistory)
    ? itemFinance.employerOnCostHistory.map((entry) => normalizeEmployerCostEntry(entry))
    : [];

  const byValidity = new Map();
  salaryHistory.forEach((entry) => {
    const key = `${entry.validFrom || ''}__${entry.validUntil || ''}`;
    byValidity.set(key, {
      id: entry.id,
      validFrom: entry.validFrom || '',
      validUntil: entry.validUntil || '',
      annualGrossSalary: entry.annualGrossSalary ?? '',
      employerOnCostPercent: '',
      note: entry.note || '',
    });
  });

  employerOnCostHistory.forEach((entry) => {
    const key = `${entry.validFrom || ''}__${entry.validUntil || ''}`;
    const existing = byValidity.get(key);
    if (existing) {
      existing.employerOnCostPercent = entry.employerOnCostPercent ?? '';
      if (!existing.note && entry.note) existing.note = entry.note;
    } else {
      byValidity.set(key, {
        id: entry.id,
        validFrom: entry.validFrom || '',
        validUntil: entry.validUntil || '',
        annualGrossSalary: '',
        employerOnCostPercent: entry.employerOnCostPercent ?? '',
        note: entry.note || '',
      });
    }
  });

  return Array.from(byValidity.values()).map((entry) => normalizePersonnelCostEntry(entry));
}

function normalizeItemFinance(itemFinance = {}) {
  const personnelCostHistory = Array.isArray(itemFinance.personnelCostHistory)
    ? itemFinance.personnelCostHistory.map((entry) => normalizePersonnelCostEntry(entry))
    : buildPersonnelCostHistoryFromLegacy(itemFinance);

  return {
    salaryHistory: Array.isArray(itemFinance.salaryHistory)
      ? itemFinance.salaryHistory.map((entry) => normalizeSalaryHistoryEntry(entry))
      : [],
    employerOnCostHistory: Array.isArray(itemFinance.employerOnCostHistory)
      ? itemFinance.employerOnCostHistory.map((entry) => normalizeEmployerCostEntry(entry))
      : [],
    personnelCostHistory,
  };
}

function normalizeScenarioFinance(finance = {}) {
  const settings = {
    ...createEmptyScenarioFinance().settings,
    ...(finance.settings || {}),
  };
  const reformForecast = settings.reformForecast || {};
  const {
    teamRatesByYear: legacyTeamRatesByYear = {},
    ...reformForecastWithoutLegacyRates
  } = reformForecast;
  if (Object.hasOwn(reformForecast, 'teamRatesByYear')) {
    settings.reformForecast = reformForecastWithoutLegacyRates;
  }
  if (settings.fundingSimulation) {
    const fundingSimulation = { ...settings.fundingSimulation };
    delete fundingSimulation.parentFeeSubsidyEnabledByGroup;
    if (Array.isArray(fundingSimulation.simulationScenarios)) {
      fundingSimulation.simulationScenarios = fundingSimulation.simulationScenarios.map((scenario) => {
        const cleanedScenario = { ...scenario };
        if (cleanedScenario.data && typeof cleanedScenario.data === 'object') {
          cleanedScenario.data = { ...cleanedScenario.data };
          delete cleanedScenario.data.parentFeeSubsidyEnabledByGroup;
        }
        return cleanedScenario;
      });
    }
    settings.fundingSimulation = fundingSimulation;
  }
  const bayKiBiGRules = mergeDefaultBayKiBiGRules(finance.bayKiBiGRules)
    .map((rule) => {
      const normalizedRule = normalizeBayKiBiGRule(rule);
      const legacyRates = legacyTeamRatesByYear[String(getRuleYear(normalizedRule.validFrom))];
      return legacyRates
        ? normalizeBayKiBiGRule({
          ...normalizedRule,
          teamGrantRates: { ...normalizedRule.teamGrantRates, ...legacyRates },
        })
        : normalizedRule;
    });
  const groupFeeCatalogs = Object.fromEntries(
    Object.entries(finance.groupFeeCatalogs || {}).map(([groupId, entries]) => [
      String(groupId),
      normalizeFeeCatalog(entries),
    ])
  );
  const parentFeeSubsidiesByGroup = Object.fromEntries(
    Object.entries(finance.parentFeeSubsidiesByGroup || {}).map(([groupId, subsidy]) => [
      String(groupId),
      normalizeParentFeeSubsidy(subsidy),
    ])
  );
  const legacyParentFeeSubsidy = normalizeParentFeeSubsidy(finance.parentFeeSubsidy);
  if (Object.keys(parentFeeSubsidiesByGroup).length === 0 && finance.parentFeeSubsidy) {
    Object.keys(groupFeeCatalogs).forEach((groupId) => {
      parentFeeSubsidiesByGroup[groupId] = { ...legacyParentFeeSubsidy };
    });
  }

  return {
    parentFeeSubsidy: legacyParentFeeSubsidy,
    parentFeeSubsidiesByGroup,
    settings,
    bayKiBiGRules,
    groupFeeCatalogs,
    itemFinances: Object.fromEntries(
      Object.entries(finance.itemFinances || {}).map(([itemId, itemFinance]) => [
        String(itemId),
        normalizeItemFinance(itemFinance),
      ])
    ),
  };
}

function ensureScenarioFinanceState(state, scenarioId) {
  if (!state.financeByScenario[scenarioId]) {
    state.financeByScenario[scenarioId] = createEmptyScenarioFinance();
  }

  return state.financeByScenario[scenarioId];
}

function ensureItemFinanceState(state, scenarioId, itemId) {
  const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
  const normalizedItemId = String(itemId);
  if (!scenarioFinance.itemFinances[normalizedItemId]) {
    scenarioFinance.itemFinances[normalizedItemId] = normalizeItemFinance();
  }
  return scenarioFinance.itemFinances[normalizedItemId];
}

const initialState = {
  financeByScenario: {},
};

const simFinanceSlice = createSlice({
  name: 'simFinance',
  initialState,
  reducers: {
    updateScenarioFinanceSettings(state, action) {
      const { scenarioId, updates } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.settings = {
        ...scenarioFinance.settings,
        ...updates,
      };
    },
    updateFundingSimulationSettings(state, action) {
      const { scenarioId, updates } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.settings ||= {};
      scenarioFinance.settings.fundingSimulation = {
        ...(scenarioFinance.settings.fundingSimulation || {}),
        ...updates,
      };
    },
    updateParentFeeSubsidy(state, action) {
      const { scenarioId, updates } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.parentFeeSubsidy = normalizeParentFeeSubsidy({
        ...scenarioFinance.parentFeeSubsidy,
        ...updates,
      });
    },
    updateGroupParentFeeSubsidy(state, action) {
      const { scenarioId, groupId, updates } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.parentFeeSubsidiesByGroup ||= {};
      const normalizedGroupId = String(groupId);
      const current = scenarioFinance.parentFeeSubsidiesByGroup[normalizedGroupId]
        || scenarioFinance.parentFeeSubsidy;
      scenarioFinance.parentFeeSubsidiesByGroup[normalizedGroupId] = normalizeParentFeeSubsidy({
        ...current,
        ...updates,
      });
    },
    setGroupParentFeeSubsidies(state, action) {
      const { scenarioId, subsidies } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.parentFeeSubsidiesByGroup = Object.fromEntries(
        Object.entries(subsidies || {}).map(([groupId, subsidy]) => [
          String(groupId),
          normalizeParentFeeSubsidy(subsidy),
        ])
      );
    },
    addBayKiBiGRule(state, action) {
      const { scenarioId, rule } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.bayKiBiGRules.push(normalizeBayKiBiGRule(rule));
    },
    seedDefaultBayKiBiGRules(state, action) {
      const scenarioIds = Array.isArray(action.payload?.scenarioIds)
        ? action.payload.scenarioIds
        : [action.payload?.scenarioId];
      scenarioIds.filter(Boolean).forEach((scenarioId) => {
        const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
        scenarioFinance.bayKiBiGRules = mergeDefaultBayKiBiGRules(scenarioFinance.bayKiBiGRules)
          .map((rule) => normalizeBayKiBiGRule(rule));
      });
    },
    updateBayKiBiGRule(state, action) {
      const { scenarioId, ruleId, updates } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      const normalizedRuleId = String(ruleId);
      const index = scenarioFinance.bayKiBiGRules.findIndex((rule) => String(rule.id) === normalizedRuleId);
      if (index === -1) return;
      scenarioFinance.bayKiBiGRules[index] = normalizeBayKiBiGRule({
        ...scenarioFinance.bayKiBiGRules[index],
        ...updates,
      });
    },
    deleteBayKiBiGRule(state, action) {
      const { scenarioId, ruleId } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      const normalizedRuleId = String(ruleId);
      scenarioFinance.bayKiBiGRules = scenarioFinance.bayKiBiGRules.filter((rule) => String(rule.id) !== normalizedRuleId);
    },
    addGroupFeeEntry(state, action) {
      const { scenarioId, groupId, entry } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      const normalizedGroupId = String(groupId);
      const entries = scenarioFinance.groupFeeCatalogs[normalizedGroupId] || [];
      const normalizedEntry = normalizeFeeBand(entry);
      if (hasFeeIdentityConflict(normalizedEntry, entries)) return;
      scenarioFinance.groupFeeCatalogs[normalizedGroupId] = [...entries, normalizedEntry];
    },
    updateGroupFeeEntry(state, action) {
      const { scenarioId, groupId, entryId, updates } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      const normalizedGroupId = String(groupId);
      const entries = scenarioFinance.groupFeeCatalogs[normalizedGroupId];
      if (!entries) return;
      const normalizedEntryId = String(entryId);
      const index = entries.findIndex((entry) => String(entry.id) === normalizedEntryId);
      if (index === -1) return;
      const updatedEntry = normalizeFeeBand({ ...entries[index], ...updates });
      const previousEntry = entries[index];
      const identityChanged = getFeeBandZeitkatId(updatedEntry) !== getFeeBandZeitkatId(previousEntry)
        || (updatedEntry.validFrom || '') !== (previousEntry.validFrom || '')
        || (updatedEntry.validUntil || '') !== (previousEntry.validUntil || '');
      if (identityChanged && hasFeeIdentityConflict(updatedEntry, entries.filter((_, entryIndex) => entryIndex !== index))) return;
      entries[index] = updatedEntry;
    },
    deleteGroupFeeEntry(state, action) {
      const { scenarioId, groupId, entryId } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      const normalizedGroupId = String(groupId);
      const normalizedEntryId = String(entryId);
      const entries = scenarioFinance.groupFeeCatalogs[normalizedGroupId];
      if (!entries) return;
      scenarioFinance.groupFeeCatalogs[normalizedGroupId] = entries.filter((entry) => String(entry.id) !== normalizedEntryId);
    },
    deleteGroupFeeCatalog(state, action) {
      const { scenarioId, groupId } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      delete scenarioFinance.groupFeeCatalogs[String(groupId)];
    },
    mergeGroupFeeCatalogs(state, action) {
      const { scenarioId, catalogs } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      Object.entries(catalogs || {}).forEach(([groupId, entries]) => {
        scenarioFinance.groupFeeCatalogs[String(groupId)] = normalizeFeeCatalog(entries);
      });
    },
    setGroupFeeCatalogs(state, action) {
      const { scenarioId, catalogs } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.groupFeeCatalogs = Object.fromEntries(
        Object.entries(catalogs || {}).map(([groupId, entries]) => [
          String(groupId),
          normalizeFeeCatalog(entries),
        ])
      );
    },
    addSalaryHistoryEntry(state, action) {
      const { scenarioId, itemId, entry } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      itemFinance.salaryHistory.push(normalizeSalaryHistoryEntry(entry));
    },
    updateSalaryHistoryEntry(state, action) {
      const { scenarioId, itemId, entryId, updates } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      const normalizedEntryId = String(entryId);
      const index = itemFinance.salaryHistory.findIndex((entry) => String(entry.id) === normalizedEntryId);
      if (index === -1) return;
      itemFinance.salaryHistory[index] = normalizeSalaryHistoryEntry({
        ...itemFinance.salaryHistory[index],
        ...updates,
      });
    },
    deleteSalaryHistoryEntry(state, action) {
      const { scenarioId, itemId, entryId } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      const normalizedEntryId = String(entryId);
      itemFinance.salaryHistory = itemFinance.salaryHistory.filter((entry) => String(entry.id) !== normalizedEntryId);
    },
    addEmployerOnCostEntry(state, action) {
      const { scenarioId, itemId, entry } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      itemFinance.employerOnCostHistory.push(normalizeEmployerCostEntry(entry));
    },
    updateEmployerOnCostEntry(state, action) {
      const { scenarioId, itemId, entryId, updates } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      const normalizedEntryId = String(entryId);
      const index = itemFinance.employerOnCostHistory.findIndex((entry) => String(entry.id) === normalizedEntryId);
      if (index === -1) return;
      itemFinance.employerOnCostHistory[index] = normalizeEmployerCostEntry({
        ...itemFinance.employerOnCostHistory[index],
        ...updates,
      });
    },
    deleteEmployerOnCostEntry(state, action) {
      const { scenarioId, itemId, entryId } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      const normalizedEntryId = String(entryId);
      itemFinance.employerOnCostHistory = itemFinance.employerOnCostHistory.filter((entry) => String(entry.id) !== normalizedEntryId);
    },
    addPersonnelCostEntry(state, action) {
      const { scenarioId, itemId, entry } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      itemFinance.personnelCostHistory.push(normalizePersonnelCostEntry(entry));
    },
    updatePersonnelCostEntry(state, action) {
      const { scenarioId, itemId, entryId, updates } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      const normalizedEntryId = String(entryId);
      const index = itemFinance.personnelCostHistory.findIndex((entry) => String(entry.id) === normalizedEntryId);
      if (index === -1) return;
      itemFinance.personnelCostHistory[index] = normalizePersonnelCostEntry({
        ...itemFinance.personnelCostHistory[index],
        ...updates,
      });
    },
    deletePersonnelCostEntry(state, action) {
      const { scenarioId, itemId, entryId } = action.payload;
      const itemFinance = ensureItemFinanceState(state, scenarioId, itemId);
      const normalizedEntryId = String(entryId);
      itemFinance.personnelCostHistory = itemFinance.personnelCostHistory.filter((entry) => String(entry.id) !== normalizedEntryId);
    },
    deleteItemFinance(state, action) {
      const { scenarioId, itemId } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      delete scenarioFinance.itemFinances[String(itemId)];
    },
    deleteScenarioFinance(state, action) {
      delete state.financeByScenario[action.payload];
    },
    loadFinanceByScenario(state, action) {
      const loaded = action.payload || {};
      state.financeByScenario = Object.fromEntries(
        Object.entries(loaded).map(([scenarioId, finance]) => [
          String(scenarioId),
          normalizeScenarioFinance(finance),
        ])
      );
    },
  },
});

export const {
  updateScenarioFinanceSettings,
  updateFundingSimulationSettings,
  updateParentFeeSubsidy,
  updateGroupParentFeeSubsidy,
  setGroupParentFeeSubsidies,
  addBayKiBiGRule,
  seedDefaultBayKiBiGRules,
  updateBayKiBiGRule,
  deleteBayKiBiGRule,
  addGroupFeeEntry,
  updateGroupFeeEntry,
  deleteGroupFeeEntry,
  deleteGroupFeeCatalog,
  mergeGroupFeeCatalogs,
  setGroupFeeCatalogs,
  addSalaryHistoryEntry,
  updateSalaryHistoryEntry,
  deleteSalaryHistoryEntry,
  addEmployerOnCostEntry,
  updateEmployerOnCostEntry,
  deleteEmployerOnCostEntry,
  addPersonnelCostEntry,
  updatePersonnelCostEntry,
  deletePersonnelCostEntry,
  deleteItemFinance,
  deleteScenarioFinance,
  loadFinanceByScenario,
} = simFinanceSlice.actions;

export default simFinanceSlice.reducer;