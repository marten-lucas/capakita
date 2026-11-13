import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import JSZip from 'jszip';

import { useScenarioImport } from '../hooks/useScenarioImport';
import FundingSimulationPanel from '../components/SimDataCharts/FundingSimulationPanel';
import simScenarioReducer, { addScenario } from '../store/simScenarioSlice';
import simDataReducer from '../store/simDataSlice';
import simBookingReducer from '../store/simBookingSlice';
import simGroupReducer from '../store/simGroupSlice';
import simQualificationReducer from '../store/simQualificationSlice';
import simOverlayReducer from '../store/simOverlaySlice';
import simFinanceReducer, { setGroupFeeCatalogs } from '../store/simFinanceSlice';
import chartReducer from '../store/chartSlice';
import eventReducer from '../store/eventSlice';
import datesOfInterestReducer from '../store/datesOfInterestSlice';

vi.mock('@mantine/charts', () => ({ BarChart: () => null }));

async function makeZip(schoolFlag, betrstd = '') {
  const zip = new JSZip();
  zip.file('kind.xml', `<KINDER>
    <KIND><KINDNR>1</KINDNR><STATUS>+</STATUS><GEBDATUM>01.01.2020</GEBDATUM><GRUNR>1</GRUNR></KIND>
    <KIND><KINDNR>2</KINDNR><STATUS>+</STATUS><GEBDATUM>01.01.2021</GEBDATUM><GRUNR>1</GRUNR></KIND>
    <KIND><KINDNR>3</KINDNR><STATUS>+</STATUS><GEBDATUM>01.01.2021</GEBDATUM><GRUNR>1</GRUNR></KIND>
  </KINDER>`);
  zip.file('gruppe.xml', '<GRUPPEN><GRUPPE><GRUNR>1</GRUNR><BEZ>Regelgruppe</BEZ></GRUPPE></GRUPPEN>');
  zip.file('belegung.xml', `<BELEGUNGEN>
    <BELEGUNGSBUCHUNG><IDNR>1</IDNR><KINDNR>1</KINDNR><BELVON>01.01.2026</BELVON><BELBIS>31.08.2026</BELBIS><ART>0</ART><SCHULKIND>.F.</SCHULKIND><ZEITKAT>05</ZEITKAT><ZEITEN>08:00|13:00</ZEITEN></BELEGUNGSBUCHUNG>
    <BELEGUNGSBUCHUNG><IDNR>2</IDNR><KINDNR>1</KINDNR><BELVON>01.09.2026</BELVON><BELBIS>31.12.2026</BELBIS><ART>0</ART><SCHULKIND>${schoolFlag}</SCHULKIND><ZEITKAT>05</ZEITKAT><GEWKAT>K</GEWKAT><PANTEIL>1</PANTEIL><BETRSTD>${betrstd}</BETRSTD><ZEITEN>|||</ZEITEN></BELEGUNGSBUCHUNG>
    <BELEGUNGSBUCHUNG><IDNR>3</IDNR><KINDNR>2</KINDNR><BELVON>01.01.2026</BELVON><BELBIS>31.12.2026</BELBIS><ART>0</ART><SCHULKIND>.F.</SCHULKIND></BELEGUNGSBUCHUNG>
    <BELEGUNGSBUCHUNG><IDNR>4</IDNR><KINDNR>1</KINDNR><BELVON>01.01.2026</BELVON><BELBIS>31.08.2026</BELBIS><ART>F</ART><SCHULKIND>.T.</SCHULKIND></BELEGUNGSBUCHUNG>
    <BELEGUNGSBUCHUNG><IDNR>5</IDNR><KINDNR>3</KINDNR><BELVON>01.01.2026</BELVON><BELBIS>31.12.2026</BELBIS><ART>F</ART><SCHULKIND>.F.</SCHULKIND></BELEGUNGSBUCHUNG>
    <BELEGUNGSBUCHUNG><IDNR>6</IDNR><KINDNR>999</KINDNR><ART>0</ART><SCHULKIND>.T.</SCHULKIND></BELEGUNGSBUCHUNG>
  </BELEGUNGEN>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function makeStore() {
  const store = configureStore({
    reducer: {
      simScenario: simScenarioReducer, simData: simDataReducer, simBooking: simBookingReducer,
      simGroup: simGroupReducer, simQualification: simQualificationReducer, simOverlay: simOverlayReducer,
      simFinance: simFinanceReducer, chart: chartReducer, events: eventReducer, datesOfInterest: datesOfInterestReducer,
    },
    preloadedState: { chart: { referenceDate: '2026-03-01', timedimension: 'month', chartToggles: [], filter: { Groups: [], Qualifications: [] }, chartData: {} } },
  });
  store.dispatch(addScenario({ id: 'test', name: 'Synthetisch' }));
  return store;
}

function monthCells(name) {
  const table = screen.getByTestId('adebis-monthly-details-table');
  const row = within(table).getByText(name).closest('tr');
  return within(row).getAllByRole('cell');
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function importedBookingsFor(store, externalId) {
  const state = store.getState();
  const child = Object.values(state.simData.dataByScenario.test).find((item) => item.adebisId.id === externalId);
  return Object.values(state.simBooking.bookingsByScenario.test[child.id]);
}

describe('ADEBIS Import-Wizard bis Monatsauswertung', () => {
  it('behält zeitlose Buchungen und berücksichtigt SCHULKIND nur in aktiven Basisbuchungen', async () => {
    const store = makeStore();
    const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
    const hook = renderHook(() => useScenarioImport(), { wrapper });
    const prepared = await hook.result.current.prepareImport({ file: await makeZip('.T.'), isAnonymized: true, importMode: 'historical' });
    expect(prepared.bookingsByExternalKey.get('kind:1')).toHaveLength(3);
    expect(prepared.bookingsByExternalKey.get('kind:999')).toHaveLength(1);
    expect(hook.result.current.getImportPreview(prepared).counts.considered).toBe(3);
    await act(async () => {
      await hook.result.current.applyImport({ preparedImport: prepared });
    });
    const state = store.getState();
    const children = Object.values(state.simData.dataByScenario.test);
    expect(children).toHaveLength(3);
    const first = children.find((child) => child.adebisId.id === '1');
    const bookings = Object.values(state.simBooking.bookingsByScenario.test[first.id]);
    expect(bookings).toHaveLength(3);
    const school = bookings.find((booking) => booking.adebisId.id === '2');
    expect(school).toMatchObject({
      startdate: '2026-09-01', enddate: '2026-12-31', times: [], buchungsart: { basis: true },
      rawdata: { ART: '0', SCHULKIND: '.T.', ZEITKAT: '05', GEWKAT: 'K', PANTEIL: '1', BETRSTD: '' },
    });
    expect(bookings.find((booking) => booking.adebisId.id === '4').buchungsart.basis).toBe(false);
    expect(Object.values(state.simBooking.bookingsByScenario.test).flatMap(Object.values)).toHaveLength(5);

    act(() => store.dispatch(setGroupFeeCatalogs({ scenarioId: 'test', catalogs: { '1': [
      { id: 'fee', zeitkatId: '05', monthlyAmount: 150, validFrom: '2026-01-01' },
    ] } })));
    render(<Provider store={store}><MantineProvider env="test"><FundingSimulationPanel /></MantineProvider></Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'ADEBIS-Details für 2026' }));
    await screen.findByTestId('adebis-monthly-details-table');
    const otherBookings = ['2', '3'].map((id) => importedBookingsFor(store, id).map(({ startdate, enddate, times, rawdata, buchungsart }) => ({ startdate, enddate, times, rawdata, buchungsart })));
    MONTHS.forEach((month, index) => {
      const cells = monthCells(month);
      expect(cells[1].textContent).toBe(index < 8 ? '1' : '0');
      expect(cells[20]).toHaveTextContent(index < 8 ? '200,00' : '100,00');
      if (index >= 8) expect(cells[5].textContent).toBe('0,00');
    });
    expect(screen.getByText(/Davon Elternbeitragszuschuss \(20 Kind-Monate\)/)).toBeTruthy();
    // Kind 1: 8 × (150 − 100) € + 4 × 150 €; Kind 2 ohne Tarif, Kind 3 nur Ferienbuchung.
    expect(screen.getByTestId('annual-contributions-2026')).toHaveTextContent('1.000,00');

    // Kontrollimport: nur das Schulkindmerkmal unterscheidet sich.
    await act(async () => {
      const withoutSchoolFlag = await hook.result.current.prepareImport({ file: await makeZip('.F.'), isAnonymized: true, importMode: 'historical' });
      expect(hook.result.current.getImportPreview(withoutSchoolFlag).counts).toMatchObject({ identical: 3, conflicts: 0 });
      await hook.result.current.applyImport({ preparedImport: withoutSchoolFlag });
    });
    MONTHS.forEach((month, index) => {
      const cells = monthCells(month);
      expect(cells[1].textContent).toBe(index < 8 ? '1' : '0');
      expect(cells[20]).toHaveTextContent('200,00');
      if (index >= 8) expect(cells[5].textContent).toBe('0,00');
    });
    expect(screen.getByText(/Davon Elternbeitragszuschuss \(24 Kind-Monate\)/)).toBeTruthy();
    // Kind 1 ist ganzjährig zuschussfähig: 12 × (150 − 100) €.
    expect(screen.getByTestId('annual-contributions-2026')).toHaveTextContent('600,00');
    expect(importedBookingsFor(store, '1').find((booking) => booking.adebisId.id === '2')).toMatchObject({
      times: [], rawdata: { SCHULKIND: '.F.', ZEITKAT: '05', BETRSTD: '' },
    });
    expect(['2', '3'].map((id) => importedBookingsFor(store, id).map(({ startdate, enddate, times, rawdata, buchungsart }) => ({ startdate, enddate, times, rawdata, buchungsart })))).toEqual(otherBookings);

    // Ein ausdrücklich exportierter BETRSTD bleibt auch ohne Segmente auswertbar.
    await act(async () => {
      const withHours = await hook.result.current.prepareImport({ file: await makeZip('.T.', '25,5'), isAnonymized: true, importMode: 'historical' });
      await hook.result.current.applyImport({ preparedImport: withHours, importOptions: { mergeMode: 'replace' } });
    });
    MONTHS.forEach((month, index) => {
      const cells = monthCells(month);
      expect(cells[1].textContent).toBe('1');
      expect(cells[20]).toHaveTextContent(index < 8 ? '200,00' : '100,00');
      if (index >= 8) expect(cells[5].textContent).toBe('5,10');
    });
    expect(screen.getByText(/Davon Elternbeitragszuschuss \(20 Kind-Monate\)/)).toBeTruthy();
    expect(screen.getByTestId('annual-contributions-2026')).toHaveTextContent('1.000,00');
    expect(importedBookingsFor(store, '1').find((booking) => booking.adebisId.id === '2')).toMatchObject({
      times: [], rawdata: { SCHULKIND: '.T.', ZEITKAT: '05', BETRSTD: '25,5' },
    });
    expect(['2', '3'].map((id) => importedBookingsFor(store, id).map(({ startdate, enddate, times, rawdata, buchungsart }) => ({ startdate, enddate, times, rawdata, buchungsart })))).toEqual(otherBookings);
    expect(store.getState().simFinance.financeByScenario.test.groupFeeCatalogs['1'][0]).toMatchObject({ zeitkatId: '05', monthlyAmount: 150 });
  });
});
