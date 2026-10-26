import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
            groupFeeCatalogs: {},
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
  it('berechnet Förderdelta und zeigt betroffene Kinder/Familien', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    // Zone 05 (1,25) → 06 (1,5): Δ = 11,0 × 1,0 × 0,25 = 2,75 €/Monat je Kind
    // KPI = Summe beider Geschwister (5,50 €/Monat, 66,00 €/Jahr)
    expect(screen.getByText('5,50 €')).toBeTruthy();
    expect(screen.getByText('66,00 €')).toBeTruthy();
    expect(screen.getAllByText('2,75 €')).toHaveLength(2); // Tabellenzeilen
    expect(screen.getAllByText('33,00 €')).toHaveLength(2);
    expect(screen.getByText('Betroffene Kinder')).toBeTruthy();

    // Kinder-Tab: beide Geschwister, Familie aggregiert
    fireEvent.click(screen.getByText(/Familien \(/));
    expect(screen.getByText('Familie Reuter')).toBeTruthy();
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

    fireEvent.click(screen.getByTestId('funding-child-child-2'));
    expect(store.getState().simScenario.selectedItems['scenario-1']).toEqual(['child-2']);
  });
});
