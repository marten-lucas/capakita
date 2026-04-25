import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
                  minHours: 3,
                  maxHours: 6,
                  monthlyAmount: 200,
                },
              ],
              'group-2': [
                {
                  id: 'fee-2',
                  validFrom: '2025-01-01',
                  minHours: 3,
                  maxHours: 6,
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
    expect(screen.getByText('Krippe Sonnen')).toBeTruthy();
    expect(screen.getByText('Kindergarten Wald')).toBeTruthy();
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
    expect(rules).toHaveLength(2);
  });
});
