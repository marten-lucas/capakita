import { describe, expect, it } from 'vitest';
import simFinanceReducer, {
  addPersonnelCostEntry,
  deletePersonnelCostEntry,
  loadFinanceByScenario,
  updatePersonnelCostEntry,
} from './simFinanceSlice';

describe('simFinanceSlice', () => {
  it('adds the legacy monthly parent-fee subsidy to the scenario finance model', () => {
    const state = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-default': {},
      'scenario-custom': { parentFeeSubsidy: { monthlyAmount: 75, maximumAgeYears: 6 } },
    }));

    expect(state.financeByScenario['scenario-default'].parentFeeSubsidy).toMatchObject({
      enabled: true,
      monthlyAmount: 100,
      minimumAgeYears: 3,
      maximumAgeYears: 7,
      excludeSchoolChildren: true,
    });
    expect(state.financeByScenario['scenario-custom'].parentFeeSubsidy).toMatchObject({
      monthlyAmount: 75,
      minimumAgeYears: 3,
      maximumAgeYears: 6,
    });
  });

  it('migrates existing automatic Adebis fee entries to ZEITKAT keys', () => {
    const state = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-1': {
        groupFeeCatalogs: {
          g1: [{
            id: 'bart4-z05-2026-01-01',
            label: 'Elternbeitrag (>4-5)',
            maxHours: 5,
            monthlyAmount: 120,
          }],
        },
      },
    }));

    expect(state.financeByScenario['scenario-1'].groupFeeCatalogs.g1[0]).toMatchObject({
      zeitkatId: '05',
      monthlyAmount: 120,
    });
  });
});

describe('simFinanceSlice personnel costs', () => {
  it('migrates legacy salary and on-cost histories into unified personnelCostHistory', () => {
    const nextState = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-1': {
        settings: {
          partialAbsenceThresholdDays: 42,
          partialAbsenceEmployerSharePercent: 0,
        },
        itemFinances: {
          'staff-1': {
            salaryHistory: [
              {
                id: 's1',
                validFrom: '2025-01-01',
                validUntil: '2025-12-31',
                annualGrossSalary: 48000,
              },
            ],
            employerOnCostHistory: [
              {
                id: 'c1',
                validFrom: '2025-01-01',
                validUntil: '2025-12-31',
                employerOnCostPercent: 20,
              },
            ],
          },
        },
      },
    }));

    const personnelHistory = nextState.financeByScenario['scenario-1'].itemFinances['staff-1'].personnelCostHistory;
    expect(personnelHistory).toHaveLength(1);
    expect(personnelHistory[0]).toMatchObject({
      validFrom: '2025-01-01',
      validUntil: '2025-12-31',
      annualGrossSalary: 48000,
      employerOnCostPercent: 20,
    });
  });

  it('supports add/update/delete for unified personnel cost entries', () => {
    let state = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-1': {
        itemFinances: {
          'staff-1': {
            personnelCostHistory: [],
          },
        },
      },
    }));

    state = simFinanceReducer(state, addPersonnelCostEntry({
      scenarioId: 'scenario-1',
      itemId: 'staff-1',
      entry: {
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        annualGrossSalary: 50000,
        employerOnCostPercent: 22,
      },
    }));

    const addedEntry = state.financeByScenario['scenario-1'].itemFinances['staff-1'].personnelCostHistory[0];
    expect(addedEntry).toMatchObject({
      annualGrossSalary: 50000,
      employerOnCostPercent: 22,
    });

    state = simFinanceReducer(state, updatePersonnelCostEntry({
      scenarioId: 'scenario-1',
      itemId: 'staff-1',
      entryId: addedEntry.id,
      updates: {
        annualGrossSalary: 51000,
        employerOnCostPercent: 25,
      },
    }));

    const updatedEntry = state.financeByScenario['scenario-1'].itemFinances['staff-1'].personnelCostHistory[0];
    expect(updatedEntry).toMatchObject({
      annualGrossSalary: 51000,
      employerOnCostPercent: 25,
    });

    state = simFinanceReducer(state, deletePersonnelCostEntry({
      scenarioId: 'scenario-1',
      itemId: 'staff-1',
      entryId: addedEntry.id,
    }));

    expect(state.financeByScenario['scenario-1'].itemFinances['staff-1'].personnelCostHistory).toHaveLength(0);
  });
});
