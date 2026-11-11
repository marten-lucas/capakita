import React from 'react';
import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import EventsView from './EventsView';
import SimDataEventsTab from '../components/SimDataDetail/SimDataEventsTab';
import simScenarioReducer from '../store/simScenarioSlice';
import simDataReducer from '../store/simDataSlice';
import simBookingReducer from '../store/simBookingSlice';
import simGroupReducer from '../store/simGroupSlice';
import simQualificationReducer from '../store/simQualificationSlice';
import simOverlayReducer from '../store/simOverlaySlice';
import chartReducer from '../store/chartSlice';
import eventReducer from '../store/eventSlice';

const scenarioId = 'events-filter-scenario';
const referenceDate = '2026-06-01';

function createTestStore({ selectedItemId = null } = {}) {
  const initialState = {
    simScenario: {
      selectedScenarioId: scenarioId,
      selectedItems: { [scenarioId]: selectedItemId ? [selectedItemId] : [] },
      scenarios: [{ id: scenarioId, name: 'Ereignisfilter-Test' }],
    },
    simOverlay: { overlaysByScenario: {} },
    simData: {
      dataByScenario: {
        [scenarioId]: {
          'child-active-regel': {
            id: 'child-active-regel', type: 'demand', name: 'Marta Regel', dateofbirth: '2021-03-01', startdate: '2025-01-01', groupId: 'regel',
          },
          'child-active-krippe': {
            id: 'child-active-krippe', type: 'demand', name: 'Berta Krippe', dateofbirth: '2024-02-01', startdate: '2025-01-01', groupId: 'krippe',
          },
          'child-inactive': {
            id: 'child-inactive', type: 'demand', name: 'Ines Inaktiv', dateofbirth: '2020-01-01', startdate: '2024-01-01', enddate: '2026-05-31', groupId: 'krippe',
          },
          'staff-1': {
            id: 'staff-1', type: 'capacity', name: 'Erzieher Team', startdate: '2024-01-01',
          },
        },
      },
    },
    simBooking: { bookingsByScenario: { [scenarioId]: {} } },
    simGroup: {
      groupDefsByScenario: {
        [scenarioId]: [
          { id: 'regel', name: 'Regelgruppe', type: 'Regelgruppe' },
          { id: 'krippe', name: 'Krippe', type: 'Krippe' },
        ],
      },
      groupsByScenario: {
        [scenarioId]: {
          'child-active-regel': { a: { id: 'a', groupId: 'regel', start: '2025-01-01', end: '' } },
          'child-active-krippe': { b: { id: 'b', groupId: 'krippe', start: '2025-01-01', end: '' } },
          'child-inactive': { c: { id: 'c', groupId: 'krippe', start: '2024-01-01', end: '2026-05-31' } },
        },
      },
    },
    simQualification: { qualificationDefsByScenario: {}, qualificationAssignmentsByScenario: {} },
    chart: { [scenarioId]: { referenceDate } },
    events: {
      eventsByScenario: {},
      disabledEventIdsByScenario: {},
      _needsRefresh: true,
    },
  };

  return configureStore({
    reducer: {
      simScenario: simScenarioReducer,
      simData: simDataReducer,
      simBooking: simBookingReducer,
      simGroup: simGroupReducer,
      simQualification: simQualificationReducer,
      simOverlay: simOverlayReducer,
      chart: chartReducer,
      events: eventReducer,
    },
    preloadedState: initialState,
  });
}

function renderEventsView() {
  return render(
    <Provider store={createTestStore()}>
      <MantineProvider>
        <EventsView />
      </MantineProvider>
    </Provider>
  );
}

describe('EventsView filters', () => {
  it('shows the selected child event history split into read-only real and automatic tabs', async () => {
    render(
      <Provider store={createTestStore({ selectedItemId: 'child-active-krippe' })}>
        <MantineProvider>
          <SimDataEventsTab />
        </MantineProvider>
      </Provider>
    );

    expect(await screen.findByText('Gruppenzuweisung beginnt (krippe)')).toBeInTheDocument();
    expect(screen.queryByText('Automatischer Gruppenwechsel: Krippe → Kita')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/^Automatische/));
    expect(await screen.findByText('Automatischer Gruppenwechsel: Krippe → Kita')).toBeInTheDocument();
    expect(screen.queryByText('Gruppenzuweisung beginnt (krippe)')).not.toBeInTheDocument();
  });

  it('shows the stichtag and filters children by active status, name, and current group', async () => {
    renderEventsView();

    expect(screen.getByTestId('events-filter-reference-date')).toHaveTextContent('01.06.2026');
    expect(await screen.findByText('Ines Inaktiv')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Nur aktive Kinder'));
    expect(screen.getByText('Marta Regel')).toBeInTheDocument();
    expect(screen.getByText('Berta Krippe')).toBeInTheDocument();
    expect(screen.queryByText('Ines Inaktiv')).not.toBeInTheDocument();
    expect(screen.getByText('Erzieher Team')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name filtern'), { target: { value: 'marta' } });
    expect(screen.getByText('Marta Regel')).toBeInTheDocument();
    expect(screen.queryByText('Berta Krippe')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name filtern'), { target: { value: '' } });
    const groupInput = screen.getAllByLabelText('Aktuelle Gruppen')[0];
    fireEvent.click(groupInput);
    fireEvent.click(await screen.findByRole('option', { name: 'Krippe' }));

    expect(screen.getByText('Berta Krippe')).toBeInTheDocument();
    expect(screen.queryByText('Marta Regel')).not.toBeInTheDocument();
  });
});
