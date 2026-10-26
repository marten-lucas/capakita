import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import SimDataFamilySection from './SimDataFamilySection';
import simScenarioReducer from '../../store/simScenarioSlice';
import simDataReducer from '../../store/simDataSlice';
import simBookingReducer from '../../store/simBookingSlice';
import simGroupReducer from '../../store/simGroupSlice';
import simQualificationReducer from '../../store/simQualificationSlice';
import simOverlayReducer from '../../store/simOverlaySlice';
import chartReducer from '../../store/chartSlice';

function createTestStore({ selectedItemId, dataItems, groupDefs = [] }) {
  return configureStore({
    reducer: {
      simScenario: simScenarioReducer,
      simData: simDataReducer,
      simBooking: simBookingReducer,
      simGroup: simGroupReducer,
      simQualification: simQualificationReducer,
      simOverlay: simOverlayReducer,
      chart: chartReducer,
    },
    preloadedState: {
      simScenario: {
        scenarios: [{ id: 'scenario-1', name: 'Szenario 1' }],
        selectedScenarioId: 'scenario-1',
        selectedItems: { 'scenario-1': [selectedItemId] },
        saveDialogOpen: false,
        loadDialogOpen: false,
      },
      simData: {
        dataByScenario: { 'scenario-1': dataItems },
      },
      simGroup: {
        groupDefsByScenario: { 'scenario-1': groupDefs },
        groupsByScenario: { 'scenario-1': {} },
      },
    },
  });
}

function renderSection(store) {
  const item = store.getState().simData.dataByScenario['scenario-1'][
    store.getState().simScenario.selectedItems['scenario-1'][0]
  ];
  return render(
    <Provider store={store}>
      <MantineProvider>
        <SimDataFamilySection item={item} />
      </MantineProvider>
    </Provider>
  );
}

const familyItems = {
  'child-1': {
    id: 'child-1',
    type: 'demand',
    name: 'Erkan Reuter',
    dateofbirth: '2019-11-19',
    groupId: 'g1',
    familyId: 'fam-1',
    familyLabel: 'Familie Reuter',
    familySource: 'erzber',
    absences: [],
  },
  'child-2': {
    id: 'child-2',
    type: 'demand',
    name: 'Ingrid Reuter',
    dateofbirth: '2017-07-13',
    groupId: 'g2',
    familyId: 'fam-1',
    familyLabel: 'Familie Reuter',
    familySource: 'erzber',
    absences: [],
  },
  'child-3': {
    id: 'child-3',
    type: 'demand',
    name: 'Agathe Berger',
    dateofbirth: '2018-01-01',
    groupId: 'g1',
    familyId: 'fam-2',
    familyLabel: 'Familie Berger',
    familySource: 'haushalt',
    absences: [],
  },
};

describe('SimDataFamilySection', () => {
  it('zeigt Geschwister und springt bei Klick zum Datensatz', () => {
    const store = createTestStore({
      selectedItemId: 'child-1',
      dataItems: familyItems,
      groupDefs: [
        { id: 'g1', name: 'Fuchs' },
        { id: 'g2', name: 'Bär' },
      ],
    });
    renderSection(store);

    expect(screen.getByText('Familie & Geschwister')).toBeTruthy();
    expect(screen.getByText('Familie Reuter')).toBeTruthy();
    expect(screen.getByText('Quelle: erzber (Erziehungsberechtigte)')).toBeTruthy();
    expect(screen.getByText('Ingrid Reuter')).toBeTruthy();
    expect(screen.queryByText('Agathe Berger')).toBeNull();
    expect(screen.getByText('Bär')).toBeTruthy();

    fireEvent.click(screen.getByTestId('sibling-jump-child-2'));
    expect(store.getState().simScenario.selectedItems['scenario-1']).toEqual(['child-2']);
  });

  it('erklärt das Fehlen von Familiendaten', () => {
    const store = createTestStore({
      selectedItemId: 'child-1',
      dataItems: {
        'child-1': { id: 'child-1', type: 'demand', name: 'Erkan', familyId: '', absences: [] },
      },
    });
    renderSection(store);

    expect(screen.getByText(/Keine Geschwister erkannt/)).toBeTruthy();
  });

  it('rendert nichts für Mitarbeiter', () => {
    const store = createTestStore({
      selectedItemId: 'staff-1',
      dataItems: {
        'staff-1': { id: 'staff-1', type: 'capacity', name: 'Anna', absences: [] },
      },
    });
    renderSection(store);
    expect(screen.queryByText('Familie & Geschwister')).toBeNull();
  });
});
