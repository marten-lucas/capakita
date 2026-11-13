import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import OrgaTabGroupDefs from './orgaTabGroupDefs';
import simGroupReducer, { loadGroupDefsByScenario } from '../../store/simGroupSlice';
import simOverlayReducer from '../../store/simOverlaySlice';

const scenarios = [{ id: 'base' }, { id: 'child', baseScenarioId: 'base' }];
const originalGroups = [
  { id: 'g1', name: 'Krippe Bären', type: 'Regelgruppe' },
  { id: 'g2', name: 'Mischgruppe', type: 'Regelgruppe' },
];

function makeStore(selectedScenarioId = 'base', groupState, overlayState) {
  return configureStore({
    reducer: {
      simScenario: (state = { scenarios, selectedScenarioId }) => state,
      simGroup: simGroupReducer,
      simOverlay: simOverlayReducer,
      simData: (state = { dataByScenario: {} }) => state,
      simBooking: (state = { bookingsByScenario: {} }) => state,
      simQualification: (state = { qualificationDefsByScenario: {}, qualificationAssignmentsByScenario: {} }) => state,
    },
    preloadedState: {
      simGroup: groupState || { groupDefsByScenario: { base: originalGroups }, groupsByScenario: {} },
      simOverlay: overlayState || { overlaysByScenario: {} },
    },
  });
}

function show(store) {
  return render(<MantineProvider><Provider store={store}><OrgaTabGroupDefs /></Provider></MantineProvider>);
}

function selectStage(label) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Stufe für die Prognose' }));
  fireEvent.click(screen.getByRole('option', { name: label }));
}

describe('forecast stage group editor', () => {
  it('shows the unconfirmed estimate, saves a separate stage, and restores it on reload', () => {
    const store = makeStore();
    const view = show(store);
    expect(screen.getByText('Prognose verwendet: Krippe (automatische Schätzung, nicht bestätigt)')).toBeInTheDocument();
    selectStage('Schulkindbetreuung');
    expect(screen.getByText('Prognose verwendet: Schulkindbetreuung (ausgewählt)')).toBeInTheDocument();
    expect(store.getState().simGroup.groupDefsByScenario.base[0]).toMatchObject({ type: 'Regelgruppe', forecastStage: 'school' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Gruppentyp' }));
    fireEvent.click(screen.getByRole('option', { name: 'Krippe (0-3 Jahre)' }));
    expect(store.getState().simGroup.groupDefsByScenario.base[0]).toMatchObject({ type: 'Krippe', forecastStage: 'school' });
    const persisted = JSON.parse(JSON.stringify(store.getState().simGroup.groupDefsByScenario));
    view.unmount();
    const reloaded = makeStore('base', { groupDefsByScenario: {}, groupsByScenario: {} });
    reloaded.dispatch(loadGroupDefsByScenario(persisted));
    show(reloaded);
    expect(screen.getByRole('combobox', { name: 'Stufe für die Prognose' })).toHaveValue('Schulkindbetreuung');
    selectStage('Ungeklärt (bewusst offen)');
    expect(screen.getByText('Prognose verwendet: Ungeklärt (ausgewählt)')).toBeInTheDocument();
    expect(reloaded.getState().simGroup.groupDefsByScenario.base[0].forecastStage).toBe('unknown');
    selectStage('Automatisch (nicht bestätigt)');
    expect(screen.getByText('Prognose verwendet: Krippe (automatische Schätzung, nicht bestätigt)')).toBeInTheDocument();
    expect(reloaded.getState().simGroup.groupDefsByScenario.base[0].forecastStage).toBe('auto');
  });

  it('shows mixed groups as unresolved and preserves the base when selecting in a derived scenario', () => {
    const store = makeStore('child');
    show(store);
    fireEvent.click(screen.getByTestId('data-list-item-g2'));
    expect(screen.getByText(/Die Auswahl erstellt eine eigene Kopie aller Gruppen/)).toBeInTheDocument();
    expect(screen.getByText('Prognose verwendet: Ungeklärt (automatische Schätzung, nicht bestätigt)')).toBeInTheDocument();
    selectStage('Ungeklärt (bewusst offen)');
    expect(store.getState().simGroup.groupDefsByScenario.base[1].forecastStage).toBeUndefined();
    expect(store.getState().simGroup.groupDefsByScenario.child).toHaveLength(2);
    expect(store.getState().simGroup.groupDefsByScenario.child[1]).toMatchObject({ forecastStage: 'unknown', type: 'Regelgruppe' });
    expect(screen.getByText('Prognose verwendet: Ungeklärt (ausgewählt)')).toBeInTheDocument();
  });

  it('starts new groups in automatic mode without confirming the default type', () => {
    const store = makeStore();
    show(store);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Gruppe' }));
    expect(store.getState().simGroup.groupDefsByScenario.base[2]).toMatchObject({ type: 'Regelgruppe', forecastStage: 'auto' });
  });

  it('updates an existing group overlay without changing the underlying groups', () => {
    const store = makeStore('child', undefined, { overlaysByScenario: { child: { groupDefs: originalGroups } } });
    show(store);
    selectStage('Krippe');
    expect(store.getState().simOverlay.overlaysByScenario.child.groupDefs[0].forecastStage).toBe('krippe');
    expect(store.getState().simGroup.groupDefsByScenario.base[0].forecastStage).toBeUndefined();
    expect(screen.getByText('Prognose verwendet: Krippe (ausgewählt)')).toBeInTheDocument();
  });
});
