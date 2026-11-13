import { describe, expect, it } from 'vitest';
import simFinanceReducer, {
  addGroupFeeEntry,
  addPersonnelCostEntry,
  deletePersonnelCostEntry,
  loadFinanceByScenario,
  seedDefaultBayKiBiGRules,
  setGroupFeeCatalogs,
  updateGroupFeeEntry,
  updateFundingSimulationSettings,
  updateGroupParentFeeSubsidy,
  updatePersonnelCostEntry,
} from './simFinanceSlice';

describe('simFinanceSlice', () => {
  it('merges shared workspace simulation settings without replacing other options', () => {
    let state = simFinanceReducer(undefined, updateFundingSimulationSettings({
      scenarioId: 'scenario-1',
      updates: { fixedBaseYearEnabled: true, fixedBaseYear: 2027 },
    }));
    state = simFinanceReducer(state, updateFundingSimulationSettings({
      scenarioId: 'scenario-1',
      updates: { selectedGroupIds: ['group-1'] },
    }));

    expect(state.financeByScenario['scenario-1'].settings.fundingSimulation).toEqual({
      fixedBaseYearEnabled: true,
      fixedBaseYear: 2027,
      selectedGroupIds: ['group-1'],
    });
  });

  it('drops legacy temporary subsidy toggles when loading saved simulation options', () => {
    const state = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-1': {
        settings: {
          fundingSimulation: {
            selectedGroupIds: ['group-1'],
            parentFeeSubsidyEnabledByGroup: { 'group-1': false },
            simulationScenarios: [{
              id: 'scenario-old',
              name: 'Alt',
              data: { parentFeeSubsidyEnabledByGroup: { 'group-1': false } },
            }],
          },
        },
      },
    }));
    const fundingSimulation = state.financeByScenario['scenario-1'].settings.fundingSimulation;

    expect(fundingSimulation).not.toHaveProperty('parentFeeSubsidyEnabledByGroup');
    expect(fundingSimulation.selectedGroupIds).toEqual(['group-1']);
    expect(fundingSimulation.simulationScenarios[0].data).not.toHaveProperty('parentFeeSubsidyEnabledByGroup');
  });

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

  it('migrates the legacy subsidy into fee catalogs and updates one catalog independently', () => {
    let state = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-1': {
        parentFeeSubsidy: { monthlyAmount: 85, endDate: '2025-12-31' },
        groupFeeCatalogs: { g1: [], g2: [] },
      },
    }));

    expect(state.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup.g1.monthlyAmount).toBe(85);
    state = simFinanceReducer(state, updateGroupParentFeeSubsidy({
      scenarioId: 'scenario-1',
      groupId: 'g1',
      updates: { monthlyAmount: 100 },
    }));

    expect(state.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup.g1).toMatchObject({
      monthlyAmount: 100,
      endDate: '2025-12-31',
    });
    expect(state.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup.g2.monthlyAmount).toBe(85);
  });

  it('seeds future BayKiBiG years by default and inherits the 2026 weighting factors', () => {
    const weightFactors = {
      regelkind_3to6: 1.1,
      schulkind: 1.25,
      migration: 1.4,
      under3: 2.1,
      disabled: 4.6,
    };
    const state = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-1': {
        bayKiBiGRules: [{
          id: 'rule-2026',
          label: 'BayKiBiG 2026',
          validFrom: '2026-01-01',
          validUntil: '2026-12-31',
          baseValue: 1563.88,
          weightFactors,
        }],
      },
      'scenario-empty': {},
      'scenario-placeholder': {
        bayKiBiGRules: [{ label: 'Unvollständige Regel', validFrom: '', validUntil: '', baseValue: '' }],
      },
    }));

    const rules = state.financeByScenario['scenario-1'].bayKiBiGRules;
    expect(rules.filter((rule) => rule.validFrom.startsWith('2027'))).toHaveLength(1);
    expect(rules.filter((rule) => rule.validFrom.startsWith('2028'))).toHaveLength(1);
    expect(rules.filter((rule) => rule.validFrom.startsWith('2029'))).toHaveLength(1);
    expect(rules.find((rule) => rule.validFrom === '2027-01-01')).toMatchObject({
      baseValue: 1563.88,
      weightFactors,
      teamGrantRates: { first50: 500, remaining100: 167.61 },
    });
    expect(state.financeByScenario['scenario-empty'].bayKiBiGRules).toHaveLength(4);
    expect(state.financeByScenario['scenario-empty'].bayKiBiGRules[0]).toMatchObject({
      label: 'BayKiBiG 2026',
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      baseValue: 1563.88,
    });
    expect(state.financeByScenario['scenario-placeholder'].bayKiBiGRules).toHaveLength(5);
  });

  it('migrates saved team-grant rates into the yearly BayKiBiG master rules', () => {
    const state = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-1': {
        settings: {
          reformForecast: {
            approvedPlaces: 47,
            teamRatesByYear: {
              2027: { first50: 600, remaining100: 200 },
            },
          },
        },
      },
    }));
    const finance = state.financeByScenario['scenario-1'];

    expect(finance.bayKiBiGRules.find((rule) => rule.validFrom === '2027-01-01').teamGrantRates)
      .toEqual({ first50: 600, remaining100: 200 });
    expect(finance.settings.reformForecast).not.toHaveProperty('teamRatesByYear');
    expect(finance.settings.reformForecast.approvedPlaces).toBe(47);
  });

  it('seeds missing defaults for an already-loaded scenario', () => {
    const state = simFinanceReducer(undefined, seedDefaultBayKiBiGRules({ scenarioIds: ['scenario-1'] }));
    expect(state.financeByScenario['scenario-1'].bayKiBiGRules.map((rule) => rule.validFrom)).toEqual([
      '2026-01-01',
      '2027-01-01',
      '2028-01-01',
      '2029-01-01',
    ]);
  });

  it('migrates Adebis and legacy hour bands to ZEITKAT categories', () => {
    const state = simFinanceReducer(undefined, loadFinanceByScenario({
      'scenario-1': {
        groupFeeCatalogs: {
          g1: [
            {
              id: 'bart4-z05-2026-01-01',
              label: 'Elternbeitrag (>4-5)',
              maxHours: 5,
              monthlyAmount: 120,
            },
            { id: 'legacy-max-10', label: 'Bis 10 Stunden', maxHours: 10, monthlyAmount: 240 },
          ],
          g2: [
            { id: 'legacy-max-20', maxHours: 20, monthlyAmount: 200 },
            { id: 'legacy-max-30', maxHours: 30, monthlyAmount: 300 },
          ],
        },
      },
    }));

    expect(state.financeByScenario['scenario-1'].groupFeeCatalogs.g1[0]).toMatchObject({
      zeitkatId: '05',
      monthlyAmount: 120,
    });
    expect(state.financeByScenario['scenario-1'].groupFeeCatalogs.g1[1]).toMatchObject({
      zeitkatId: '10',
      monthlyAmount: 240,
    });
    expect(state.financeByScenario['scenario-1'].groupFeeCatalogs.g1[1]).not.toHaveProperty('maxHours');
    expect(state.financeByScenario['scenario-1'].groupFeeCatalogs.g2).toHaveLength(2);
    expect(state.financeByScenario['scenario-1'].groupFeeCatalogs.g2).toMatchObject([
      { zeitkatId: '13', monthlyAmount: 200 },
      { zeitkatId: '13', monthlyAmount: 300 },
    ]);
  });
});

describe('simFinanceSlice fee catalog conflicts', () => {
  const entries = [
    { id: 'first', zeitkatId: '04', validFrom: '2026-01-01', monthlyAmount: 100 },
    { id: 'second', zeitkatId: '04', validFrom: '2026-01-02', monthlyAmount: 200 },
    { id: 'duplicate', zeitkatId: '04', validFrom: '2026-01-02', monthlyAmount: 250 },
  ];

  it('preserves existing duplicates on load and catalog replacement', () => {
    let state = simFinanceReducer(undefined, loadFinanceByScenario({ s: { groupFeeCatalogs: { g: entries } } }));
    expect(state.financeByScenario.s.groupFeeCatalogs.g).toMatchObject(entries);
    state = simFinanceReducer(state, setGroupFeeCatalogs({ scenarioId: 's', catalogs: { g: entries } }));
    expect(state.financeByScenario.s.groupFeeCatalogs.g).toMatchObject(entries);
  });

  it('rejects conflicting add/update operations and accepts a distinct period', () => {
    let state = simFinanceReducer(undefined, loadFinanceByScenario({ s: { groupFeeCatalogs: { g: entries } } }));
    const original = state.financeByScenario.s.groupFeeCatalogs.g;
    state = simFinanceReducer(state, addGroupFeeEntry({ scenarioId: 's', groupId: 'g', entry: { ...entries[0], id: 'new' } }));
    expect(state.financeByScenario.s.groupFeeCatalogs.g).toEqual(original);
    state = simFinanceReducer(state, updateGroupFeeEntry({ scenarioId: 's', groupId: 'g', entryId: 'first', updates: { validFrom: '2026-01-02' } }));
    expect(state.financeByScenario.s.groupFeeCatalogs.g).toEqual(original);
    state = simFinanceReducer(state, updateGroupFeeEntry({ scenarioId: 's', groupId: 'g', entryId: 'first', updates: { validFrom: '2026-01-03' } }));
    expect(state.financeByScenario.s.groupFeeCatalogs.g).toMatchObject([{ ...entries[0], validFrom: '2026-01-03' }, entries[1], entries[2]]);
    state = simFinanceReducer(state, updateGroupFeeEntry({ scenarioId: 's', groupId: 'g', entryId: 'second', updates: { monthlyAmount: 210 } }));
    state = simFinanceReducer(state, addGroupFeeEntry({ scenarioId: 's', groupId: 'g', entry: { ...entries[0], id: 'new', validFrom: '2026-01-04' } }));
    expect(state.financeByScenario.s.groupFeeCatalogs.g).toMatchObject([
      { ...entries[0], validFrom: '2026-01-03' }, { ...entries[1], monthlyAmount: 210 }, entries[2],
      { ...entries[0], id: 'new', validFrom: '2026-01-04' },
    ]);
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
