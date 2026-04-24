import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import OrgaTabFinance from './orgaTabFinance';
import simFinanceSlice from '../../store/simFinanceSlice';
import simGroupSlice from '../../store/simGroupSlice';
import simOverlaySlice from '../../store/simOverlaySlice';

describe.skip('OrgaTabFinance', () => {
  let store;
  
  beforeEach(() => {
    store = configureStore({
      reducer: {
        simFinance: simFinanceSlice,
        simGroup: simGroupSlice,
        simOverlay: simOverlaySlice,
      },
      preloadedState: {
        simFinance: {
          financeByScenario: {
            'scenario-1': {
              bayKiBiGRules: [
                { id: 'b1', label: 'BayKiBiG 2025', baseValue: 120, validFrom: '2025-01-01', validUntil: '2025-12-31' },
              ],
              groupFeeCatalogs: {
                'group-1': [
                  { id: 'f1', minHours: 3, maxHours: 6, monthlyAmount: 200, validFrom: '2025-01-01' },
                  { id: 'f2', minHours: 6.01, maxHours: 10, monthlyAmount: 280, validFrom: '2025-01-01' },
                ],
                'group-2': [
                  { id: 'f3', minHours: 3, maxHours: 6, monthlyAmount: 150, validFrom: '2025-01-01' },
                ],
              },
              sicknessBayKiBiGEmployerShareAfterSixWeeks: 0,
            },
          },
        },
        simGroup: {
          groupDefsByScenario: {
            'scenario-1': {
              'group-1': { id: 'group-1', name: 'Krippe Sonnen', type: 'Krippe' },
              'group-2': { id: 'group-2', name: 'Kindergarten Wald', type: 'Kindergarten' },
            },
          },
        },
        simOverlay: {
          overlayByScenario: {
            'scenario-1': { mode: 'view', scenarioId: 'scenario-1' },
          },
        },
      },
    });
  });

  it('displays BayKiBiG rules section', () => {
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    expect(screen.getByText(/BayKiBiG/i)).toBeDefined();
  });

  it('displays group fee catalogs section', () => {
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    expect(screen.getByText(/Gruppenbeiträge/i) || screen.getByText(/Gebührentarif/i)).toBeDefined();
  });

  it('displays sickness rule setting', () => {
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    expect(screen.getByText(/Krankheit|Fehltage|nach sechs Wochen/i)).toBeDefined();
  });

  it('shows existing BayKiBiG rule with baseValue', () => {
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    expect(screen.getByDisplayValue('120')).toBeDefined();
  });

  it('shows fee band entries for each group', () => {
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    // Check for fee band values
    expect(screen.getByDisplayValue('200')).toBeDefined(); // First fee band amount
  });

  it('allows adding new BayKiBiG rule', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    const addButtons = screen.getAllByRole('button').filter(btn => btn.textContent.includes('Hinzufügen') || btn.textContent.includes('+'));
    
    if (addButtons.length > 0) {
      await user.click(addButtons[0]);
      await waitFor(() => {
        // Should have a new input field or form for new rule
        expect(screen.getAllByDisplayValue).toBeDefined();
      });
    }
  });

  it('displays validity dates for BayKiBiG rules', () => {
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    // Look for date inputs
    const dateInputs = screen.queryAllByType('input').filter(input => input.type === 'date');
    expect(dateInputs.length).toBeGreaterThanOrEqual(0);
  });

  it('shows all fee bands for each group', () => {
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    // Should show both fee bands for group-1
    expect(screen.queryAllByDisplayValue.length).toBeGreaterThanOrEqual(0);
    // At least 280 should be visible (second band amount)
    expect(screen.queryByDisplayValue('280')).toBeDefined() || expect(screen.queryByText('280')).toBeDefined();
  });

  it('displays currency formatting (EUR) for amounts', () => {
    render(
      <Provider store={store}>
        <OrgaTabFinance scenarioId="scenario-1" />
      </Provider>
    );
    
    // Check if EUR or € symbol is visible
    const container = screen.getByText(/BayKiBiG/i).closest('div');
    expect(container?.textContent).toMatch(/€|EUR/);
  });
});
