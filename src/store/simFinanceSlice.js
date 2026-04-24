import { createSlice } from '@reduxjs/toolkit';
import { createId } from '../utils/idUtils';

function createEmptyScenarioFinance() {
  return {
    settings: {
      partialAbsenceThresholdDays: 42,
      partialAbsenceEmployerSharePercent: 0,
    },
    bayKiBiGRules: [],
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
  return normalizeValidityEntry(rule, {
    label: rule.label || '',
    baseValue: rule.baseValue ?? '',
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
  return normalizeValidityEntry(entry, {
    minHours: entry.minHours ?? '',
    maxHours: entry.maxHours ?? '',
    monthlyAmount: entry.monthlyAmount ?? '',
    label: entry.label || '',
  });
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

  return {
    settings,
    bayKiBiGRules: Array.isArray(finance.bayKiBiGRules)
      ? finance.bayKiBiGRules.map((rule) => normalizeBayKiBiGRule(rule))
      : [],
    groupFeeCatalogs: Object.fromEntries(
      Object.entries(finance.groupFeeCatalogs || {}).map(([groupId, entries]) => [
        String(groupId),
        Array.isArray(entries) ? entries.map((entry) => normalizeFeeBand(entry)) : [],
      ])
    ),
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
    addBayKiBiGRule(state, action) {
      const { scenarioId, rule } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.bayKiBiGRules.push(normalizeBayKiBiGRule(rule));
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
      if (!scenarioFinance.groupFeeCatalogs[normalizedGroupId]) {
        scenarioFinance.groupFeeCatalogs[normalizedGroupId] = [];
      }
      scenarioFinance.groupFeeCatalogs[normalizedGroupId].push(normalizeFeeBand(entry));
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
      entries[index] = normalizeFeeBand({
        ...entries[index],
        ...updates,
      });
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
    setGroupFeeCatalogs(state, action) {
      const { scenarioId, catalogs } = action.payload;
      const scenarioFinance = ensureScenarioFinanceState(state, scenarioId);
      scenarioFinance.groupFeeCatalogs = Object.fromEntries(
        Object.entries(catalogs || {}).map(([groupId, entries]) => [
          String(groupId),
          Array.isArray(entries) ? entries.map((entry) => normalizeFeeBand(entry)) : [],
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
  addBayKiBiGRule,
  updateBayKiBiGRule,
  deleteBayKiBiGRule,
  addGroupFeeEntry,
  updateGroupFeeEntry,
  deleteGroupFeeEntry,
  deleteGroupFeeCatalog,
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