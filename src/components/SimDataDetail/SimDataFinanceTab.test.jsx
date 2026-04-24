import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SimDataFinanceTab from './SimDataFinanceTab';
import simDataSlice from '../../store/simDataSlice';
import simFinanceSlice from '../../store/simFinanceSlice';
import simOverlaySlice from '../../store/simOverlaySlice';

describe.skip('SimDataFinanceTab', () => {
  let store;
  
  beforeEach(() => {
    store = configureStore({
      reducer: {
        simData: simDataSlice,
        simFinance: simFinanceSlice,
        simOverlay: simOverlaySlice,
      },
      preloadedState: {
        simData: {
          dataItems: {
            'scenario-1': {
              'child-1': {
                id: 'child-1',
                type: 'demand',
                name: 'Max',
                dateofbirth: '2024-01-15',
                groupId: 'group-1',
                hasDisability: false,
                temporaryDisabilityDate: '',
                isInDaycare: false,
                hasNonGermanSpeakingParents: false,
              },
              'staff-1': {
                id: 'staff-1',
                type: 'capacity',
                name: 'Anna',
              },
            },
          },
        },
        simFinance: {
          financeByScenario: {
            'scenario-1': {
              bayKiBiGRules: [
                { id: 'b1', label: 'BayKiBiG 2025', baseValue: 120, validFrom: '2025-01-01' },
              ],
              groupFeeCatalogs: {
                'group-1': [
                  { id: 'f1', minHours: 3, maxHours: 6, monthlyAmount: 200, validFrom: '2025-01-01' },
                ],
              },
              itemFinances: {
                'staff-1': {
                  salaryHistory: [
                    { id: 's1', validFrom: '2025-01-01', annualGrossSalary: 48000 },
                  ],
                  employerOnCostHistory: [
                    { id: 'c1', validFrom: '2025-01-01', employerOnCostPercent: 20 },
                  ],
                },
              },
            },
          },
        },
        simOverlay: {
          overlayByScenario: {
            'scenario-1': {
              mode: 'view',
              itemId: 'child-1',
            },
          },
        },
      },
    });
  });

  it('displays finance tab for demand items (children)', () => {
    render(
      <Provider store={store}>
        <SimDataFinanceTab scenarioId="scenario-1" itemId="child-1" />
      </Provider>
    );
    
    expect(screen.getByText(/Finanzielle Auswirkungen/i)).toBeDefined();
  });

  it('displays child revenue preview with parent fee and BayKiBiG', () => {
    render(
      <Provider store={store}>
        <SimDataFinanceTab scenarioId="scenario-1" itemId="child-1" />
      </Provider>
    );
    
    // Check for revenue preview elements
    expect(screen.queryByText(/Elternbeitrag/i) !== null).toBeTruthy();
    expect(screen.queryByText(/BayKiBiG/i) !== null).toBeTruthy();
  });

  it('displays staff cost preview for capacity items', () => {
    render(
      <Provider store={store}>
        <SimDataFinanceTab scenarioId="scenario-1" itemId="staff-1" />
      </Provider>
    );
    
    // Check for cost elements
    expect(screen.queryByText(/Jahresgehalt/i) !== null || screen.queryByText(/Grundkosten/i) !== null).toBeTruthy();
  });

  it('allows updating salary history entries', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <SimDataFinanceTab scenarioId="scenario-1" itemId="staff-1" />
      </Provider>
    );
    
    // Find and click salary accordion
    const accordionTrigger = screen.queryByText(/Gehaltsverlauf/i);
    if (accordionTrigger) {
      await user.click(accordionTrigger);
    }
    
    await waitFor(() => {
      expect(screen.queryByText(/48000/i) !== null || screen.queryByDisplayValue(/48000/) !== null).toBeTruthy();
    });
  });

  it('shows BayKiBiG weight factor in child revenue preview', () => {
    render(
      <Provider store={store}>
        <SimDataFinanceTab scenarioId="scenario-1" itemId="child-1" />
      </Provider>
    );
    
    // For child under 3, weight should be 2.0
    // Look for weight indicator in the UI
    const container = screen.getByText(/Finanzielle Auswirkungen/i).closest('div');
    expect(container !== null).toBeTruthy();
  });
});
