import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import simFinanceReducer, { setGroupFeeCatalogs, updateParentFeeSubsidy } from '../../store/simFinanceSlice';
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

function openFuchsTariffGroup() {
  const control = screen.getByRole('button', { name: /Fuchs/ });
  if (control.getAttribute('aria-expanded') !== 'true') fireEvent.click(control);
}

function openFuchsTariffTable() {
  openFuchsTariffGroup();
}

function setFeeAmount(label, value) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
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
    openFuchsTariffGroup();
    expect(screen.getByTestId('fee-staircase-zeitkat')).toBeTruthy();
    openFuchsTariffTable();
    expect(screen.getByLabelText('Betrag ZEITKAT 05')).toBeTruthy();
    expect(screen.getByLabelText('Betrag ZEITKAT 06')).toBeTruthy();
    expect(screen.getByText('Gruppen & Gesamt')).toBeTruthy();
    expect(screen.getByTestId('simulation-total-row')).toBeTruthy();
    expect(screen.getByText('Buchungsstunden vorher')).toBeTruthy();
  });

  it('filtert die Simulation nach ausgewählten Gruppen', () => {
    render(
      <Provider store={createTestStore()}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const groupFilter = screen.getByRole('combobox', { name: 'Gruppen für die Simulation' });
    fireEvent.click(groupFilter);
    fireEvent.click(screen.getByRole('option', { name: 'Ohne Gruppe' }));

    expect(screen.getByTestId('simulation-group-filter')).toBeTruthy();

    expect(screen.queryByTestId('simulation-tariff-groups')).toBeNull();
    expect(screen.getByText(/Keine aktiven Basisbuchungen mit auswertbarer ZEITKAT/)).toBeTruthy();
  });

  it('zeigt die Reform-Zusatzdaten in der Simulation und speichert den 2026-Istwert', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    expect(screen.getByTestId('parent-fee-subsidy-end-date')).toBeTruthy();
    fireEvent.click(screen.getByText('BayKiBiG-Reform · Zusatzdaten für die Berechnung'));
    expect(screen.getByTestId('reform-derived-bookingTime').textContent).toBe('330,00 €');
    expect(screen.getByTestId('reform-derived-parent-fees').textContent).toBe('2.400,00 €');
    expect(screen.getByTestId('reform-derived-parentFeeSubsidy').textContent).toBe('1.200,00 €');
    expect(screen.getByTestId('reform-derived-u3-child-months').textContent).toBe('0 Kindermonate');
    expect(screen.getByTestId('reform-derived-vorkurs-child-months').textContent).toBe('0 Kindermonate');
    fireEvent.click(screen.getByTestId('reform-derived-adopt-bookingTime'));
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.reformForecast.actualFunding.bookingTime).toBe(330);
    const bookingTimeInput = screen.getByLabelText('Ist 2026 · Förderung nach Buchungszeiten');
    fireEvent.change(bookingTimeInput, { target: { value: '9000' } });
    fireEvent.blur(bookingTimeInput);

    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.reformForecast.actualFunding.bookingTime).toBe(9000);
    expect(screen.getByTestId('reform-team-grant-eligible')).toBeTruthy();
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

    openFuchsTariffTable();
    // Setze ZEITKAT 05 auf 150 €, identisch zum geladenen ZEITKAT-06-Preis.
    setFeeAmount('Betrag ZEITKAT 05', 150);

    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 EUR');
    expect(screen.getAllByText('5,50 €').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/100,00 €/).length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('simulation-more-hours-impact')).getByText('+8,00 h pro Woche')).toBeTruthy();
    expect(within(screen.getByTestId('simulation-more-hours-impact')).getByText(/2 Kinder in 1 Familie/)).toBeTruthy();
    expect(within(screen.getByTestId('simulation-parent-cost-impact')).getByText('+100,00 € pro Monat')).toBeTruthy();
    expect(within(screen.getByTestId('simulation-parent-cost-impact')).getByText(/2 Kinder in 1 Familie/)).toBeTruthy();
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1[0].monthlyAmount).toBe(100);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1[1].monthlyAmount).toBe(150);
  });

  it('ordnet importierte Stundenobergrenzen ZEITKAT zu', () => {
    const store = createTestStore();
    store.dispatch(setGroupFeeCatalogs({
      scenarioId: 'scenario-1',
      catalogs: {
        g1: [
          { id: 'json-band-10', label: 'Staffel bis 10 h', maxHours: 10, monthlyAmount: 100 },
          { id: 'json-band-20', label: 'Staffel bis 20 h', maxHours: 20, monthlyAmount: 200 },
        ],
      },
    }));

    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1.map((entry) => entry.zeitkatId)).toEqual(['10', '13']);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1.every((entry) => !Object.hasOwn(entry, 'maxHours'))).toBe(true);
    openFuchsTariffGroup();
    expect(screen.getByTestId('fee-staircase-zeitkat')).toBeTruthy();
    expect(screen.getByTestId('fee-staircase-slider-01')).toBeTruthy();
  });

  it('steuert den festgelegten Elternbeitragszuschuss nur über das Enddatum', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    expect(screen.getByTestId('parent-fee-subsidy-end-date')).toBeTruthy();
    expect(screen.getByTestId('parent-fee-subsidy-value').textContent).toBe('100,00 € / Monat');
    expect(screen.queryByTestId('parent-fee-subsidy-slider')).toBeNull();
    expect(screen.queryByTestId('parent-fee-subsidy-input')).toBeNull();
    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidy).toBeUndefined();

    act(() => store.dispatch(updateParentFeeSubsidy({
      scenarioId: 'scenario-1',
      updates: { endDate: '2026-02-28' },
    })));
    expect(screen.getByTestId('parent-fee-subsidy-value').textContent).toBe('0,00 € / Monat');
  });

  it('setzt den temporären Einzelpreis zurück auf den geladenen Wert', () => {
    render(
      <Provider store={createTestStore()}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 175);
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('175 EUR');
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe zurücksetzen' }));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('100 EUR');
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

    openFuchsTariffTable();
    setFeeAmount('Betrag ZEITKAT 05', 150);
    fireEvent.click(screen.getByRole('tab', { name: /Kinder/ }));
    fireEvent.click(screen.getByTestId('funding-child-child-2'));
    expect(store.getState().simScenario.selectedItems['scenario-1']).toEqual(['child-2']);
    fireEvent.click(screen.getByRole('tab', { name: /Familien/ }));
    expect(screen.getByText('Familie Reuter')).toBeTruthy();
  });
});
