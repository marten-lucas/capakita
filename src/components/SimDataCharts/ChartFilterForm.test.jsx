import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import { createAppStore } from '../../store/store';
import { setFilterGroups, setFilterQualifications } from '../../store/chartSlice';
import { setSelectedScenarioId } from '../../store/simScenarioSlice';
import { addGroupDef } from '../../store/simGroupSlice';
import ChartFilterForm from './ChartFilterForm';

function makeStore() {
  return createAppStore({ preloadedState: {
    simScenario: { scenarios: [{ id: 'one' }, { id: 'two' }], selectedScenarioId: 'one', selectedItems: {} },
    simGroup: { groupDefsByScenario: { one: [{ id: 'g1', name: 'Gruppe Eins' }] }, groupsByScenario: {} },
  } });
}

function renderForm(store, props = {}) {
  return render(<Provider store={store}><MantineProvider><ChartFilterForm scenarioId="one" drawerOpened {...props} /></MantineProvider></Provider>);
}

describe('ChartFilterForm Monte-Carlo', () => {
  it('übernimmt 100 Läufe und explizite Null für Ausfallwahrscheinlichkeit und Tagesmaximum', () => {
    const onChange = vi.fn();
    renderForm(makeStore(), { showMonteCarloControls: true, monteCarloParams: { runs: 1200, baseAbsenceProbabilityPct: 14, maxConcurrentOutages: 3 }, onMonteCarloParamsChange: onChange });
    fireEvent.change(screen.getByLabelText('Läufe'), { target: { value: '100' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ runs: 100 }));
    fireEvent.change(screen.getByLabelText('Basis-Ausfallwahrscheinlichkeit pro Person und Betriebstag (%)'), { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ baseAbsenceProbabilityPct: 0 }));
    fireEvent.change(screen.getByLabelText('Max. Ausfälle pro Betriebstag'), { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxConcurrentOutages: 0 }));
  });
});

describe('ChartFilterForm Gruppenfilter', () => {
  it('behält die bisherige Vorauswahl und Qualifikationsinitialisierung ohne Opt-in', async () => {
    const store = makeStore();
    renderForm(store);
    await waitFor(() => expect(store.getState().chart.one.filter.Groups).toEqual(['g1', '__NO_GROUP__']));
    expect(store.getState().chart.one.filter.Qualifications).toEqual(['__NO_QUALI__']);
  });

  it('erlaubt leere Gruppen dauerhaft und erhält vorhandene Auswahl und Qualifikationsdefault', async () => {
    const store = makeStore();
    store.dispatch(setFilterGroups({ scenarioId: 'one', groups: ['g1'] }));
    const view = renderForm(store, { allowEmptyGroups: true });
    expect(store.getState().chart.one.filter.Groups).toEqual(['g1']);
    expect(store.getState().chart.one.filter.Qualifications).toEqual(['__NO_QUALI__']);
    expect(await screen.findByText(/Keine Auswahl: alle Gruppen/)).toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: 'Gruppen' });
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace' });
    await waitFor(() => expect(store.getState().chart.one.filter.Groups).toEqual([]));
    view.unmount();
    renderForm(store, { allowEmptyGroups: true });
    expect(store.getState().chart.one.filter.Groups).toEqual([]);
    expect(screen.getByPlaceholderText('Alle Gruppen (kein Filter)')).toBeInTheDocument();
    act(() => store.dispatch(addGroupDef({ scenarioId: 'one', groupDef: { id: 'g2', name: 'Neue Gruppe' } })));
    expect(store.getState().chart.one.filter.Groups).toEqual([]);
  });

  it('deaktiviert nicht anwendbare Filter ohne gespeicherte Auswahl zu ändern', () => {
    const store = makeStore();
    store.dispatch(setFilterGroups({ scenarioId: 'one', groups: ['g1'] }));
    store.dispatch(setFilterQualifications({ scenarioId: 'one', qualifications: ['__NO_QUALI__'] }));
    const props = { allowEmptyGroups: true, allowEmptyQualifications: true, groupFilterDisabled: true, qualificationFilterDisabled: true, groupFilterDescription: 'Gruppen nicht anwendbar', qualificationFilterDescription: 'Qualifikationen nicht anwendbar' };
    const view = renderForm(store, props);
    expect(screen.getByRole('combobox', { name: 'Gruppen' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Qualifikationen' })).toBeDisabled();
    expect(screen.getByText('Gruppen nicht anwendbar')).toBeInTheDocument();
    expect(screen.getByText('Qualifikationen nicht anwendbar')).toBeInTheDocument();
    view.rerender(<Provider store={store}><MantineProvider><ChartFilterForm scenarioId="one" drawerOpened allowEmptyGroups allowEmptyQualifications /></MantineProvider></Provider>);
    expect(screen.getByRole('combobox', { name: 'Gruppen' })).not.toBeDisabled();
    expect(store.getState().chart.one.filter.Groups).toEqual(['g1']);
    expect(store.getState().chart.one.filter.Qualifications).toEqual(['__NO_QUALI__']);
  });

  it('bewahrt den Gruppenfilter beim Szenariowechsel getrennt', () => {
    const store = makeStore();
    store.dispatch(setFilterGroups({ scenarioId: 'one', groups: [] }));
    store.dispatch(setFilterGroups({ scenarioId: 'two', groups: ['__NO_GROUP__'] }));
    const view = renderForm(store, { allowEmptyGroups: true });
    act(() => store.dispatch(setSelectedScenarioId('two')));
    view.rerender(<Provider store={store}><MantineProvider><ChartFilterForm scenarioId="two" drawerOpened allowEmptyGroups /></MantineProvider></Provider>);
    expect(store.getState().chart.two.filter.Groups).toEqual(['__NO_GROUP__']);
    act(() => store.dispatch(setSelectedScenarioId('one')));
    view.rerender(<Provider store={store}><MantineProvider><ChartFilterForm scenarioId="one" drawerOpened allowEmptyGroups /></MantineProvider></Provider>);
    expect(store.getState().chart.one.filter.Groups).toEqual([]);
  });
});
