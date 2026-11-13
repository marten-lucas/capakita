import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import FundingSimulationPanel from './FundingSimulationPanel';
import { buildAnnualFamilyImpactPdfGroups, buildSavedScenarioComparisonRows, buildSavedScenarioFinancialComparisonRows, buildSimulationFeePdfRows, buildSimulationPdfComparison, invalidReformInputs, qualifySavedScenarioRows, resolveManualFundingInputs, summarizeSimulationDiagnostics } from './simulationPdfUtils';
import { getFeeBandSimulationPriceKey, getFeeBandSimulationPriceOverride } from '../../utils/foerderSimulation';
import { applyTariffOverlay } from '../../utils/simulationTariffOverlay';
import { calculateReformForecast } from '../../utils/reformSimulation';
import simScenarioReducer, { updateScenario } from '../../store/simScenarioSlice';
import simDataReducer, { addDataItem, updateDataItem } from '../../store/simDataSlice';
import simBookingReducer, { addBooking, deleteBooking, updateBooking } from '../../store/simBookingSlice';
import simGroupReducer, { importGroupAssignments } from '../../store/simGroupSlice';
import simQualificationReducer from '../../store/simQualificationSlice';
import simOverlayReducer from '../../store/simOverlaySlice';
import simFinanceReducer, {
  setGroupFeeCatalogs,
  addBayKiBiGRule,
  updateFundingSimulationSettings,
  updateBayKiBiGRule,
  updateGroupParentFeeSubsidy,
  updateScenarioFinanceSettings,
} from '../../store/simFinanceSlice';
import chartReducer, { setFilterGroups, setReferenceDate } from '../../store/chartSlice';

vi.mock('@mantine/charts', () => ({ BarChart: () => null }));

const REF = '2026-03-15';
const ZERO_MANUAL_FUNDING = { under3Federal: 0, personnelBonus: 0, assistance: 0, languageSpecialists: 0 };
const explicitAnnualFunding = Object.fromEntries([2026, 2027, 2028, 2029, 2030].map((year) => [year, { ...ZERO_MANUAL_FUNDING }]));

function setExplicitManualFunding(store) {
  store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { annualFundingInputsByYear: explicitAnnualFunding } } }));
}

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

function createTestStore({ include2027BookingChange = false, forecastGroupType, forecastReferenceDate, forecastEvents, forecastEventState } = {}) {
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
      events: (state = { eventsByScenario: {}, _needsRefresh: false }) => state,
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
        groupDefsByScenario: { 'scenario-1': [{ id: 'g1', name: 'Fuchs', ...(forecastGroupType ? { type: forecastGroupType } : {}) }] },
        groupsByScenario: { 'scenario-1': {} },
      },
      simFinance: {
        financeByScenario: {
          'scenario-1': {
            settings: { partialAbsenceThresholdDays: 42, partialAbsenceEmployerSharePercent: 0, reformForecast: { annualFundingInputsByYear: explicitAnnualFunding } },
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
      events: forecastEventState || { eventsByScenario: forecastEvents ? { 'scenario-1': forecastEvents } : {}, _needsRefresh: false },
      chart: {
        ...(forecastReferenceDate ? { 'scenario-1': { referenceDate: forecastReferenceDate, filter: { Groups: [], Qualifications: [] } } } : {}),
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

describe('FundingSimulationPanel PDF export data', () => {
  it('keeps original and simulated tariff values together for the slider chart', () => {
    const rows = buildSimulationFeePdfRows({
      tariffGroups: [{ id: 'g1', name: 'Fuchsgruppe' }],
      groupFeeCatalogs: {
        g1: [{ id: 'fee-04', zeitkatId: '04', monthlyAmount: 150, validFrom: '2026-01-01' }],
      },
      effectiveFeeCatalogs: {
        g1: [{ id: 'fee-04', zeitkatId: '04', monthlyAmount: 180, validFrom: '2026-01-01' }],
      },
      parentFeeSubsidiesByGroup: { g1: { enabled: true, monthlyAmount: 100, endDate: '2026-12-31' } },
      referenceDate: '2026-03-01',
    });
    const changedFee = rows.find((row) => row.category.startsWith('ZEITKAT 04'));

    expect(changedFee).toMatchObject({
      groupName: 'Fuchsgruppe',
      baselineAmount: 150,
      simulatedAmount: 180,
      delta: 30,
      baselineActive: true,
      simulatedActive: true,
    });
    expect(rows).toHaveLength(1);
  });

  it('kennzeichnet einen fehlenden Vergleichstarif statt ihn als 0 auszugeben', () => {
    const rows = buildSimulationFeePdfRows({
      tariffGroups: [{ id: 'g1', name: 'Fuchs' }],
      effectiveFeeCatalogs: { g1: [{ id: 'fee', zeitkatId: '05', monthlyAmount: 180 }] },
      referenceDate: REF,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ baselineAmount: null, simulatedAmount: 180, delta: null });
  });

  it('akzeptiert einen ausdrücklich konfigurierten Nulltarif im PDF', () => {
    const rows = buildSimulationFeePdfRows({
      tariffGroups: [{ id: 'g1', name: 'Fuchs' }],
      groupFeeCatalogs: { g1: [{ id: 'fee', zeitkatId: '05', monthlyAmount: 0 }] },
      effectiveFeeCatalogs: { g1: [{ id: 'fee', zeitkatId: '05', monthlyAmount: 10 }] },
      referenceDate: REF,
    });
    expect(rows[0]).toMatchObject({ baselineAmount: 0, simulatedAmount: 10, delta: 10 });
  });

  it('vergleicht nur vollständige Jahreswerte und unterscheidet fehlend von null', () => {
    expect(buildSavedScenarioComparisonRows(
      [{ year: 2026, contributions: 0, feeCalculationComplete: true }, { year: 2027, contributions: 500, feeCalculationComplete: false, missingTariffChildMonths: 2 }],
      [{ year: 2026, contributions: 100, feeCalculationComplete: true }, { year: 2027, contributions: 700, feeCalculationComplete: true }]
    )).toEqual([
      { year: 2026, left: 0, right: 100, delta: 100, leftMissing: null, rightMissing: null },
      { year: 2027, left: null, right: 700, delta: null, leftMissing: 2, rightMissing: null },
    ]);
  });

  it('prüft alle für die fixierte Reform verwendeten Istwerte und behält ungültige Jahresangaben bei Vorrang', () => {
    const fields = ['bookingTime', 'qualityBonus', 'preparatoryCourses', 'under3Additional', 'under3Federal', 'assistance', 'personnelBonus', 'languageSpecialists'];
    const valid = Object.fromEntries(fields.map((field) => [field, 0]));
    expect(invalidReformInputs(valid, { approvedPlaces: 0 }, true, true)).toEqual([]);
    expect(invalidReformInputs(valid, { teamGrantEligible: 'ja' }, false, false)).toContain('Anspruch auf Teamzuschuss');
    fields.forEach((field) => {
      expect(invalidReformInputs({ ...valid, [field]: '' }, {}, true, false)).toContain(`2026-Ist ${field}`);
    });
    const annual = resolveManualFundingInputs(2026, { actualFunding: valid, annualFundingInputsByYear: { 2026: { assistance: null } } });
    expect(annual.missing).toContain('Assistenz (2026)');
    expect(annual.values.assistance).toBeNull();
    expect(resolveManualFundingInputs(2026, { actualFunding: valid }).missing).toEqual([]);
  });

  it('sperrt fehlende und ungültige manuelle Förderwerte sowie geschätzten Zulauf, aber akzeptiert explizite Null', () => {
    const complete = { year: 2026, yearComplete: true, totalFunding: 200, annualParentFeeSubsidy: 100, contributions: 0, totalIncome: 200 };
    const options = { fixedBaseYearEnabled: false, stockMode: 'known', forecastInflowEnabled: false };
    const settings = { annualFundingInputsByYear: { 2026: ZERO_MANUAL_FUNDING } };
    const qualify = (opts, config) => qualifySavedScenarioRows([complete], opts, config);
    expect(qualify(options, settings)[0].yearComplete).toBe(true);
    for (const invalid of [undefined, '', -1, 'NaN', false]) {
      const incomplete = qualify(options, { annualFundingInputsByYear: { 2026: { ...ZERO_MANUAL_FUNDING, assistance: invalid } } });
      const result = buildSavedScenarioFinancialComparisonRows(qualify(options, settings), incomplete)[0];
      expect(result.values.totalIncome.scenario).toBeNull();
      expect(result.values.totalIncome.delta).toBeNull();
      expect(result.rightReasons.join(' ')).toContain('Assistenz (2026)');
    }
    const projected = qualify({ ...options, stockMode: 'projected', forecastInflowEnabled: true }, settings);
    expect(buildSavedScenarioFinancialComparisonRows(qualify(options, settings), projected)[0].rightReasons.join(' ')).toContain('Geschätzter Zulauf');
    expect(qualify({ ...options, fixedBaseYearEnabled: true, fixedBaseYear: 2026, stockMode: 'projected', forecastInflowEnabled: true }, settings)[0].yearComplete).toBe(true);
    const reform = qualifySavedScenarioRows([{ ...complete, year: 2027, reformGrantApplied: true, invalidReformInputs: ['genehmigte Plätze'] }], options, { annualFundingInputsByYear: { 2027: ZERO_MANUAL_FUNDING } });
    expect(reform[0].yearComplete).toBe(false);
  });

  it('vergleicht vollständige Finanzwerte einschließlich Null und unterdrückt fehlende Werte', () => {
    const complete = { year: 2026, yearComplete: true, totalFunding: 200, annualParentFeeSubsidy: 100, contributions: 0, totalIncome: 200 };
    const comparison = buildSavedScenarioFinancialComparisonRows([complete], [{ ...complete, totalFunding: 250, annualParentFeeSubsidy: 125, contributions: 30, totalIncome: 280 }])[0];
    expect(comparison.values.contributions).toEqual({ baseline: 0, scenario: 30, delta: 30 });
    expect(comparison.values.annualParentFeeSubsidy.delta).toBe(25);
    expect(comparison.values.totalIncome.delta).toBe(80);
    const incomplete = buildSavedScenarioFinancialComparisonRows([complete], [{ ...complete, contributions: null }])[0];
    expect(incomplete.rightComplete).toBe(false);
    expect(incomplete.values.totalFunding.scenario).toBeNull();
    expect(incomplete.rightReasons).toContain('Finanzwert fehlt oder ist ungültig');
    expect(buildSavedScenarioFinancialComparisonRows([complete], [{ ...complete, yearComplete: false, forecastComplete: false }])[0].values.totalIncome.delta).toBeNull();
    const legacy = buildSimulationPdfComparison({ baseline: { annualIncomeRows: [complete] }, scenario: { annualIncomeRows: [{ ...complete, yearComplete: false }] } });
    expect(legacy.years[0].values.totalIncome).toEqual({ baseline: 200, scenario: null, delta: null });
  });

  it('betrachtet partielle aktive Kohorten und fehlende Stundendiagnosen nicht als vollständig', () => {
    expect(summarizeSimulationDiagnostics({ feeCalculationComplete: true, activeChildrenCoverage: 'partial', missingTariffs: [], childrenWithoutBookingHours: [] }))
      .toMatchObject({ feeCalculationComplete: true, activeChildrenComplete: false, bookingHoursComplete: true });
    expect(summarizeSimulationDiagnostics({ feeCalculationComplete: true, activeChildrenCoverage: 'caller-provided', missingTariffs: [] }))
      .toMatchObject({ activeChildrenComplete: true, bookingHoursComplete: false });
    expect(summarizeSimulationDiagnostics(null)).toMatchObject({ feeCalculationComplete: false, activeChildrenComplete: false, bookingHoursComplete: false });
  });

  it('uses the annual family drilldown to create PDF groups by year', () => {
    const groups = buildAnnualFamilyImpactPdfGroups([
      { year: 2026, familyImpacts: [] },
      { year: 2027, familyImpacts: [{
        id: 'family-1',
        label: 'Familie 1',
        averageMonthlyParentFeesBefore: 200,
        averageMonthlyParentFeesAfter: 300,
        averageMonthlyDelta: 0,
        averageMonthlyYearOverYearDelta: 100,
        yearOverYearAnnualDelta: 1200,
      }] },
    ]);

    expect(groups).toEqual([{
      year: 2027,
      families: [{
        label: 'Familie 1',
        averageMonthlyParentFeesBefore: 200,
        averageMonthlyParentFeesAfter: 300,
        averageMonthlyDelta: 0,
        averageMonthlyYearOverYearDelta: 100,
        yearOverYearAnnualDelta: 1200,
      }],
    }]);
  });
});

describe('FundingSimulationPanel', () => {
  it('uses only the selected scenario’s forecast event status', () => {
    const eventState = {
      eventsByScenario: { 'scenario-1': [], other: [] },
      statusByScenario: { 'scenario-1': { state: 'ready' }, other: { state: 'incomplete', error: 'Overlay-Konflikt' } },
      _needsRefresh: true,
    };
    const readyStore = createTestStore({ forecastEventState: eventState });
    readyStore.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'projected' } }));
    const ready = render(<Provider store={readyStore}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    openSimulationSettings();
    expect(screen.getByTestId('forecast-configuration-notice')).not.toHaveTextContent('Forecast-Ereignisse sind nicht verfügbar');
    ready.unmount();

    const incompleteStore = createTestStore({ forecastEventState: {
      ...eventState,
      _needsRefresh: false,
      statusByScenario: { 'scenario-1': { state: 'incomplete', error: 'Overlay-Konflikt' }, other: { state: 'ready' } },
    } });
    incompleteStore.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'projected' } }));
    render(<Provider store={incompleteStore}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    openSimulationSettings();
    expect(screen.getByTestId('forecast-configuration-notice')).toHaveTextContent('Forecast-Ereignisse sind nicht verfügbar');
  });
  it('updates the family contribution histogram when a simulated tariff changes', () => {
    render(
      <Provider store={createTestStore()}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    const histogram = screen.getByTestId('family-impact-histogram-chart');
    const beforeTariffChange = histogram.getAttribute('data-histogram-summary');
    const year = beforeTariffChange.split(';')[0].split(':')[0];
    const beforeStatistics = screen.getByTestId(`family-impact-histogram-average-${year}`).textContent;
    expect(screen.getByTestId(`family-impact-histogram-median-${year}`).textContent).toContain('Median:');
    openFuchsTariffTable();
    setFeeAmount('Betrag ZEITKAT 05', 150);

    expect(screen.queryByTestId('family-impact-histogram-empty')).toBeNull();
    expect(screen.getByTestId('family-impact-histogram-chart').getAttribute('data-histogram-summary'))
      .not.toBe(beforeTariffChange);
    expect(screen.getByTestId(`family-impact-histogram-average-${year}`).textContent).not.toBe(beforeStatistics);
    fireEvent.click(screen.getByRole('radio', { name: 'Simulation' }));
    expect(screen.getByTestId('family-impact-histogram-chart')).toBeTruthy();
  });

  it('zeigt vor dem HTML-Download eine Datenschutzvorschau', async () => {
    render(
      <Provider store={createTestStore()}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    fireEvent.click(screen.getByTestId('export-simulation-html'));
    expect(screen.getByTestId('html-export-preview')).toBeTruthy();
    expect(await screen.findByText(/keine Namen, Familien- oder Kind-IDs/)).toBeTruthy();
    expect(screen.getByTestId('confirm-export-simulation-html')).toBeTruthy();
    expect(screen.getByText(/Die HTML-Simulation setzt den konfigurierten Zuschuss/)).toBeTruthy();
  });

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
    expect(within(screen.getByTestId('simulation-settings-panel')).getByTestId('family-potential-budget')).toBeTruthy();
    fireEvent.click(within(resultsPanel).getByTestId('annual-income-details-2026'));
    const adebisTotal = await screen.findByTestId('adebis-monthly-total');
    expect(adebisTotal.textContent).toContain('17,60 €');
    expect(screen.getByTestId('adebis-total-funding-row')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Familienbaum' }));
    expect(await screen.findByTestId('family-tree-total')).toBeTruthy();
    expect(screen.getByTestId('family-tree-family-fam-1')).toBeTruthy();
    const firstChildRow = screen.getByTestId('family-tree-child-child-1');
    expect(firstChildRow.textContent).toContain('Fuchs');
    expect(firstChildRow.textContent).toContain('ZEITKAT 05 (>4-5h)');
    expect(firstChildRow.textContent).toContain('01.01.2026 – unbegrenzt');
    const groupToggle = screen.getByRole('switch', { name: 'Kinder nach Familie gruppieren' });
    expect(groupToggle.checked).toBe(true);
    fireEvent.click(groupToggle);
    expect(screen.queryByTestId('family-tree-family-fam-1')).toBeNull();
    expect(screen.getByTestId('family-tree-child-child-1')).toBeTruthy();
    expect(within(resultsPanel).queryByText('Von Beitragsänderungen betroffene Familien · Stichtag')).toBeNull();
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

  it('verwendet und speichert bei fixiertem Basisjahr dessen Kinder- und Buchungsstundenprofil', () => {
    const store = createTestStore({ include2027BookingChange: true });
    render(
      <Provider store={store}>
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
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation)
      .toMatchObject({ fixedBaseYearEnabled: true, fixedBaseYear: 2027 });

    fireEvent.click(baseYearSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Keins' }));
    expect(screen.getByTestId('fixed-base-year-toggle').checked).toBe(false);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation)
      .toMatchObject({ fixedBaseYearEnabled: false, fixedBaseYear: 2026 });
    expect(getHours(2026)).toBe(hours2026);
    expect(getHours(2027)).toBe(hours2027);
  });

  it('speichert und wechselt zwischen benannten Simulationsszenarien im Workspace', async () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const store = createTestStore();
    const view = render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 150);
    fireEvent.click(screen.getByTestId('save-simulation-scenario'));
    const scenarioNameInput = await screen.findByTestId('simulation-scenario-name');
    fireEvent.change(scenarioNameInput, { target: { value: 'Härtefall-Simulation' } });
    expect(scenarioNameInput.value).toBe('Härtefall-Simulation');
    const saveScenarioButton = await screen.findByTestId('confirm-save-simulation-scenario');
    expect(saveScenarioButton.disabled).toBe(false);
    fireEvent.click(saveScenarioButton);

    const persistedOptions = store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation;
    expect(persistedOptions.selectedSimulationScenarioId).toBeTruthy();
    expect(persistedOptions.simulationScenarios.some((scenario) => scenario.name === 'Härtefall-Simulation')).toBe(true);
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 €');
    setFeeAmount('Betrag ZEITKAT 05', 200);
    const scenarioSelect = screen.getByRole('combobox', { name: 'Szenario' });
    fireEvent.click(scenarioSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Standard-Tarif 2026' }));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('200 €');
    expect(screen.getByTestId('simulation-scenario-save-status').textContent).toContain('noch nicht als Szenario gesichert');
    fireEvent.click(await screen.findByTestId('discard-scenario-changes'));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('100 €');
    view.unmount();
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    openFuchsTariffGroup();
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario' }));
    fireEvent.click(screen.getByRole('option', { name: 'Härtefall-Simulation' }));

    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 €');
    fireEvent.click(screen.getByTestId('clone-simulation-scenario'));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('150 €');
    fireEvent.click(screen.getByTestId('new-simulation-scenario'));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('100 €');
  });

  it('filtert die Simulation nach ausgewählten Gruppen und speichert den Filter im Workspace', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 150);
    const comparisonBeforeFilter = screen.getByTestId('annual-income-row-2026').textContent;
    fireEvent.click(screen.getByTestId('annual-family-impact-toggle-2026'));
    const familyBeforeFilter = screen.getByTestId('annual-family-impact-2026-fam-1').textContent;
    const groupFilter = screen.getByRole('combobox', { name: 'Gruppen für Tarif-Einstellungen' });
    fireEvent.click(groupFilter);
    fireEvent.click(screen.getByRole('option', { name: 'Ohne Gruppe' }));

    expect(screen.getByTestId('simulation-group-filter')).toBeTruthy();
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.selectedGroupIds)
      .toEqual(['__NO_GROUP__']);
    expect(screen.getByTestId('annual-income-row-2026').textContent).toBe(comparisonBeforeFilter);
    expect(screen.getByTestId('annual-family-impact-2026-fam-1').textContent).toBe(familyBeforeFilter);

    expect(screen.queryByTestId('simulation-tariff-groups')).toBeNull();
    expect(screen.queryByTestId('simulation-group-results')).toBeNull();
  });

  it('speichert das Familienbudget im gemeinsamen Workspace', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openSimulationSettings();
    const settingsPanel = screen.getByTestId('simulation-settings-panel');
    const budgetInput = within(settingsPanel).getByLabelText('Budgetänderung pro Familie / Monat');
    fireEvent.change(budgetInput, { target: { value: '25' } });
    fireEvent.blur(budgetInput);

    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.potentialMonthlyBudget)
      .toBe(25);
    expect(within(settingsPanel).getByTestId('family-potential-budget')).toBeTruthy();
    expect(screen.queryByTestId('family-potential-budget-control')).toBeNull();
  });

  it('kennzeichnet deaktivierte benötigte ZEITKAT-Tarife als unvollständig', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openFuchsTariffGroup();
    fireEvent.click(screen.getByLabelText('Deaktiviere Beitrag ZEITKAT 05'));

    expect(screen.getByLabelText('Betrag ZEITKAT 05').disabled).toBe(true);
    expect(screen.getByTestId('simulation-missing-tariffs').textContent).toContain('2026: 24 Kind-Monate');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('unvollständig');
    expect(store.getState().simFinance.financeByScenario['scenario-1'].groupFeeCatalogs.g1[0].enabled).toBeUndefined();
  });

  it('fixiert die jährlichen Zusatzförderungen auf das ausgewählte Basisjahr', () => {
    const store = createTestStore({ include2027BookingChange: true });
    store.dispatch(updateScenarioFinanceSettings({
      scenarioId: 'scenario-1',
      updates: {
        reformForecast: {
          annualFundingInputsByYear: {
            2026: { under3Federal: 1000, personnelBonus: 200, assistance: 300, languageSpecialists: 400 },
            2027: { under3Federal: 9000, personnelBonus: 1000, assistance: 2000, languageSpecialists: 3000 },
          },
        },
      },
    }));
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openSimulationSettings();
    fireEvent.click(screen.getByTestId('fixed-base-year-toggle'));
    const baseYearSelect = screen.getByRole('combobox', { name: 'Fixiertes Basisjahr' });
    fireEvent.click(baseYearSelect);
    fireEvent.click(screen.getByRole('option', { name: '2027' }));

    expect(screen.getByTestId('annual-funding-input-total-2026').textContent).toContain('15.000,00 €');
    expect(screen.getByTestId('annual-funding-input-total-2027').textContent).toContain('15.000,00 €');

    fireEvent.click(screen.getByRole('button', { name: 'Zusatzförderungsspalten einblenden' }));
    expect(screen.getByLabelText('U3-Bundesmittel 2026').disabled).toBe(true);
    const fixedYearInput = screen.getByLabelText('U3-Bundesmittel 2027');
    expect(fixedYearInput.disabled).toBe(false);
    fireEvent.change(fixedYearInput, { target: { value: '2500' } });
    fireEvent.blur(fixedYearInput);

    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.reformForecast.annualFundingInputsByYear['2027'].under3Federal)
      .toBe(2500);
    expect(screen.getByLabelText('U3-Bundesmittel 2026').value)
      .toBe(screen.getByLabelText('U3-Bundesmittel 2027').value);
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

  it('isoliert Tarifversionen im Panel, Szenario und PDF-Daten', async () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const store = createTestStore();
    setExplicitManualFunding(store);
    const fees = [
      { id: 'fee-2026', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-12-31' },
      { id: 'fee-2027', zeitkatId: '05', monthlyAmount: 200, validFrom: '2027-01-01' },
    ];
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: fees } }));
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.queryByTestId('active-catalog-snapshot-warning')).toBeNull();
    expect(screen.queryByTestId('comparison-catalog-snapshot-warning')).toBeNull();
    openFuchsTariffGroup();
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(2400);
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2027'))).toBe(4800);
    setFeeAmount('Betrag ZEITKAT 05', 150);
    expect(screen.queryByTestId('active-catalog-snapshot-warning')).toBeNull();
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(3600);
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2027'))).toBe(4800);
    fireEvent.click(screen.getByRole('combobox', { name: 'Gültigkeitsversion' }));
    fireEvent.click(screen.getByRole('option', { name: /2027-01-01/ }));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('200 €');
    fireEvent.click(screen.getByTestId('save-simulation-scenario'));
    fireEvent.change(await screen.findByTestId('simulation-scenario-name'), { target: { value: 'Versionstest' } });
    fireEvent.click(screen.getByTestId('confirm-save-simulation-scenario'));
    const settings = store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation;
    const data = settings.simulationScenarios.find((scenario) => scenario.name === 'Versionstest').data;
    expect(data.schemaVersion).toBe(2);
    expect(data.temporaryCatalogEntries).toEqual({});
    expect(data.tariffOverlay.groups.g1).toEqual([expect.objectContaining({ key: getFeeBandSimulationPriceKey(fees[0]), changes: expect.objectContaining({ monthlyAmount: 150 }) })]);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Standard-Tarif 2026' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Versionstest' }));
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('+1.200,00 €');
    expect(screen.getByTestId('saved-scenario-comparison-2027').textContent).toContain('4.800,00 €');
    expect(screen.getByTestId('saved-scenario-comparison-2027').textContent).not.toContain('+1.200,00 €');
    const effective = applyTariffOverlay({ g1: fees }, data.tariffOverlay).catalogs.g1;
    const pdfRows = (referenceDate) => buildSimulationFeePdfRows({
      tariffGroups: [{ id: 'g1', name: 'Fuchs' }], groupFeeCatalogs: { g1: fees }, effectiveFeeCatalogs: { g1: effective }, referenceDate,
    });
    expect(pdfRows('2026-03-15')[0]).toMatchObject({ baselineAmount: 100, simulatedAmount: 150 });
    expect(pdfRows('2027-03-15')[0]).toMatchObject({ baselineAmount: 200, simulatedAmount: 200 });
    const getSaved = () => store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.simulationScenarios.find((scenario) => scenario.name === 'Versionstest');
    const savedBefore = JSON.parse(JSON.stringify(getSaved()));
    act(() => store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: [
      { ...fees[0], monthlyAmount: 110 }, { ...fees[1], monthlyAmount: 275, validUntil: '2027-12-31' },
      { id: 'fee-2028', zeitkatId: '05', monthlyAmount: 300, validFrom: '2028-01-01' },
    ] } })));
    expect(getSaved()).toEqual(savedBefore);
    expect(screen.getByTestId('saved-scenario-comparison-2027').textContent.match(/6.600,00 €/g)).toHaveLength(2);
    expect(screen.getByTestId('saved-scenario-comparison-2028').textContent.match(/7.200,00 €/g)).toHaveLength(2);
    expect(screen.queryByTestId('comparison-catalog-snapshot-warning')).toBeNull();
    expect(screen.getByTestId('comparison-scenario-formats').textContent).toContain('B: Versionstest – Overlay-Format v2');
    const pdfText = [];
    const save = vi.fn();
    vi.doMock('jspdf', () => ({ jsPDF: class {
      internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
      setProperties() {} setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {}
      setFillColor() {} setLineWidth() {} rect() {} line() {} addPage() {} setPage() {}
      getNumberOfPages() { return 1; }
      splitTextToSize(text) { return String(text).split('\n'); }
      text(value) { pdfText.push(...(Array.isArray(value) ? value : [value])); }
      save = save;
    } }));
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(pdfText.join(' ')).not.toContain('Warnung – Tarif-Snapshot im aktiven Arbeitsstand');
    expect(pdfText.join(' ')).toContain('Overlay-Format v2');
    expect(pdfText.join(' ')).toContain('historische gemeinsame Daten sind nicht gesichert');
    expect(getSaved()).toEqual(savedBefore);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario' }));
    fireEvent.click(screen.getByRole('option', { name: 'Standard-Tarif 2026' }));
    expect(screen.queryByTestId('active-catalog-snapshot-warning')).toBeNull();
    expect(screen.queryByTestId('comparison-catalog-snapshot-warning')).toBeNull();
    expect(getSaved()).toEqual(savedBefore);
    pdfText.length = 0;
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(pdfText.join(' ')).not.toContain('Warnung – Tarif-Snapshot im aktiven Arbeitsstand');
    expect(pdfText.join(' ')).not.toContain('Warnung – Tarif-Snapshots im Szenariovergleich');
    expect(getSaved()).toEqual(savedBefore);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Datenschutz prüfen – PDF-Export' })).toBeNull());
    act(() => store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: [fees[1]] } })));
    expect(screen.getByTestId('saved-scenario-comparison').textContent).toContain('Tarif-Overlay ist nicht anwendbar');
    pdfText.length = 0;
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(pdfText.join(' ')).toContain('B: Versionstest (Overlay-Format v2)');
    expect(pdfText.join(' ')).toContain('Tarif-Overlay ist nicht anwendbar');
    act(() => store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { ...savedBefore.data, selectedSimulationScenarioId: savedBefore.id } })));
    expect(screen.getByTestId('tariff-overlay-conflict')).toBeTruthy();
    expect(screen.getByTestId('export-simulation-pdf').disabled).toBe(true);
    expect(screen.getByTestId('export-simulation-html').disabled).toBe(true);
    expect(screen.queryByTestId('annual-contributions-2026')).toBeNull();
    expect(getSaved()).toEqual(savedBefore);
    vi.doUnmock('jspdf');
  });

  it('warnt auch bei einer gespeicherten leeren Gruppenstaffel und nicht bei reinem Preisoverride', () => {
    const store = createTestStore();
    const data = { temporaryPrices: { g1: { '05': 150 } }, selectedGroupIds: [], fixedBaseYearEnabled: false, fixedBaseYear: 2026, potentialMonthlyBudget: 50 };
    const scenarios = [
      { id: 'a', name: 'Nur Preis', data: { ...data, temporaryCatalogEntries: {} } },
      { id: 'b', name: 'Leere Staffel', data: { ...data, temporaryCatalogEntries: { g1: [] } } },
    ];
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { simulationScenarios: scenarios, selectedSimulationScenarioId: 'a' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Nur Preis' }));
    expect(screen.queryByTestId('comparison-catalog-snapshot-warning')).toBeNull();
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Leere Staffel' }));
    expect(screen.getByTestId('comparison-catalog-snapshot-warning').textContent).toContain('B: Leere Staffel (Fuchs)');
    expect(screen.queryByTestId('active-catalog-snapshot-warning')).toBeNull();
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.simulationScenarios).toEqual(scenarios);
  });

  it('bewahrt alte Gruppen-Snapshots unverändert und kennzeichnet deren Tarifbasis im Vergleich', () => {
    const store = createTestStore();
    setExplicitManualFunding(store);
    const oldFee = { id: 'old', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' };
    const currentFee = { ...oldFee, monthlyAmount: 200 };
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: [currentFee] } }));
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    const scenarios = [
      { id: 'a', name: 'Aktuell', data: { temporaryCatalogEntries: {}, temporaryPrices: {} } },
      { id: 'b', name: 'Altbestand', data: { temporaryCatalogEntries: { g1: [oldFee] }, temporaryPrices: {} } },
    ];
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { simulationScenarios: scenarios, selectedSimulationScenarioId: 'a' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Aktuell' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Altbestand' }));
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('4.800,00 €');
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('2.400,00 €');
    expect(screen.getByTestId('comparison-catalog-snapshot-warning').textContent).toContain('B: Altbestand (Fuchs)');
    expect(screen.getByTestId('comparison-scenario-formats').textContent).toContain('B: Altbestand – Altformat');
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.simulationScenarios).toEqual(scenarios);
  });

  it('warnt vor alten Kategorien und bewahrt sie sowie nicht zuordenbare Overrides beim Bearbeiten', async () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const store = createTestStore();
    const fees = [
      { id: 'fee-2026', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-12-31' },
      { id: 'fee-2027', zeitkatId: '05', monthlyAmount: 200, validFrom: '2027-01-01' },
    ];
    const missingKey = getFeeBandSimulationPriceKey({ id: 'missing', zeitkatId: '05' });
    const otherPrices = { '05': 120, '04': 0, 'band:missing': 77, [missingKey]: 88 };
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: fees } }));
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { temporaryPrices: { g1: otherPrices } } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    const warning = screen.getByTestId('active-legacy-prices-warning');
    expect(warning.textContent).toContain('alle Tarifversionen');
    expect(warning.textContent).toContain('ZEITKAT 04');
    expect(warning.textContent).toContain('ZEITKAT 05');
    expect(warning.textContent).toContain('keine automatische Migration');
    openFuchsTariffGroup();
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('120 €');
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2027'))).toBe(2880);
    setFeeAmount('Betrag ZEITKAT 05', 150);
    const getPrices = () => store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.temporaryPrices.g1;
    expect(getPrices()).toEqual({ ...otherPrices, [getFeeBandSimulationPriceKey(fees[0])]: 150 });
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(3600);
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2027'))).toBe(2880);
    expect(screen.getByTestId('active-legacy-prices-warning')).toBeTruthy();
    setFeeAmount('Betrag ZEITKAT 05', 100);
    expect(getPrices()).toEqual({ ...otherPrices, [getFeeBandSimulationPriceKey(fees[0])]: 100 });
    expect(getFeeBandSimulationPriceOverride({ id: 'future', zeitkatId: '05' }, getPrices())).toBe(120);
    expect(getFeeBandSimulationPriceOverride({ id: 'future', zeitkatId: '04' }, getPrices())).toBe(0);
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(2400);
    fireEvent.click(screen.getByTestId('save-simulation-scenario'));
    fireEvent.change(await screen.findByTestId('simulation-scenario-name'), { target: { value: 'Alte Preise' } });
    fireEvent.click(screen.getByTestId('confirm-save-simulation-scenario'));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario' }));
    fireEvent.click(screen.getByRole('option', { name: 'Standard-Tarif 2026' }));
    expect(screen.queryByTestId('active-legacy-prices-warning')).toBeNull();
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario' }));
    fireEvent.click(screen.getByRole('option', { name: 'Alte Preise' }));
    expect(screen.getByTestId('active-legacy-prices-warning')).toBeTruthy();
    expect(getPrices()).toEqual({ ...otherPrices, [getFeeBandSimulationPriceKey(fees[0])]: 100 });
    fireEvent.click(screen.getByRole('combobox', { name: 'Gültigkeitsversion' }));
    fireEvent.click(screen.getByRole('option', { name: /2027-01-01/ }));
    expect(screen.getByLabelText('Betrag ZEITKAT 05').value).toBe('120 €');
    expect(screen.queryByTestId('active-catalog-snapshot-warning')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe zurücksetzen' }));
    expect(screen.queryByTestId('active-legacy-prices-warning')).toBeNull();
    expect(screen.queryByTestId('active-catalog-snapshot-warning')).toBeNull();
  });

  it('bewahrt vorhandene temporäre Katalogeinträge ohne Original beim Bearbeiten anderer Tarife', () => {
    const store = createTestStore();
    const original = { id: 'fee-2026', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' };
    const added = { id: 'added', zeitkatId: '06', monthlyAmount: 135, validFrom: '2026-01-01' };
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: [original] } }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: {
      temporaryCatalogEntries: { g1: [original, added] }, temporaryPrices: { g1: { '04': 42 } },
    } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    openFuchsTariffGroup();
    expect(screen.getByLabelText('Betrag ZEITKAT 06').value).toBe('135 €');
    setFeeAmount('Betrag ZEITKAT 05', 150);
    const settings = store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation;
    expect(settings.temporaryCatalogEntries.g1.find((entry) => entry.id === 'added').monthlyAmount).toBe(135);
    expect(settings.temporaryPrices.g1).toEqual({ '04': 42, [getFeeBandSimulationPriceKey(original)]: 150 });
    expect(screen.getByLabelText('Betrag ZEITKAT 06').value).toBe('135 €');
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
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('1.200,00 €');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('3.617,60 €');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('+1.200,00 € Simulation');
    fireEvent.click(screen.getByTestId('annual-family-impact-toggle-2028'));
    expect(await screen.findByTestId('annual-family-impact-table-2028')).toBeTruthy();
    expect(screen.getByTestId('annual-family-impact-2028-fam-1').textContent).toContain('Familie Reuter');
    expect(screen.getByTestId('annual-family-impact-2028-fam-1').textContent).toContain('+100,00 €');
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
    fireEvent.click(screen.getByTestId('annual-family-impact-toggle-2026'));
    expect(within(screen.getByTestId('annual-family-impact-2026-fam-child-1')).getByText('Familie Beringer')).toBeTruthy();
    expect(within(screen.getByTestId('annual-family-impact-2026-fam-child-2')).getByText('Familie Beringer')).toBeTruthy();

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
    fireEvent.click(screen.getByTestId('annual-family-impact-toggle-2026'));
    expect(within(screen.getByTestId('annual-family-impact-2026-fam-child-1')).getByText('Familie 1')).toBeTruthy();
    expect(within(screen.getByTestId('annual-family-impact-2026-fam-child-2')).getByText('Familie 2')).toBeTruthy();
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

  it('setzt den Elternanteil bei Zuschuss über dem Tarif nicht unter null', () => {
    const store = createTestStore();
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: true, monthlyAmount: 175 } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(0);
    expect(screen.getByText(/eine ungeprüfte Modellannahme/)).toBeTruthy();
    expect(screen.getByTestId('simulation-subsidy-exceeds-tariff').textContent).toContain('2026: 24 Kind-Monate');
    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 200);
    const simulationDeltas = screen.getByTestId('annual-income-row-2026').textContent.match(/\+600,00 € Simulation/g) || [];
    expect(simulationDeltas).toHaveLength(2);
  });

  it('übernimmt einen gültigen Nulltarif aus der Simulationsdiagnose', () => {
    const store = createTestStore();
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: [
      { id: 'fee-zone-05', zeitkatId: '05', monthlyAmount: 0, validFrom: '2026-01-01' },
      { id: 'fee-zone-06', zeitkatId: '06', monthlyAmount: 50, validFrom: '2026-01-01' },
    ] } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.queryByTestId('simulation-missing-tariffs')).toBeNull();
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(0);
    expect(screen.getByTestId('simulation-subsidy-exceeds-tariff')).toBeTruthy();
  });

  it('aggregiert indikative Potenziale aus den zwölf jeweiligen Monatsbeständen', () => {
    const store = createTestStore();
    store.dispatch({ type: 'simData/updateDataItemFields', payload: { scenarioId: 'scenario-1', itemId: 'child-1', fields: { familyId: 'fam-other' } } });
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    const hours = (year) => Number(screen.getByTestId(`annual-upgrade-potential-${year}`).textContent.match(/[\d,]+/)?.[0].replace(',', '.'));
    const fullYear = hours(2026);
    expect(fullYear).toBeGreaterThan(0);
    act(() => store.dispatch({ type: 'simData/updateDataItemFields', payload: { scenarioId: 'scenario-1', itemId: 'child-1', fields: { enddate: '2026-06-30' } } }));
    expect(hours(2026)).toBeCloseTo(fullYear * 0.75, 1);
    expect(hours(2027)).toBeCloseTo(fullYear * 0.5, 1);
    expect(screen.getByTestId('simulation-missing-potential-tariffs').textContent).toContain('Nachbartarife');
  });

  it('vergleicht zwei gespeicherte Szenarien und unterdrückt unvollständige Jahre im Panel und PDF', async () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const pdfText = [];
    const save = vi.fn();
    vi.doMock('jspdf', () => ({ jsPDF: class {
      internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
      setProperties() {} setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {}
      setFillColor() {} setLineWidth() {} rect() {} line() {} addPage() {} setPage() {}
      getNumberOfPages() { return 1; }
      splitTextToSize(text) { return String(text).split('\n'); }
      text(value) { pdfText.push(...(Array.isArray(value) ? value : [value])); }
      save = save;
    } }));
    const store = createTestStore({ include2027BookingChange: true });
    setExplicitManualFunding(store);
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    const data = { temporaryCatalogEntries: {}, selectedGroupIds: [], fixedBaseYearEnabled: false, fixedBaseYear: 2026, potentialMonthlyBudget: 50 };
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: {
      simulationScenarios: [
        { id: 'a', name: 'Vergleich A', data: { ...data, temporaryPrices: {} } },
        { id: 'b', name: 'Vergleich B', data: { ...data, fixedBaseYearEnabled: true, temporaryPrices: { g1: { '05': 150 } } } },
      ], selectedSimulationScenarioId: 'a',
    } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Vergleich A' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Vergleich B' }));
    expect(screen.queryByTestId('active-legacy-prices-warning')).toBeNull();
    expect(screen.getByTestId('comparison-legacy-prices-warning').textContent).toContain('B: Vergleich B');
    expect(screen.getByTestId('comparison-legacy-prices-warning').textContent).toContain('ZEITKAT 05');
    const row = screen.getByTestId('saved-scenario-comparison-2026').textContent;
    expect(row).toContain('2.400,00 €');
    expect(row).toContain('3.600,00 €');
    expect(row).toContain('+1.200,00 €');
    expect(screen.getByTestId('saved-scenario-comparison-2027').textContent).toContain('Nicht verfügbar');
    expect(screen.getByTestId('saved-scenario-comparison-2027').textContent).toContain('3.600,00 €');
    expect(screen.getByTestId('saved-scenario-comparison').textContent).toContain('Basisjahr 2026 fixiert');
    expect(screen.getByTestId('saved-scenario-comparison').textContent).toContain('Ergebnisse sind keine historischen Sicherungen');
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(pdfText.join(' ')).toContain('Vergleich gespeicherter Szenarien');
    expect(pdfText.join(' ')).toContain('Davon Elternbeitragszuschuss (nominal)');
    expect(pdfText.join(' ')).toContain('Gesamteinnahmen');
    expect(pdfText.join(' ')).toContain('Warnung – gespeicherter Szenariovergleich:');
    expect(pdfText.join(' ')).toContain('B: Vergleich B (Fuchs: ZEITKAT 05');
    expect(pdfText.join(' ')).not.toContain('Warnung – aktive Simulation:');
    expect(pdfText.join(' ')).not.toContain('Warnung – Tarif-Snapshot im aktiven Arbeitsstand');
    expect(pdfText.join(' ')).not.toContain('Warnung – Tarif-Snapshots im Szenariovergleich');
    expect(pdfText.join(' ')).toContain('3.600,00 €');
    expect(pdfText.join(' ')).toContain('Nicht verfügbar');
    expect(pdfText.join(' ')).toContain('historische gemeinsame Daten sind nicht gesichert');
    expect(pdfText.join(' ')).toContain('Monatswerte, Monats- und Familienaufschlüsselungen sowie Potenziale sind vor der Reform berechnet');
    expect(pdfText.join(' ')).toContain('Forecast-Gruppenfilter: alle Gruppen');
    expect(pdfText.join(' ')).toContain('geschätzter Zulauf machen den Vergleichswert nicht verfügbar');
    expect(pdfText.join(' ')).toContain('Familienliste aus Datenschutzgründen nicht enthalten');
    expect(pdfText.join(' ')).not.toContain('Familie Reuter');
    act(() => store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'projected' } })));
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(pdfText.join(' ')).toContain('Forecast: Projizierte Bestände');
    expect(pdfText.join(' ')).toContain('Zulauf-Datengrundlage bis');
    expect(pdfText.join(' ')).toContain('archivierte und andere Status sind ausgeschlossen');
    expect(pdfText.join(' ')).toContain('nicht berechenbare Kind-Monate');
    expect(pdfText.join(' ')).toContain('Unvollständige Jahreswerte');
    act(() => store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'legacy', temporaryPrices: { g1: { '05': 150 } } } })));
    expect(screen.getByTestId('active-legacy-prices-warning').textContent).toContain('ZEITKAT 05');
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('pdf-include-families'));
    fireEvent.click(screen.getByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(pdfText.join(' ')).toContain('Familie Reuter');
    expect(pdfText.join(' ')).toContain('Warnung – aktive Simulation:');
    expect(pdfText.join(' ')).toContain('aktiver Arbeitsstand (ungesicherte Szenarioänderungen)');
    act(() => store.dispatch(deleteBooking({ scenarioId: 'scenario-1', dataItemId: 'child-2', bookingId: 'booking-2' })));
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('12 Kind-Monate ohne Beitrag');
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(4));
    expect(pdfText.join(' ')).toContain('Kinder ohne Basisbuchung oder auswertbare Buchungszeiten (Kind-Monate): 2026: 12');
    const scenarios = store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.simulationScenarios;
    act(() => store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { simulationScenarios: scenarios.map((scenario) => scenario.id === 'b' ? { ...scenario, data: { ...scenario.data, fixedBaseYearEnabled: false, stockMode: 'projected' } } : scenario) } })));
    pdfText.length = 0;
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(5));
    expect(pdfText.join(' ')).toContain('Projizierte Bestände');
    expect(pdfText.join(' ')).toContain('Forecast unvollständig');
    const currentScenarios = store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.simulationScenarios;
    act(() => {
      store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { fixedBaseYearEnabled: true, fixedBaseYear: 2026, simulationScenarios: currentScenarios.map((scenario) => scenario.id === 'b' ? { ...scenario, data: { ...scenario.data, forecastInflowEnabled: true } } : scenario) } }));
      store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { actualFunding: { bookingTime: '' } } } }));
    });
    pdfText.length = 0;
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(6));
    expect(pdfText.join(' ')).toContain('Manuelle Förderangaben fehlen');
    expect(pdfText.join(' ')).toContain('Reformeingaben fehlen oder sind ungültig');
    expect(pdfText.join(' ')).toContain('2026-Ist bookingTime');
    expect(pdfText.join(' ')).toContain('Geschätzter Zulauf ist im sicheren Vergleich nicht verfügbar');
    vi.doUnmock('jspdf');
  });

  it('vergleicht bekannte und projizierte gespeicherte Bestände mit derselben Jahresberechnung', () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const store = createTestStore({ forecastGroupType: 'Regelgruppe', forecastReferenceDate: '2026-01-01', forecastEvents: [] });
    setExplicitManualFunding(store);
    const data = { temporaryCatalogEntries: {}, selectedGroupIds: [], fixedBaseYearEnabled: false, fixedBaseYear: 2026, forecastInflowEnabled: false, potentialMonthlyBudget: 50 };
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: {
      stockMode: 'known', simulationScenarios: [
        { id: 'a', name: 'Bekannt A', data: { ...data, stockMode: 'known', temporaryPrices: {} } },
        { id: 'b', name: 'Prognose B', data: { ...data, stockMode: 'projected', forecastInflowEnabled: false, temporaryPrices: { g1: { '05': 150 } } } },
      ], selectedSimulationScenarioId: 'a',
    } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bekannt A' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Prognose B' }));
    const group = screen.getByTestId('saved-scenario-comparison-2026');
    const rows = within(group).getAllByRole('row');
    const cells = rows.map((row) => within(row).getAllByRole('cell'));
    expect(rows).toHaveLength(4);
    expect(getEuroAmount(cells[0][2])).toBeCloseTo(getEuroAmount(screen.getByTestId('annual-funding-2026')), 2);
    expect(getEuroAmount(cells[1][2])).toBe(2400);
    expect(getEuroAmount(cells[1][3])).toBe(2400);
    expect(getEuroAmount(cells[2][2])).toBe(0);
    expect(getEuroAmount(cells[2][3])).toBe(1200);
    expect(getEuroAmount(cells[3][3]) - getEuroAmount(cells[3][2])).toBe(1200);
    expect(group.textContent).not.toContain('Nicht verfügbar');
    expect(screen.getByTestId('saved-scenario-comparison').textContent).toContain('Projizierte Bestände');
    expect(screen.getByTestId('saved-scenario-comparison-2027').textContent).not.toContain('Nicht verfügbar');
    const bFunding = getEuroAmount(cells[0][3]);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario' }));
    fireEvent.click(screen.getByRole('option', { name: 'Prognose B' }));
    expect(getEuroAmount(screen.getByTestId('annual-funding-2026'))).toBeCloseTo(bFunding, 2);
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(1200);
    const scenarios = store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.simulationScenarios;
    act(() => store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { simulationScenarios: scenarios.map((scenario) => scenario.id === 'b' ? { ...scenario, data: { ...scenario.data, forecastInflowEnabled: true } } : scenario) } })));
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('Geschätzter Zulauf');
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('Nicht verfügbar');
    expect(screen.getByTestId('saved-scenario-comparison-2027').textContent).toContain('Forecast unvollständig');
    act(() => store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: {} } })));
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('Manuelle Förderangaben fehlen');
  });

  it('verwendet nach Ablauf die Jahresvorgabe und kennzeichnet unterjährige Teamzuschuss-Sätze in Panel, Vergleich und PDF', async () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const pdfText = [];
    const save = vi.fn();
    vi.doMock('jspdf', () => ({ jsPDF: class {
      internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
      setProperties() {} setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {}
      setFillColor() {} setLineWidth() {} rect() {} line() {} addPage() {} setPage() {}
      getNumberOfPages() { return 1; }
      splitTextToSize(text) { return String(text).split('\n'); }
      text(value) { pdfText.push(...(Array.isArray(value) ? value : [value])); }
      save = save;
    } }));
    const store = createTestStore();
    const data = { temporaryCatalogEntries: {}, temporaryPrices: {}, selectedGroupIds: [], fixedBaseYearEnabled: false, fixedBaseYear: 2026, stockMode: 'legacy', potentialMonthlyBudget: 50 };
    store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { annualFundingInputsByYear: explicitAnnualFunding, approvedPlaces: 50, teamGrantEligible: false } } }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { simulationScenarios: [{ id: 'a', name: 'Satz A', data }, { id: 'b', name: 'Satz B', data }], selectedSimulationScenarioId: 'a' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    const rules = store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules;
    const rule2027 = rules.find((rule) => rule.validFrom === '2027-01-01');
    const rule2028 = rules.find((rule) => rule.validFrom === '2028-01-01');
    act(() => {
      store.dispatch(updateBayKiBiGRule({ scenarioId: 'scenario-1', ruleId: rule2027.id, updates: { validUntil: '2027-12-31', teamGrantRates: { first50: 500, remaining100: 167.61 } } }));
      store.dispatch(updateBayKiBiGRule({ scenarioId: 'scenario-1', ruleId: rule2028.id, updates: { teamGrantRates: {} } }));
    });
    expect(store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules.find((rule) => rule.id === rule2028.id).teamGrantRates).toEqual({});
    const before = getEuroAmount(screen.getByTestId('annual-funding-2028'));
    act(() => store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { annualFundingInputsByYear: explicitAnnualFunding, approvedPlaces: 50, teamGrantEligible: true } } })));
    expect(getEuroAmount(screen.getByTestId('annual-funding-2028')) - before).toBeCloseTo(35000, 2);
    expect(screen.getByTestId('annual-income-row-2028').textContent).not.toContain('unvollständig');
    expect(screen.getByTestId('simulation-team-grant-rates').textContent).toContain('2028: erste 50 Plätze 700,00 € (ADEBIS-Jahresvorgabe)');
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Satz A' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Satz B' }));
    expect(screen.getByTestId('comparison-team-grant-rates').textContent).toContain('B: 2028: erste 50 Plätze 700,00 € (ADEBIS-Jahresvorgabe)');
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(pdfText.join(' ')).toContain('2028: erste 50 Plätze 700,00 € (ADEBIS-Jahresvorgabe)');
    expect(pdfText.join(' ')).toContain('35.000,00 €');
    act(() => store.dispatch(updateBayKiBiGRule({ scenarioId: 'scenario-1', ruleId: rule2028.id, updates: { validUntil: '2028-06-30', teamGrantRates: { first50: 700, remaining100: 242.37 } } })));
    expect(screen.getByTestId('annual-income-row-2028').textContent).toContain('unvollständig');
    expect(screen.getByTestId('simulation-team-grant-rates').textContent).toContain('Gültigkeit für das gesamte Jahr nicht nachgewiesen');
    expect(screen.getByTestId('simulation-missing-reform-inputs').textContent).toContain('Teamzuschuss-Sätze oder genehmigte Plätze');
    expect(screen.getByTestId('saved-scenario-comparison-2028').textContent).toContain('Nicht verfügbar');
    fireEvent.click(screen.getByTestId('annual-income-details-2028'));
    const summary = await screen.findByTestId('adebis-annual-summary');
    expect(summary.textContent).toContain('Reform-Teamzuschuss (brutto)Nicht verfügbar');
    pdfText.length = 0;
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(pdfText.join(' ')).toContain('2028: Teamzuschuss-Sätze oder genehmigte Plätze');
    expect(pdfText.join(' ')).toContain('Gültigkeit für das gesamte Jahr nicht nachgewiesen');
    expect(pdfText.join(' ')).toContain('Nicht verfügbar');
    vi.doUnmock('jspdf');
  });

  it('ersetzt bisherige Förderung im dynamischen Bestand genau einmal durch den Teamzuschuss', async () => {
    const store = createTestStore();
    store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: {
      approvedPlaces: 50, teamGrantEligible: false,
      annualFundingInputsByYear: { ...explicitAnnualFunding, 2027: { ...ZERO_MANUAL_FUNDING, personnelBonus: 1000, assistance: 2000, languageSpecialists: 3000 } },
      actualFunding: { personnelBonus: 9000, assistance: 8000, languageSpecialists: 7000 },
    } } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    const before = getEuroAmount(screen.getByTestId('annual-funding-2027'));
    openSimulationSettings();
    fireEvent.click(screen.getByTestId('reform-team-grant-eligible'));
    expect(getEuroAmount(screen.getByTestId('annual-funding-2027')) - before).toBeCloseTo(25000 - 6000, 2);
    fireEvent.click(screen.getByTestId('annual-income-details-2027'));
    const summary = await screen.findByTestId('adebis-annual-summary');
    expect(summary.textContent).toContain('6.000,00 €');
    expect(summary.textContent).toContain('19.000,00 €');
    expect(screen.getByText(/Monatswerte und ihre Summen sind vorreformierte Modellwerte/)).toBeTruthy();
  });

  it('unterscheidet Excel-Jahreswerte von zwei fixierten Tarif-Szenarien und exportiert sie ins PDF', async () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const pdfText = [];
    const save = vi.fn();
    vi.doMock('jspdf', () => ({ jsPDF: class {
      internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
      setProperties() {} setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {}
      setFillColor() {} setLineWidth() {} rect() {} line() {} addPage() {} setPage() {}
      getNumberOfPages() { return 1; }
      splitTextToSize(text) { return String(text).split('\n'); }
      text(value) { pdfText.push(...(Array.isArray(value) ? value : [value])); }
      save = save;
    } }));
    const store = createTestStore();
    const base = 1563.88;
    store.dispatch(updateBayKiBiGRule({ scenarioId: 'scenario-1', ruleId: 'r1', updates: { baseValue: base, validUntil: '2026-12-31' } }));
    for (const [year, ratio] of [[2027, 1.1], [2028, 1.1 * 1.05], [2029, 1.1 * 1.05 * 1.02]]) {
      store.dispatch(addBayKiBiGRule({ scenarioId: 'scenario-1', rule: { id: `r${year}`, validFrom: `${year}-01-01`, validUntil: `${year}-12-31`, baseValue: base * ratio } }));
    }
    const fee2026 = { id: 'fee-2026', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01', validUntil: '2026-12-31' };
    const fee2027 = { id: 'fee-2027', zeitkatId: '05', monthlyAmount: 100, validFrom: '2027-01-01' };
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: [fee2026, fee2027] } }));
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: true, monthlyAmount: 50, endDate: '2026-12-31' } }));
    const actualFunding = { bookingTime: 1000, qualityBonus: 268.01, preparatoryCourses: 100, under3Additional: 20, under3Federal: 10, parentFeeSubsidy: 1200, assistance: 10, personnelBonus: 20, languageSpecialists: 30 };
    store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { approvedPlaces: 51, teamGrantEligible: true, actualFunding, annualFundingInputsByYear: { ...explicitAnnualFunding, 2026: { under3Federal: 10, assistance: 10, personnelBonus: 20, languageSpecialists: 30 } } } } }));
    const data = { temporaryPrices: {}, selectedGroupIds: [], fixedBaseYearEnabled: true, fixedBaseYear: 2026, stockMode: 'legacy', potentialMonthlyBudget: 50 };
    const scenarios = [
      { id: 'a', name: 'Reduziert', data: { ...data, temporaryCatalogEntries: { g1: [fee2026, { ...fee2027, monthlyAmount: 50 }] } } },
      { id: 'b', name: 'Eltern zahlen', data: { ...data, temporaryCatalogEntries: { g1: [fee2026, fee2027] } } },
    ];
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { fixedBaseYearEnabled: true, fixedBaseYear: 2026, simulationScenarios: scenarios, selectedSimulationScenarioId: 'a' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Reduziert' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Eltern zahlen' }));
    const cells = (year, index) => within(within(screen.getByTestId(`saved-scenario-comparison-${year}`)).getAllByRole('row')[index]).getAllByRole('cell');
    const income2026 = cells(2026, 3);
    const income2027 = cells(2027, 3);
    expect(getEuroAmount(income2026[2])).toBe(3858.01);
    expect(getEuroAmount(income2026[3])).toBe(3858.01);
    expect(getEuroAmount(income2027[2])).toBe(28270.89);
    expect(getEuroAmount(income2027[3])).toBe(29470.89);
    // Ordinary net 2026 parent fees (1,200) are included by Capakita, but not in Excel B59/C66/C72.
    expect(getEuroAmount(income2027[2]) - getEuroAmount(income2026[2])).toBeCloseTo(24412.88, 2);
    expect(getEuroAmount(income2027[3]) - getEuroAmount(income2026[3])).toBeCloseTo(25612.88, 2);
    for (const [year, previous, expectedChange] of [[2028, 2027, 10294.34], [2029, 2028, 30.92]]) {
      const current = cells(year, 3);
      const prior = cells(previous, 3);
      expect(getEuroAmount(current[2]) - getEuroAmount(prior[2])).toBeCloseTo(expectedChange, 2);
      expect(getEuroAmount(current[3]) - getEuroAmount(prior[3])).toBeCloseTo(expectedChange, 2);
    }
    const excelRow = within(screen.getByTestId('workbook-comparison-2027')).getAllByRole('cell');
    expect(excelRow.map(getEuroAmount)).toEqual([0, 27070.89, 24412.88, 28270.89, 25612.88]);
    expect(screen.getByTestId('workbook-comparison-2028').textContent).toContain('38.565,23');
    const exportPdf = async (count) => {
      pdfText.length = 0;
      fireEvent.click(screen.getByTestId('export-simulation-pdf'));
      fireEvent.click(await screen.findByTestId('confirm-export-simulation-pdf'));
      await waitFor(() => expect(save).toHaveBeenCalledTimes(count));
    };
    const workbookSection = () => {
      const start = pdfText.indexOf('Indikativer Jahresvergleich nach Excel-Vorlage');
      const end = pdfText.indexOf('Vergleich gespeicherter Szenarien – Jahresergebnisse', start);
      return pdfText.slice(start, end < 0 ? undefined : end);
    };
    await exportPdf(1);
    let section = workbookSection();
    expect(section.join(' ')).toContain('keine kindbezogene Finanzrechnung');
    expect(section.join(' ')).toContain('nicht der ausgewählten A/B-Szenarien');
    expect(section.join(' ')).toContain('unterjährige Wechsel werden nicht aufgeteilt');
    expect(section.slice(section.indexOf('2027'), section.indexOf('2027') + 5)).toEqual(['2027', '27.070,89 €', '+24.412,88 €', '28.270,89 €', '+25.612,88 €']);
    expect(section.slice(section.indexOf('2028'), section.indexOf('2028') + 5)).toEqual(['2028', '37.365,23 €', '+10.294,34 €', '38.565,23 €', '+10.294,34 €']);
    act(() => store.dispatch(updateBayKiBiGRule({ scenarioId: 'scenario-1', ruleId: 'r2028', updates: { validUntil: '2028-06-30', teamGrantRates: { first50: 700, remaining100: 242.37 } } })));
    await exportPdf(2);
    section = workbookSection();
    expect(section.slice(section.indexOf('2028'), section.indexOf('2028') + 5)).toEqual(['2028', 'Nicht verfügbar', 'Nicht verfügbar', 'Nicht verfügbar', 'Nicht verfügbar']);
    expect(section.slice(section.indexOf('2029'), section.indexOf('2029') + 5)).toEqual(['2029', '37.396,15 €', 'Nicht verfügbar', '38.596,15 €', 'Nicht verfügbar']);
    act(() => store.dispatch(updateBayKiBiGRule({ scenarioId: 'scenario-1', ruleId: 'r2028', updates: { validUntil: '2028-12-31' } })));
    act(() => store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { approvedPlaces: 51, teamGrantEligible: true, actualFunding: { ...actualFunding, parentFeeSubsidy: '' }, annualFundingInputsByYear: explicitAnnualFunding } } })));
    expect(screen.getByTestId('workbook-comparison-2027').textContent).toContain('Nicht verfügbar');
    await exportPdf(3);
    section = workbookSection();
    expect(section.slice(section.indexOf('2027'), section.indexOf('2027') + 5)).toEqual(['2027', 'Nicht verfügbar', 'Nicht verfügbar', 'Nicht verfügbar', 'Nicht verfügbar']);
    const zeroActualFunding = Object.fromEntries(Object.keys(actualFunding).map((key) => [key, 0]));
    act(() => store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { approvedPlaces: 0, teamGrantEligible: true, actualFunding: zeroActualFunding, annualFundingInputsByYear: explicitAnnualFunding } } })));
    await exportPdf(4);
    section = workbookSection();
    expect(section.slice(section.indexOf('2027'), section.indexOf('2027') + 5)).toEqual(['2027', '0,00 €', '0,00 €', '0,00 €', '0,00 €']);
    for (const updates of [{ fixedBaseYearEnabled: false }, { fixedBaseYearEnabled: true, fixedBaseYear: 2027 }]) {
      act(() => store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates })));
      expect(screen.queryByTestId('workbook-annual-comparison')).toBeNull();
      await exportPdf(save.mock.calls.length + 1);
      expect(pdfText).not.toContain('Indikativer Jahresvergleich nach Excel-Vorlage');
    }
    vi.doUnmock('jspdf');
  });

  it('berechnet die 2026-Reformbasis auch bei Stichtag 2027 und prüft Istwerte und Plätze', () => {
    const store = createTestStore({ forecastReferenceDate: '2027-01-01' });
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    const actualFunding = { bookingTime: 1000, qualityBonus: 0, preparatoryCourses: 0, under3Additional: 0, under3Federal: 0, assistance: 2000, personnelBonus: 1000, languageSpecialists: 3000 };
    const settings = { annualFundingInputsByYear: explicitAnnualFunding, actualFunding, approvedPlaces: 50, teamGrantEligible: false };
    store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: settings } }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { fixedBaseYearEnabled: true, fixedBaseYear: 2026 } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.queryByTestId('annual-income-row-2026')).toBeNull();
    expect(screen.getByTestId('annual-income-row-2027').textContent).not.toContain('unvollständig');
    const before = getEuroAmount(screen.getByTestId('annual-funding-2027'));
    act(() => store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { ...settings, teamGrantEligible: true } } })));
    expect(getEuroAmount(screen.getByTestId('annual-funding-2027')) - before).toBeCloseTo(25000, 2);
    const rules = store.getState().simFinance.financeByScenario['scenario-1'].bayKiBiGRules;
    const reform2027 = calculateReformForecast({ ...settings, teamGrantEligible: true }, {}, rules).results.find((row) => row.year === 2027);
    expect(getEuroAmount(screen.getByTestId('annual-funding-2027'))).toBeCloseTo(reform2027.components.childRelatedFunding + 25000, 2);
    expect(before).toBeCloseTo(reform2027.components.childRelatedFunding, 2);
    for (const [field, value] of [['bookingTime', ''], ['qualityBonus', -1], ['preparatoryCourses', 'ungültig'], ['assistance', null]]) {
      act(() => store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { ...settings, actualFunding: { ...actualFunding, [field]: value }, teamGrantEligible: true } } })));
      expect(screen.getByTestId('annual-income-row-2027').textContent).toContain('unvollständig');
      expect(screen.getByTestId('simulation-missing-reform-inputs').textContent).toContain(field);
    }
    act(() => store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { ...settings, approvedPlaces: '', teamGrantEligible: true } } })));
    expect(screen.getByTestId('simulation-missing-reform-inputs').textContent).toContain('genehmigte Plätze');
    fireEvent.click(screen.getByRole('button', { name: 'Zusatzförderungsspalten einblenden' }));
    expect(screen.getByLabelText('U3-Bundesmittel 2026 (Basis für 2027)').disabled).toBe(false);
  });

  it('kennzeichnet fehlende manuelle Jahresförderung auch im aktiven Ergebnis und erhält leere Eingaben', () => {
    const store = createTestStore();
    store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: {} } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('unvollständig');
    expect(screen.getByTestId('simulation-missing-reform-inputs').textContent).toContain('Assistenz (2026)');
    fireEvent.click(screen.getByRole('button', { name: 'Zusatzförderungsspalten einblenden' }));
    const input = screen.getByTestId('annual-funding-input-2026-assistance');
    expect(input.value).toBe('');
    fireEvent.blur(input);
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.reformForecast.annualFundingInputsByYear['2026'].assistance).toBe('');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('unvollständig');
  });

  it('berechnet das fixierte Reform-Szenario im Vergleich wie nach dessen Auswahl', () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const store = createTestStore({ include2027BookingChange: true });
    const data = { temporaryCatalogEntries: {}, temporaryPrices: {}, selectedGroupIds: [], fixedBaseYearEnabled: false, fixedBaseYear: 2026, stockMode: 'legacy', potentialMonthlyBudget: 50 };
    store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { teamGrantEligible: true, approvedPlaces: 70, annualFundingInputsByYear: { ...explicitAnnualFunding, 2026: { ...ZERO_MANUAL_FUNDING, personnelBonus: 6000 } } } } }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { simulationScenarios: [{ id: 'a', name: 'Dynamisch A', data }, { id: 'b', name: 'Fixiert B', data: { ...data, fixedBaseYearEnabled: true } }], selectedSimulationScenarioId: 'a' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Dynamisch A' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Fixiert B' }));
    const comparisonRows = within(screen.getByTestId('saved-scenario-comparison-2027')).getAllByRole('row');
    const fundingB = getEuroAmount(within(comparisonRows[0]).getAllByRole('cell')[3]);
    const incomeB = getEuroAmount(within(comparisonRows[3]).getAllByRole('cell')[3]);
    expect(fundingB).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario' }));
    fireEvent.click(screen.getByRole('option', { name: 'Fixiert B' }));
    expect(getEuroAmount(screen.getByTestId('annual-funding-2027'))).toBeCloseTo(fundingB, 2);
    expect(getEuroAmount(within(screen.getByTestId('annual-income-row-2027')).getAllByRole('cell')[5])).toBeCloseTo(incomeB, 2);
  });

  it('gibt bei fehlendem Reformjahr keine scheinbar vollständigen Vergleichswerte aus', () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const store = createTestStore();
    const data = { temporaryCatalogEntries: {}, temporaryPrices: {}, selectedGroupIds: [], fixedBaseYearEnabled: false, fixedBaseYear: 2026, stockMode: 'legacy', potentialMonthlyBudget: 50 };
    store.dispatch(addBayKiBiGRule({ scenarioId: 'scenario-1', rule: { id: 'rule-2030', validFrom: '2030-01-01', baseValue: 12 } }));
    store.dispatch(updateScenarioFinanceSettings({ scenarioId: 'scenario-1', updates: { reformForecast: { teamGrantEligible: true, approvedPlaces: 70 } } }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { simulationScenarios: [{ id: 'a', name: 'Modell A', data }, { id: 'b', name: 'Modell B', data }], selectedSimulationScenarioId: 'a' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('simulation-missing-reform-year').textContent).toContain('2030');
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Modell A' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Modell B' }));
    expect(screen.getByTestId('saved-scenario-comparison-2030').textContent).toContain('Reformmodell für dieses Jahr nicht verfügbar');
    expect(screen.getByTestId('saved-scenario-comparison-2030').textContent).toContain('Nicht verfügbar');
  });

  it('kennzeichnet ein fehlendes Geburtsdatum als unvollständige Finanzberechnung', () => {
    const store = createTestStore();
    store.dispatch({ type: 'simData/updateDataItemFields', payload: { scenarioId: 'scenario-1', itemId: 'child-1', fields: { dateofbirth: '', rawdata: { GEBDATUM: '2022-01-01' } } } });
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('simulation-missing-birthdate').textContent).toContain('2026: 12 Kind-Monate');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('unvollständig');
  });

  it('kennzeichnet Monate ohne gültige Förderregel und sperrt Finanzvergleiche', () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const store = createTestStore();
    const data = { temporaryCatalogEntries: {}, temporaryPrices: {}, selectedGroupIds: [], fixedBaseYearEnabled: false, fixedBaseYear: 2026, potentialMonthlyBudget: 50 };
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { simulationScenarios: [{ id: 'a', name: 'Regel A', data }, { id: 'b', name: 'Regel B', data }], selectedSimulationScenarioId: 'a' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    const completeFunding = getEuroAmount(screen.getByTestId('annual-funding-2026'));
    act(() => store.dispatch(updateBayKiBiGRule({ scenarioId: 'scenario-1', ruleId: 'r1', updates: { validFrom: '2026-07-01' } })));
    expect(screen.getByTestId('simulation-missing-monthly-rule').textContent).toContain('2026: 6 Monate');
    expect(getEuroAmount(screen.getByTestId('annual-funding-2026'))).toBeCloseTo(completeFunding - 8.8, 2);
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario A' }));
    fireEvent.click(screen.getByRole('option', { name: 'Regel A' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Szenario B' }));
    fireEvent.click(screen.getByRole('option', { name: 'Regel B' }));
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('6 Monate ohne gültige Förderregel');
    expect(screen.getByTestId('saved-scenario-comparison-2026').textContent).toContain('Nicht verfügbar');
  });

  it('zählt zeitlose Basisbuchungen auch bei deaktiviertem Zuschuss', () => {
    const store = createTestStore();
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    store.dispatch(updateBooking({ scenarioId: 'scenario-1', dataItemId: 'child-1', bookingId: 'booking-1', updates: { times: [] } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('simulation-timeless-bookings').textContent).toContain('2026: 12 Kind-Monate');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('unvollständig');
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(2400);
    expect(screen.getByTestId('simulation-incomplete-potential-bookings').textContent).toContain('Potenziale unvollständig');
    expect(store.getState().simBooking.bookingsByScenario['scenario-1']['child-1']['booking-1'].times).toEqual([]);
  });

  it('kennzeichnet fehlende Zeitsegmente trotz BETRSTD bei den Potenzialen', () => {
    const store = createTestStore();
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    store.dispatch(updateBooking({ scenarioId: 'scenario-1', dataItemId: 'child-1', bookingId: 'booking-1', updates: { times: [], rawdata: { ZEITKAT: '05', ART: '0', BETRSTD: '25' } } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(2400);
    expect(screen.getByTestId('simulation-incomplete-potential-bookings').textContent).toContain('BETRSTD allein');
    expect(store.getState().simBooking.bookingsByScenario['scenario-1']['child-1']['booking-1']).toMatchObject({ times: [], rawdata: { BETRSTD: '25', ZEITKAT: '05' } });
  });

  it('erfasst fehlende und zeitlose Schulkindbuchungen einmalig auch im fixierten Basisjahr', () => {
    const store = createTestStore();
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    store.dispatch(updateBooking({ scenarioId: 'scenario-1', dataItemId: 'child-1', bookingId: 'booking-1', updates: { times: [], rawdata: { ZEITKAT: '05', ART: '0', SCHULKIND: '.T.' } } }));
    store.dispatch(deleteBooking({ scenarioId: 'scenario-1', dataItemId: 'child-2', bookingId: 'booking-2' }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { fixedBaseYearEnabled: true, fixedBaseYear: 2026 } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('simulation-timeless-bookings').textContent).toContain('2026: 24 Kind-Monate');
    expect(screen.getByTestId('simulation-timeless-bookings').textContent).toContain('2027: 24 Kind-Monate');
    expect(screen.getByTestId('simulation-missing-tariffs').textContent).toContain('2026: 12 Kind-Monate');
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(1200);
    expect(screen.getByTestId('annual-income-row-2027').textContent).toContain('unvollständig');
    expect(screen.getByTestId('annual-income-row-2027').textContent).not.toContain('zum Vorjahr');
  });

  it('führt Forecast- und Finanzdiagnose je Kind und Monat ohne Doppelzählung zusammen', () => {
    const store = createTestStore({ forecastGroupType: 'Regelgruppe', forecastReferenceDate: '2026-01-01', forecastEvents: [] });
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    store.dispatch(updateBooking({ scenarioId: 'scenario-1', dataItemId: 'child-1', bookingId: 'booking-1', updates: { times: [], rawdata: { ZEITKAT: '05', ART: '0', SCHULKIND: '.T.' } } }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'known' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    const year = screen.getByTestId('forecast-finance-year-2026').textContent;
    expect(year).toContain('12 nicht berechenbare Kind-Monate');
    expect(year).toContain('Erkan Reuter: 12 Kind-Monate');
    expect(screen.getByTestId('simulation-timeless-bookings').textContent).toContain('2026: 12 Kind-Monate');
    expect(screen.queryByTestId('simulation-missing-tariffs')).toBeNull();
    expect(getEuroAmount(screen.getByTestId('annual-contributions-2026'))).toBe(2400);
    expect(screen.queryByTestId('simulation-partial-active-children')).toBeNull();
  });

  it('nutzt Forecast-Ereignisse nur im Projektionsmodus und zeigt nicht berechenbare Kinder', () => {
    Element.prototype.scrollIntoView ||= vi.fn();
    const store = createTestStore({ forecastGroupType: 'Regelgruppe', forecastReferenceDate: '2026-01-01', forecastEvents: [
      { entityType: 'demand', entityId: 'child-1', type: 'auto_group_transition', effectiveDate: '2026-07-01', metadata: { targetStage: 'kita' } },
    ] });
    store.dispatch(importGroupAssignments({ scenarioId: 'scenario-1', assignments: [{ id: 'a', kindId: 'child-1', groupId: 'g1', start: '2026-01-01', end: '2026-06-30' }] }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    openSimulationSettings();
    fireEvent.click(screen.getByRole('combobox', { name: 'Bestandsmodell ohne fixiertes Basisjahr' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bekannte Bestände (Forecast)' }));
    expect(screen.getByTestId('forecast-finance-year-2026').textContent).toContain('ungeklärt 6 Kind-Monate');
    expect(screen.getByTestId('forecast-finance-year-2026').textContent).toContain('Erkan Reuter');
    expect(screen.getByTestId('forecast-finance-year-2026').textContent).toContain('Gruppe ungeklärt');
    fireEvent.click(screen.getByRole('combobox', { name: 'Bestandsmodell ohne fixiertes Basisjahr' }));
    fireEvent.click(screen.getByRole('option', { name: 'Projizierte Bestände (Forecast)' }));
    expect(screen.getByTestId('forecast-finance-year-2026').textContent).toContain('projiziert 6');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('unvollständig');
    expect(screen.getByTestId('forecast-configuration-notice').textContent).toContain('unabhängig');
    expect(store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.stockMode).toBe('projected');
  });

  it('erklärt die neue Adapterdiagnose bei ungeklärter Betreuungsstufe', () => {
    const store = createTestStore({ forecastReferenceDate: '2026-01-01', forecastEvents: [] });
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'known' } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('forecast-finance-year-2026').textContent).toContain('Betreuungsstufe ungeklärt');
    expect(screen.getByTestId('annual-income-row-2026').textContent).toContain('unvollständig');
  });

  it('verwendet den szenariobezogenen Stichtag und Forecast-Gruppenfilter', () => {
    const store = createTestStore({ forecastGroupType: 'Regelgruppe', forecastReferenceDate: '2026-03-15', forecastEvents: [] });
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'projected', forecastInflowEnabled: true } }));
    store.dispatch(setFilterGroups({ scenarioId: 'scenario-1', groups: ['__NO_GROUP__'] }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('forecast-finance-diagnostics').textContent).toContain('Forecast-Gruppenfilter aktiv');
    expect(screen.getByTestId('forecast-finance-year-2026').textContent).toContain('3 Monate vor Stichtag');
    expect(screen.getByTestId('forecast-finance-year-2026').textContent).toContain('bekannt 0');
    expect(screen.getByTestId('forecast-finance-diagnostics').textContent).toContain('Zulauf nicht abschätzbar');
  });

  it('zeigt die eingeschränkte Zulaufstichprobe und aktualisiert sie bei Archivierung und Gruppenfilter', () => {
    const store = createTestStore({ forecastReferenceDate: '2026-03-15', forecastEvents: [] });
    store.dispatch(addDataItem({ scenarioId: 'scenario-1', item: { type: 'demand', startdate: '2024-01-01', enddate: '2024-12-31' } }));
    store.dispatch(addDataItem({ scenarioId: 'scenario-1', item: { type: 'demand', startdate: '2022-01-01', archived: true } }));
    store.dispatch(addDataItem({ scenarioId: 'scenario-1', item: { type: 'demand', startdate: '2023-01-01', rawdata: { STATUS: '-' } } }));
    store.dispatch(addDataItem({ scenarioId: 'scenario-1', item: { type: 'demand', startdate: '2027-01-01' } }));
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'projected', forecastInflowEnabled: true } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    const basis = screen.getByTestId('simulation-inflow-basis');
    expect(basis).toHaveTextContent('3 Aufnahmedatensätze in 2 Jahren; gerundetes Mittel 2 pro Jahr');
    expect(basis).toHaveTextContent('archivierte und andere Status sind ausgeschlossen');
    expect(basis).toHaveTextContent('Jahre ohne berücksichtigte Aufnahmen zählen nicht');
    expect(basis).toHaveTextContent('Datensätze werden nicht auf doppelte Aufnahmen geprüft');
    act(() => store.dispatch(updateDataItem({ scenarioId: 'scenario-1', itemId: 'child-1', updates: { archived: true } })));
    expect(basis).toHaveTextContent('2 Aufnahmedatensätze in 2 Jahren; gerundetes Mittel 1 pro Jahr');
    act(() => store.dispatch(setFilterGroups({ scenarioId: 'scenario-1', groups: ['__NO_GROUP__'] })));
    expect(basis).toHaveTextContent('Bei aktivem Forecast-Gruppenfilter wird kein Zulauf simuliert');
    act(() => store.dispatch(setReferenceDate({ scenarioId: 'scenario-1', date: '2021-01-01' })));
    expect(basis).toHaveTextContent('keine berücksichtigten Aufnahmedatensätze; kein Mittel berechenbar');
  });

  it('kennzeichnet Zukunftsjahre trotz vollständig angerechneter bekannter Aufnahmen als unvollständig', () => {
    const store = createTestStore({ forecastGroupType: 'Regelgruppe', forecastReferenceDate: '2026-01-01', forecastEvents: [] });
    for (const name of ['Future A', 'Future B']) {
      store.dispatch(addDataItem({ scenarioId: 'scenario-1', item: { type: 'demand', name, groupId: 'g1', dateofbirth: '2022-01-01', startdate: '2027-01-01' } }));
      const child = Object.values(store.getState().simData.dataByScenario['scenario-1']).find((item) => item.name === name);
      store.dispatch(addBooking({ scenarioId: 'scenario-1', dataItemId: child.id, booking: makeBooking(child.id, { startdate: '2027-01-01' }) }));
    }
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'projected', forecastInflowEnabled: false } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('forecast-finance-year-2027')).not.toHaveTextContent('unvollständig');
    act(() => store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { forecastInflowEnabled: true } })));
    expect(screen.getByTestId('forecast-finance-year-2027')).not.toHaveTextContent('Anonymer Zulauf');
    expect(screen.getByTestId('forecast-finance-year-2027')).toHaveTextContent('unvollständig');
    expect(screen.getByTestId('annual-income-row-2027')).toHaveTextContent('unvollständig');
    expect(screen.getByTestId('simulation-inflow-basis')).toHaveTextContent('auch ohne erzeugten anonymen Zulauf unvollständig');
  });

  it('sichert Forecast-Modus und Zulaufoption im Szenario', async () => {
    const store = createTestStore({ forecastGroupType: 'Regelgruppe', forecastReferenceDate: '2026-01-01' });
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'projected', forecastInflowEnabled: true } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('forecast-finance-diagnostics').textContent).toContain('Ereignisse nicht verfügbar');
    fireEvent.click(screen.getByTestId('save-simulation-scenario'));
    const name = await screen.findByTestId('simulation-scenario-name');
    fireEvent.change(name, { target: { value: 'Forecast-Sicherung' } });
    fireEvent.click(screen.getByTestId('confirm-save-simulation-scenario'));
    const saved = store.getState().simFinance.financeByScenario['scenario-1'].settings.fundingSimulation.simulationScenarios.find((scenario) => scenario.name === 'Forecast-Sicherung');
    expect(saved.data).toMatchObject({ stockMode: 'projected', forecastInflowEnabled: true });
  });

  it('weist unabhängig konfigurierten synthetischen Zulauf als nicht berechenbar aus', () => {
    const store = createTestStore({ forecastGroupType: 'Regelgruppe', forecastReferenceDate: '2026-01-01', forecastEvents: [] });
    store.dispatch(updateFundingSimulationSettings({ scenarioId: 'scenario-1', updates: { stockMode: 'projected', forecastInflowEnabled: true } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('forecast-finance-year-2027').textContent).toContain('Anonymer Zulauf: 8 Kind-Monate');
    expect(screen.getByTestId('simulation-partial-active-children').textContent).toContain('2027: 12 Monate');
    expect(screen.getByTestId('forecast-finance-year-2027').textContent).toContain('unvollständig');
    expect(screen.getByTestId('annual-income-row-2027').textContent).toContain('unvollständig');
  });

  it('warnt bei fehlendem Jahrestarif und vor personenbezogenem PDF', async () => {
    const store = createTestStore({ include2027BookingChange: true });
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    expect(screen.getByTestId('simulation-missing-tariffs').textContent).toContain('2027: 12 Kind-Monate');
    fireEvent.click(screen.getByTestId('export-simulation-pdf'));
    expect(await screen.findByText(/Das unverschlüsselte PDF enthält keine Familienliste/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('pdf-include-families'));
    expect(screen.getByText(/Das unverschlüsselte PDF enthält Familienbezeichnungen/)).toBeTruthy();
  });

  it('vergleicht Familien im Vorjahr mit dem tatsächlich simulierten Beitrag', async () => {
    const store = createTestStore({ include2027BookingChange: true });
    store.dispatch(setGroupFeeCatalogs({ scenarioId: 'scenario-1', catalogs: { g1: [
      { id: 'fee-zone-05', zeitkatId: '05', monthlyAmount: 100, validFrom: '2026-01-01' },
      { id: 'fee-zone-08', zeitkatId: '08', monthlyAmount: 100, validFrom: '2026-01-01' },
    ] } }));
    store.dispatch(updateGroupParentFeeSubsidy({ scenarioId: 'scenario-1', groupId: 'g1', updates: { enabled: false } }));
    render(<Provider store={store}><MantineProvider><FundingSimulationPanel /></MantineProvider></Provider>);
    openFuchsTariffGroup();
    setFeeAmount('Betrag ZEITKAT 05', 150);
    fireEvent.click(screen.getByTestId('annual-family-impact-toggle-2027'));
    const family = await screen.findByTestId('annual-family-impact-2027-fam-1');
    expect(family.textContent).toContain('-50,00 €');
  });

  it('uses the subsidy end date to show the 2027 family fee increase', async () => {
    const store = createTestStore({ include2027BookingChange: true });
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    expect(screen.queryByRole('switch', { name: 'Elternbeitragszuschuss aktiv' })).toBeNull();
    act(() => store.dispatch(updateGroupParentFeeSubsidy({
      scenarioId: 'scenario-1',
      groupId: 'g1',
      updates: { monthlyAmount: 75, endDate: '2026-12-31', maximumAgeYears: 100 },
    })));
    expect(screen.getByTestId('simulation-parent-fee-subsidy-amount-g1').textContent).toContain('75,00 €');

    openSimulationSettings();
    fireEvent.click(screen.getByTestId('fixed-base-year-toggle'));
    const contributions2026 = getEuroAmount(screen.getByTestId('annual-contributions-2026'));
    const contributions2027 = getEuroAmount(screen.getByTestId('annual-contributions-2027'));
    expect(contributions2027 - contributions2026).toBeCloseTo(1800, 2);
    expect(screen.getByTestId('annual-contributions-2027').textContent).toContain('+1.800,00 € zum Vorjahr');
    expect(screen.getByTestId('annual-contributions-2027').textContent).toContain('0,00 € Simulation');

    fireEvent.click(screen.getByTestId('annual-family-impact-toggle-2027'));
    const familyImpact = await screen.findByTestId('annual-family-impact-2027-fam-1');
    expect(familyImpact.textContent).toContain('+150,00 €');
  });

  it('uses the fixed-base-year group assignment when the original assignment expires before the forecast year', () => {
    const store = createTestStore();
    store.dispatch({
      type: 'simData/updateDataItemFields',
      payload: {
        scenarioId: 'scenario-1',
        itemId: 'child-1',
        fields: { groupId: '' },
      },
    });
    store.dispatch(importGroupAssignments({
      scenarioId: 'scenario-1',
      assignments: [{
        id: 'historical-group-assignment',
        kindId: 'child-1',
        groupId: 'g1',
        start: '2026-01-01',
        end: '2026-12-31',
      }],
    }));
    render(
      <Provider store={store}>
        <MantineProvider>
          <FundingSimulationPanel accent="#0f766e" />
        </MantineProvider>
      </Provider>
    );

    openSimulationSettings();
    fireEvent.click(screen.getByTestId('fixed-base-year-toggle'));

    const contributions2026 = getEuroAmount(screen.getByTestId('annual-contributions-2026'));
    const contributions2027 = getEuroAmount(screen.getByTestId('annual-contributions-2027'));
    expect(contributions2027 - contributions2026).toBeCloseTo(2400, 2);
    expect(screen.getByTestId('annual-contributions-2027').textContent).toContain('+2.400,00 € zum Vorjahr');
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
