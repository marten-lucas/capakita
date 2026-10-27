import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import FundingSimulationPanel from './FundingSimulationPanel';
import simScenarioReducer from '../../store/simScenarioSlice';
import simDataReducer from '../../store/simDataSlice';
import simBookingReducer from '../../store/simBookingSlice';
import simGroupReducer from '../../store/simGroupSlice';
import simQualificationReducer from '../../store/simQualificationSlice';
import simOverlayReducer from '../../store/simOverlaySlice';
import simFinanceReducer from '../../store/simFinanceSlice';
import chartReducer from '../../store/chartSlice';

const REF = '2026-03-15';

function makeBooking(itemId, { zone = '05', dailyHours = 4, days = 2 } = {}) {
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const times = Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    day_name: dayNames[index],
    segments: [{
      booking_start: '07:00',
      booking_end: `${String(7 + dailyHours).padStart(2, '0')}:00`,
      category: 'pedagogical',
    }],
  }));
  return {
    id: `booking-${itemId}`,
    startdate: '2026-01-01',
    enddate: '',
    times,
    buchungsart: { code: '0', label: 'R', name: 'Standard-/Regelbuchung', gruppe: 'regel', basis: true },
    rawdata: { ZEITKAT: zone, ART: '0' },
  };
}

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
        selectedItems: { 'scenario-1': ['child-1'] },
        saveDialogOpen: false,
        loadDialogOpen: false,
      },
      simData: {
        dataByScenario: {
          'scenario-1': {
            'child-1': {
              id: 'child-1',
              type: 'demand',
              name: 'Erkan Reuter',
              startdate: '2026-01-01',
              enddate: '',
              dateofbirth: '2022-01-01',
              groupId: 'g1',
              familyId: 'fam-1',
              familyLabel: 'Familie Reuter',
              absences: [],
            },
            'child-2': {
              id: 'child-2',
              type: 'demand',
              name: 'Ingrid Reuter',
              startdate: '2026-01-01',
              enddate: '',
              dateofbirth: '2019-01-01',
              groupId: 'g1',
              familyId: 'fam-1',
              familyLabel: 'Familie Reuter',
              absences: [],
            },
          },
        },
      },
      simBooking: {
        bookingsByScenario: {
          'scenario-1': {
            'child-1': { 'booking-1': makeBooking('child-1') },
            'child-2': { 'booking-2': makeBooking('child-2') },
          },
        },
      },
      simGroup: {
        groupDefsByScenario: { 'scenario-1': [{ id: 'g1', name: 'Fuchs' }] },
        groupsByScenario: { 'scenario-1': {} },
      },
      simFinance: {
        financeByScenario: {
          'scenario-1': {
            settings: { partialAbsenceThresholdDays: 42, partialAbsenceEmployerSharePercent: 0 },
            bayKiBiGRules: [{ id: 'r1', baseValue: 11.0, validFrom: '2026-01-01', weightFactors: { regelkind_3to6: 1.0 } }],
            groupFeeCatalogs: {
              g1: [
                { id: 'fee-zone-05', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' },
                { id: 'fee-zone-06', zeitkatId: '06', monthlyAmount: 150, validFrom: '2026-01-01' },
              ],
            },
            itemFinances: {},
          },
        },
      },
      chart: {
        referenceDate: REF,
        timedimension: 'month',
        chartToggles: [],
        filter: { Groups: [], Qualifications: [] },
        chartData: {},
      },
    },
  });
}

describe('FundingSimulationPanel', () => {
  it('zeigt Tarif-Ausgangswerte, Gruppenergebnisse und Gesamtwerte', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    expect(screen.getByText('Simulation von Beitragsänderungen')).toBeTruthy();
    expect(screen.getByText('Ausgangswert: 100,00 €')).toBeTruthy();
    expect(screen.getByText('Ausgangswert: 150,00 €')).toBeTruthy();
    expect(screen.getByText('Gruppen & Gesamt')).toBeTruthy();
    expect(screen.getByTestId('simulation-total-row')).toBeTruthy();
    expect(screen.getByText('Buchungsstunden vorher')).toBeTruthy();
  });

  it('simuliert absolute Preise und lässt die gespeicherten Optionen unverändert', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const sourceSlider = screen.getByRole('slider', { name: 'Simulationspreis Fuchs ZEITKAT 05' });
    // Setze ZEITKAT 05 auf 150 €, identisch zum geladenen ZEITKAT-06-Preis.
    for (let index = 0; index < 10; index += 1) {
      fireEvent.keyDown(sourceSlider, { key: 'ArrowRight', code: 'ArrowRight' });
    }

    expect(sourceSlider.getAttribute('aria-valuenow')).toBe('150');
    expect(screen.getAllByText('5,50 €').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100,00 €').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('simulation-more-hours-impact')).getByText('+8,00 h pro Woche')).toBeTruthy();
    expect(within(screen.getByTestId('simulation-more-hours-impact')).getByText(/2 Kinder in 1 Familie/)).toBeTruthy();
    expect(within(screen.getByTestId('simulation-parent-cost-impact')).getByText('+100,00 € pro Monat')).toBeTruthy();
    expect(within(screen.getByTestId('simulation-parent-cost-impact')).getByText(/2 Kinder in 1 Familie/)).toBeTruthy();
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1[0].monthlyAmount).toBe(100);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1[1].monthlyAmount).toBe(150);
  });

  it('setzt den temporären Einzelpreis zurück auf den geladenen Wert', () => {
    render(
      <Provider store={createTestStore()}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const slider = screen.getByRole('slider', { name: 'Simulationspreis Fuchs ZEITKAT 05' });
    for (let index = 0; index < 10; index += 1) {
      fireEvent.keyDown(slider, { key: 'ArrowRight', code: 'ArrowRight' });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    expect(screen.getByRole('slider', { name: 'Simulationspreis Fuchs ZEITKAT 05' }).getAttribute('aria-valuenow')).toBe('100');
  });

  it('kopiert die aktive Tabelle als tab-getrennte Daten', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(
      <Provider store={createTestStore()}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    fireEvent.click(screen.getByTestId('copy-simulation-groups'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('Gruppe\tBuchungen / Wechsel');
    expect(writeText.mock.calls[0][0]).toContain('Gesamt');
  });

  it('springt per Klick in der Kinder-Tabelle zum Kind-Datensatz', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const tariffSlider = screen.getByRole('slider', { name: 'Simulationspreis Fuchs ZEITKAT 05' });
    for (let index = 0; index < 10; index += 1) {
      fireEvent.keyDown(tariffSlider, { key: 'ArrowRight', code: 'ArrowRight' });
    }
    fireEvent.click(screen.getByRole('tab', { name: /Kinder/ }));
    fireEvent.click(screen.getByTestId('funding-child-child-2'));
    expect(store.getState().simScenario.selectedItems['scenario-1']).toEqual(['child-2']);
    fireEvent.click(screen.getByRole('tab', { name: /Familien/ }));
    expect(screen.getByText('Familie Reuter')).toBeTruthy();
  });
});
