import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import FundingSimulationPanel from './FundingSimulationPanel';
import simScenarioReducer, { updateScenario } from '../../store/simScenarioSlice';
import simDataReducer from '../../store/simDataSlice';
import simBookingReducer from '../../store/simBookingSlice';
import simGroupReducer from '../../store/simGroupSlice';
import simQualificationReducer from '../../store/simQualificationSlice';
import simOverlayReducer from '../../store/simOverlaySlice';
import simFinanceReducer, { setGroupFeeCatalogs, updateGroupParentFeeSubsidy } from '../../store/simFinanceSlice';
import chartReducer from '../../store/chartSlice';

const REF = '2026-03-15';

function makeBooking(itemId, { zone = '05', dailyHours = 4, days = 2, startdate = '2026-01-01', enddate = '', bookingId } = {}) {
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
    id: bookingId || `booking-${itemId}`,
    startdate,
    enddate,
    times,
    buchungsart: { code: '0', label: 'R', name: 'Standard-/Regelbuchung', gruppe: 'regel', basis: true },
    rawdata: { ZEITKAT: zone, ART: '0' },
  };
}

function createTestStore({ include2027BookingChange = false } = {}) {
  const childOneBookings = include2027BookingChange
    ? {
      'booking-child1-2026': makeBooking('child-1', {
        bookingId: 'booking-child1-2026',
        enddate: '2026-12-31',
      }),
      'booking-child1-2027': makeBooking('child-1', {
        bookingId: 'booking-child1-2027',
        zone: '08',
        dailyHours: 7,
        days: 5,
        startdate: '2027-01-01',
      }),
    }
    : { 'booking-1': makeBooking('child-1') };
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
            'child-1': childOneBookings,
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

function openSimulationSettings() {
  const settingsControl = screen.getByRole('button', { name: /Simulation von Beitragsänderungen/ });
  if (settingsControl.getAttribute('aria-expanded') !== 'true') fireEvent.click(settingsControl);
}

function openFuchsTariffGroup() {
  openSimulationSettings();
  expect(screen.getByTestId('simulation-tariff-slide-g1')).toBeTruthy();
}

function openFuchsTariffTable() {
  openFuchsTariffGroup();
}

function setFeeAmount(label, value) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

function getEuroAmount(element) {
  const amount = element.textContent.match(/-?[\d.]+,\d{2}/)?.[0] || '0,00';
  return Number(amount.replace(/\./g, '').replace(',', '.'));
}

describe('FundingSimulationPanel', () => {
  it('zeigt Tarif-Konfigurationen und Jahresergebnisse in getrennten Bereichen', async () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const settingsControl = screen.getByRole('button', { name: /Simulation von Beitragsänderungen/ });
    expect(settingsControl.getAttribute('aria-expanded')).toBe('false');
    openSimulationSettings();
    expect(screen.queryByText('Verwendet die im Capakita-Datenspeicher hinterlegten ZEITKAT-Sätze.')).toBeNull();
    expect(screen.queryByText(/Die Slider stellen Monatsbeiträge je ZEITKAT ein/)).toBeNull();
    const resetAllButton = screen.getByTestId('reset-all-temporary-prices');
    expect(resetAllButton.querySelector('svg')).toBeTruthy();
    expect(resetAllButton.parentElement).toBe(screen.getByTestId('temporary-category-prices-header'));
    expect(screen.getByRole('combobox', { name: 'Gruppen für Tarif-Einstellungen' })).toBeTruthy();
    expect(screen.getByTestId('simulation-settings-panel')).toBeTruthy();
    const resultsPanel = screen.getByTestId('simulation-results-panel');
    expect(within(resultsPanel).getByRole('heading', { name: 'Ergebnis der Jahre & Familien-Impact' })).toBeTruthy();
    const comparisonRow = within(resultsPanel).getByTestId('annual-income-row-2026');
    expect(screen.getByTestId('reform-actual-comparison-bookingTime').textContent).toContain('Capakita-Berechnung:');
    expect(screen.queryByTestId('reform-team-rate-2027-first50')).toBeNull();
    expect(within(resultsPanel).getByTestId('annual-income-row-2027')).toBeTruthy();
    expect(within(resultsPanel).getByTestId('annual-income-row-2028')).toBeTruthy();
    expect(within(resultsPanel).getByTestId('annual-income-row-2029')).toBeTruthy();
    expect(comparisonRow.textContent).toContain('2.417,60 €');
    expect(comparisonRow.textContent).toContain('3,20 h/Tag');
    expect(within(resultsPanel).getByTestId('annual-upgrade-potential-2026').textContent).toContain('h/Tag');
    expect(within(resultsPanel).getByTestId('annual-downgrade-potential-2026')).toBeTruthy();
    expect(within(resultsPanel).getByTestId('family-potential-budget')).toBeTruthy();
    fireEvent.click(within(resultsPanel).getByTestId('annual-income-details-2026'));
    const adebisTotal = await screen.findByTestId('adebis-monthly-total');
    expect(adebisTotal.textContent).toContain('17,60 €');
    expect(screen.getByTestId('adebis-total-funding-row')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Familienbaum' }));
    expect(await screen.findByTestId('family-tree-total')).toBeTruthy();
    expect(screen.getByTestId('family-tree-family-surname:reuter')).toBeTruthy();
    const firstChildRow = screen.getByTestId('family-tree-child-child-1');
    expect(firstChildRow.textContent).toContain('Fuchs');
    expect(firstChildRow.textContent).toContain('ZEITKAT 05 (>4-5h)');
    expect(firstChildRow.textContent).toContain('01.01.2026 – unbegrenzt');
    const groupToggle = screen.getByRole('switch', { name: 'Kinder nach Familie gruppieren' });
    expect(groupToggle.checked).toBe(true);
    fireEvent.click(groupToggle);
    expect(screen.queryByTestId('family-tree-family-surname:reuter')).toBeNull();
    expect(screen.getByTestId('family-tree-child-child-1')).toBeTruthy();
    expect(within(resultsPanel).getByTestId('no-affected-families')).toBeTruthy();
    openFuchsTariffGroup();
    expect(screen.getByTestId('fee-staircase-zeitkat')).toBeTruthy();
    openFuchsTariffTable();
    expect(screen.getByLabelText('Betrag ZEITKAT 05')).toBeTruthy();
    expect(screen.getByLabelText('Betrag ZEITKAT 06')).toBeTruthy();
    expect(screen.queryByTestId('simulation-total-row')).toBeNull();
    expect(screen.queryByTestId('annual-contribution-impact')).toBeNull();
    expect(screen.queryByTestId('simulation-parent-cost-impact')).toBeNull();
    expect(screen.queryByTestId('reform-forecast-results')).toBeNull();
  });

  it('verwendet bei fixiertem Basisjahr dessen Kinder- und Buchungsstundenprofil für alle Ergebnisjahre', () => {
    render(
      <Provider store={createTestStore({ include2027BookingChange: true })}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const getHours = (year) => screen.getByTestId(`annual-booking-hours-${year}`).textContent.match(/[\d.,]+ h\/Tag/)?.[0];
    const hours2026 = getHours(2026);
    const hours2027 = getHours(2027);
    expect(hours2026).not.toBe(hours2027);

    openSimulationSettings();
    fireEvent.click(screen.getByRole('switch', { name: 'Basisjahr für Betreuungsstunden fixieren' }));
    const baseYearSelect = screen.getByRole('combobox', { name: 'Fixiertes Basisjahr' });
    fireEvent.click(baseYearSelect);
    fireEvent.click(screen.getByRole('option', { name: '2027' }));

    expect(getHours(2026)).toBe(hours2027);
    expect(getHours(2027)).toBe(hours2027);
    expect(screen.getByTestId('fixed-base-year-toggle').checked).toBe(true);

    fireEvent.click(baseYearSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Keins' }));
    expect(screen.getByTestId('fixed-base-year-toggle').checked).toBe(false);
    expect(getHours(2026)).toBe(hours2026);
    expect(getHours(2027)).toBe(hours2027);
  });

  it('speichert und wechselt zwischen benannten Simulationsszenarien', async () => {
    render(
      <Provider store={createTestStore()}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 150);
    const subsidySwitch = screen.getByRole('switch', { name: 'Elternbeitragszuschuss aktiv' });
    fireEvent.click(subsidySwitch);
    fireEvent.click(screen.getByTestId('save-simulation-scenario'));
    const scenarioNameInput = await screen.findByTestId('simulation-scenario-name');
    fireEvent.change(scenarioNameInput, { target: { value: 'Härtefall-Simulation' } });
    expect(scenarioNameInput.value).toBe('Härtefall-Simulation');
    const saveScenarioButton = await screen.findByTestId('confirm-save-simulation-scenario');
    expect(saveScenarioButton.disabled).toBe(false);
    fireEvent.click(saveScenarioButton);

    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 €');
    setFeeAmount('Betrag ZEITKAT 05', 200);
    fireEvent.click(subsidySwitch);
    const scenarioSelect = screen.getByRole('combobox', { name: 'Szenario' });
    fireEvent.click(scenarioSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Standard-Tarif 2026' }));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('100 €');
    fireEvent.click(scenarioSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Härtefall-Simulation' }));

    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 €');
    expect(screen.getByRole('switch', { name: 'Elternbeitragszuschuss aktiv' }).checked).toBe(false);
    fireEvent.click(screen.getByTestId('clone-simulation-scenario'));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 €');
    fireEvent.click(screen.getByTestId('new-simulation-scenario'));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('100 €');
    expect(screen.getByRole('switch', { name: 'Elternbeitragszuschuss aktiv' }).checked).toBe(true);
  });

  it('filtert die Simulation nach ausgewählten Gruppen', () => {
    render(
      <Provider store={createTestStore()}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 150);
    const comparisonBeforeFilter = screen.getByTestId('annual-income-row-2026').textContent;
    const familyBeforeFilter = screen.getByTestId('affected-family-surname:reuter').textContent;
    const groupFilter = screen.getByRole('combobox', { name: 'Gruppen für Tarif-Einstellungen' });
    fireEvent.click(groupFilter);
    fireEvent.click(screen.getByRole('option', { name: 'Ohne Gruppe' }));

    expect(screen.getByTestId('simulation-group-filter')).toBeTruthy();
    expect(screen.getByTestId('annual-income-row-2026').textContent).toBe(comparisonBeforeFilter);
    expect(screen.getByTestId('affected-family-surname:reuter').textContent).toBe(familyBeforeFilter);

    expect(screen.queryByTestId('simulation-tariff-groups')).toBeNull();
    expect(screen.queryByTestId('simulation-group-results')).toBeNull();
  });

  it('ignoriert deaktivierte ZEITKAT-Kategorien in der lokalen Simulation', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openFuchsTariffGroup();
    fireEvent.click(screen.getByRole('switch', { name: 'Elternbeitragszuschuss aktiv' }));
    const contributionsBefore = screen.getByTestId('annual-contributions-2026').textContent;
    fireEvent.click(screen.getByLabelText('Deaktiviere Beitrag ZEITKAT 05'));

    expect(screen.getByLabelText('Betrag ZEITKAT 05').disabled).toBe(true);
    expect(screen.getByTestId('annual-contributions-2026').textContent).not.toBe(contributionsBefore);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1[0].enabled).toBeUndefined();
  });

  it('speichert jahresspezifische Zusatzförderungen direkt aus der Ergebnistabelle', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    expect(screen.queryByTestId('parent-fee-subsidy-end-date')).toBeNull();
    expect(screen.queryByTestId('reform-forecast-settings')).toBeNull();
    expect(screen.queryByTestId('annual-funding-input-2026-under3Federal')).toBeNull();
    expect(screen.getByTestId('annual-funding-input-total-2026').textContent).toContain('0,00 €');
    fireEvent.click(screen.getByRole('button', { name: 'Zusatzförderungsspalten einblenden' }));
    const under3FederalInput = screen.getByTestId('annual-funding-input-2026-under3Federal');
    expect(under3FederalInput).toBeTruthy();
    fireEvent.change(under3FederalInput, { target: { value: '9000' } });
    fireEvent.blur(under3FederalInput);

    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.reformForecast.annualFundingInputsByYear['2026'].under3Federal).toBe(9000);
    expect(screen.getByTestId('annual-funding-input-2026-assistance')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zusatzförderungsspalten ausblenden' }));
    expect(screen.getByTestId('annual-funding-input-total-2026').textContent).toContain('9.000,00 €');
  });

  it('übernimmt die U3-Kind-Monate und FUNTER3-Monatswerte als ADEBIS-Korrektur', async () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    fireEvent.click(screen.getByTestId('annual-income-details-2026'));
    const childCount = await screen.findByTestId('adebis-under3-children-2026-1');
    fireEvent.change(childCount, { target: { value: '94' } });
    const supplement = screen.getByTestId('adebis-under3-amount-2026-1');
    fireEvent.change(supplement, { target: { value: '3675.12' } });

    const adebisSettings = store.getState().simFinance.financeByScenario['scenario-1'].settings.adebisAnalysis;
    expect(adebisSettings.under3ChildrenByMonth['2026-01']).toBe(94);
    expect(adebisSettings.under3AdditionalByMonth['2026-01']).toBe(3675.12);
  });

  it('rechnet den Teamzuschuss in dieselbe Jahres-Ergebnistabelle ein', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const before = getEuroAmount(screen.getByTestId('annual-funding-2027'));
    openSimulationSettings();
    expect(screen.getByTestId('reform-simulation-settings')).toBeTruthy();
    fireEvent.change(screen.getByTestId('reform-approved-places'), { target: { value: '51' } });
    fireEvent.click(screen.getByTestId('reform-team-grant-eligible'));

    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.reformForecast.approvedPlaces).toBe(51);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.reformForecast.teamGrantEligible).toBe(true);
    expect(getEuroAmount(screen.getByTestId('annual-funding-2027'))).toBeCloseTo(before + 25167.61, 2);
    expect(screen.queryByTestId('reform-forecast-results')).toBeNull();
  });

  it('verwendet 2026-Istwerte im fixierten Basisjahr als Reform-Basis der Jahresergebnisse', async () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const before = getEuroAmount(screen.getByTestId('annual-funding-2026'));
    openSimulationSettings();
    fireEvent.change(screen.getByTestId('reform-actual-bookingTime'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('fixed-base-year-toggle'));

    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.reformForecast.actualFunding.bookingTime).toBe(0);
    expect(getEuroAmount(screen.getByTestId('annual-funding-2026'))).toBeLessThan(before);
    fireEvent.click(screen.getByTestId('annual-income-details-2026'));
    expect(await screen.findByTestId('reform-projection-funding')).toBeTruthy();
  });

  it('ändert Beitragssätze nur lokal, zeigt Jahres-Familien-Drilldown und lässt Optionen unverändert', async () => {
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

    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 €');
    expect(screen.queryByText(/Konfigurierter Zuschuss/)).toBeNull();
    expect(screen.queryByTestId('simulation-parent-cost-impact')).toBeNull();
    expect(screen.queryByTestId('simulation-group-results')).toBeNull();
    const familyRow = screen.getByTestId('affected-family-surname:reuter');
    expect(familyRow.textContent).toContain('100,00 €');
    expect(familyRow.textContent).toContain('+100,00 €');
    expect(familyRow.querySelectorAll('td')[3].textContent).toBe('–');
    expect(familyRow.textContent).toContain('+8,0 h/Woche');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('1.200,00 €');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('3.617,60 €');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('0,00 € zur Zuschussregel');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('+1.200,00 € zur Beitragsordnung');
    fireEvent.click(screen.getByTestId('annual-family-impact-toggle-2028'));
    expect(await screen.findByTestId('annual-family-impact-table-2028')).toBeTruthy();
    expect(screen.getByTestId('annual-family-impact-2028-surname:reuter').textContent).toContain('Familie Reuter');
    expect(screen.getByTestId('annual-family-impact-2028-surname:reuter').textContent).toContain('+100,00 €');
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1[0].monthlyAmount).toBe(100);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1[1].monthlyAmount).toBe(150);
  });

  it('leitet Familiennamen aus dem Nachnamen ab und nummeriert anonymisierte Familien', () => {
    const store = createTestStore();
    ['child-1', 'child-2'].forEach((itemId) => {
      store.dispatch({
        type: 'simData/updateDataItemFields',
        payload: {
          scenarioId: 'scenario-1',
          itemId,
          fields: {
            familyId: `fam-${itemId}`,
            familyLabel: 'Familie (erzber)',
            rawdata: { NAME: 'Beringer' },
          },
        },
      });
    });

    const view = render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );
    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 150);
    expect(within(screen.getByTestId('affected-family-surname:beringer')).getByText('Familie Beringer')).toBeTruthy();

    view.unmount();
    store.dispatch(updateScenario({ scenarioId: 'scenario-1', updates: { importedAnonymized: true } }));
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );
    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 150);
    expect(within(screen.getByTestId('affected-family-fam-child-1')).getByText('Familie 1')).toBeTruthy();
    expect(within(screen.getByTestId('affected-family-fam-child-2')).getByText('Familie 2')).toBeTruthy();
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
    expect(screen.getByTestId('fee-staircase-slider-10')).toBeTruthy();
    expect(screen.getByTestId('fee-staircase-slider-13')).toBeTruthy();
  });

  it('verwendet den Elternbeitragszuschuss je Beitragsordnung statt globaler Simulationsoption', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    expect(screen.queryByTestId('parent-fee-subsidy-control')).toBeNull();
    act(() => store.dispatch(updateGroupParentFeeSubsidy({
      scenarioId: 'scenario-1',
      groupId: 'g1',
      updates: { monthlyAmount: 75, endDate: '2026-02-28' },
    })));
    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup.g1).toMatchObject({
      monthlyAmount: 75,
      endDate: '2026-02-28',
      enabled: true,
    });
    expect(screen.getByTestId('simulation-parent-fee-subsidy-amount-g1').textContent).toContain('75,00 €');
    const fundingBeforeToggle = getEuroAmount(screen.getByTestId('annual-funding-2026'));
    const contributionsBeforeToggle = getEuroAmount(screen.getByTestId('annual-contributions-2026'));
    const simulationSubsidySwitch = screen.getByRole('switch', { name: 'Elternbeitragszuschuss aktiv' });
    expect(simulationSubsidySwitch.checked).toBe(true);
    fireEvent.click(simulationSubsidySwitch);
    expect(simulationSubsidySwitch.checked).toBe(false);
    expect(getEuroAmount(screen.getByTestId('annual-funding-2026'))).toBeLessThan(fundingBeforeToggle);
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBeGreaterThan(contributionsBeforeToggle);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].parentFeeSubsidiesByGroup.g1.enabled).toBe(true);
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
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('175 €');
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe zurücksetzen' }));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('100 €');
  });
});
