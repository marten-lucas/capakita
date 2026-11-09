import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import OrgaTabFinance from './orgaTabFinance';
import simScenarioReducer from '../../store/simScenarioSlice';
import simDataReducer from '../../store/simDataSlice';
import simBookingReducer from '../../store/simBookingSlice';
import simGroupReducer from '../../store/simGroupSlice';
import simQualificationReducer from '../../store/simQualificationSlice';
import simOverlayReducer from '../../store/simOverlaySlice';
import simFinanceReducer from '../../store/simFinanceSlice';
import chartReducer from '../../store/chartSlice';

function createTestStore() {
  return configureStore({
    reducer: {
      simScenario: simScenarioReducer,
      simData: simDataReducer,
      simBooking: simBookingReducer,
      simGroup: simGroupReducer,
      simQualification: simQualificationReducer,
      simOverlay: simOverlayReducer,
      simFinance: simFinanceReducer,
      chart: chartReducer,
    },
    preloadedState: {
      simScenario: {
        scenarios: [{ id: 'scenario-1', name: 'Szenario 1' }],
        selectedScenarioId: 'scenario-1',
        selectedItems: { 'scenario-1': null },
        saveDialogOpen: false,
        loadDialogOpen: false,
      },
      simData: {
        dataByScenario: {
          'scenario-1': {},
        },
      },
      simBooking: {
        bookingsByScenario: {
          'scenario-1': {},
        },
      },
      simGroup: {
        groupDefsByScenario: {
          'scenario-1': [
            { id: 'group-1', name: 'Krippe Sonnen', type: 'Krippe' },
            { id: 'group-2', name: 'Kindergarten Wald', type: 'Kindergarten' },
          ],
        },
        groupsByScenario: {
          'scenario-1': {},
        },
      },
      simQualification: {
        qualificationDefsByScenario: {},
        qualificationAssignmentsByScenario: {},
      },
      simOverlay: {
        overlaysByScenario: {},
      },
      simFinance: {
        financeByScenario: {
          'scenario-1': {
            settings: {
              partialAbsenceThresholdDays: 42,
              partialAbsenceEmployerSharePercent: 0,
            },
            bayKiBiGRules: [
              {
                id: 'rule-1',
                label: 'BayKiBiG 2025',
                validFrom: '2025-01-01',
                validUntil: '2025-12-31',
                baseValue: 120,
                weightFactors: {
                  regelkind_3to6: 1.0,
                  schulkind: 1.2,
                  migration: 1.3,
                  under3: 2.0,
                  disabled: 4.5,
                },
              },
            ],
            groupFeeCatalogs: {
              'group-1': [
                {
                  id: 'fee-1',
                  validFrom: '2025-01-01',
                  zeitkatId: '06',
                  monthlyAmount: 200,
                },
              ],
              'group-2': [
                {
                  id: 'fee-2',
                  validFrom: '2025-01-01',
                  zeitkatId: '06',
                  monthlyAmount: 150,
                },
              ],
            },
            itemFinances: {},
          },
        },
      },
      chart: {
        'scenario-1': {
          referenceDate: '2026-04-15',
        },
      },
    },
  });
}

describe('OrgaTabFinance', () => {
  it('renders finance sections and existing finance data', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabFinance />
        </Provider>
      </MantineProvider>
    );

    expect(screen.getByText('BayKiBiG-Rahmen')).toBeTruthy();
    expect(screen.getByText('Teilweise Bezahlte Abwesenheit')).toBeTruthy();
    expect(screen.getByText('Beitragskataloge pro Gruppe')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2025')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2026')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2027')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2028')).toBeTruthy();
    expect(screen.getByText('BayKiBiG 2029')).toBeTruthy();
    expect(screen.getByText('Krippe Sonnen')).toBeTruthy();
    expect(screen.getByText('Kindergarten Wald')).toBeTruthy();
  });

  it('edits the monthly parent-fee subsidy as part of each fee catalog', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabFinance />
        </Provider>
      </MantineProvider>
    );

    fireEvent.click(screen.getByText('Krippe Sonnen'));
    const subsidyPanel = screen.getByTestId('fee-catalog-parent-subsidy-group-1');
    expect(within(subsidyPanel).getByText('Elternbeitragszuschuss dieser Beitragsordnung')).toBeTruthy();
    expect(within(subsidyPanel).getByLabelText('Zuschuss gilt bis einschließlich')).toBeTruthy();
    const enabledCheckbox = within(subsidyPanel).getByTestId('fee-catalog-parent-subsidy-enabled-group-1');
    const checkboxInput = enabledCheckbox.tagName === 'INPUT' ? enabledCheckbox : enabledCheckbox.querySelector('input');
    expect(checkboxInput.checked).toBe(true);
    fireEvent.click(checkboxInput);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup['group-1'].enabled).toBe(false);
    fireEvent.click(checkboxInput);
    const amountInput = within(subsidyPanel).getByTestId('fee-catalog-parent-subsidy-amount-group-1');
    fireEvent.change(amountInput, { target: { value: '125' } });
    fireEvent.blur(amountInput);

    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup['group-1'].monthlyAmount).toBe(125);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup['group-2']).toBeUndefined();
  });

  it('edits team-grant rates on the yearly BayKiBiG master rule', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabFinance />
        </Provider>
      </MantineProvider>
    );

    fireEvent.click(screen.getByText('BayKiBiG 2027'));
    const firstTierInput = screen.getAllByLabelText('Platz 1–50')[0];
    fireEvent.change(firstTierInput, { target: { value: '650' } });
    fireEvent.blur(firstTierInput);

    const rule = store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules
      .find((entry) => entry.validFrom === '2027-01-01');
    expect(rule.teamGrantRates).toEqual({ first50: 650, remaining100: 167.61 });
  });

  it('adds a new BayKiBiG rule via the add button', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabFinance />
        </Provider>
      </MantineProvider>
    );

    const addButton = screen.getByRole('button', { name: 'BayKiBiG-Regel hinzufuegen' });
    fireEvent.click(addButton);

    const rules = store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules;
    expect(rules).toHaveLength(6);
    expect(rules.map((rule) => rule.validFrom)).toEqual([
      '2025-01-01',
      '2026-01-01',
      '2027-01-01',
      '2028-01-01',
      '2029-01-01',
      '',
    ]);
  });
});
