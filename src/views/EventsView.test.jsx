import React from 'react';
import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Provider } from 'react-redux';
import EventsView from './EventsView';

const scenarioId = 'events-filter-scenario';
const referenceDate = '2026-06-01';

function createTestStore() {
  const initialState = {
    simScenario: {
      selectedScenarioId: scenarioId,
      scenarios: [{ id: scenarioId, name: 'Ereignisfilter-Test' }],
    },
    simOverlay: { overlaysByScenario: {} },
    simData: {
      dataByScenario: {
        [scenarioId]: {
          'child-active-regel': {
            id: 'child-active-regel', type: 'demand', name: 'Marta Regel', startdate: '2025-01-01', groupId: 'regel',
          },
          'child-active-krippe': {
            id: 'child-active-krippe', type: 'demand', name: 'Berta Krippe', startdate: '2025-01-01', groupId: 'krippe',
          },
          'child-inactive': {
            id: 'child-inactive', type: 'demand', name: 'Ines Inaktiv', startdate: '2024-01-01', enddate: '2026-05-31', groupId: 'krippe',
          },
        },
      },
    },
    simBooking: { bookingsByScenario: {} },
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
      eventsByScenario: {
        [scenarioId]: [
          { id: 'event-regel', entityType: 'demand', entityId: 'child-active-regel', entityName: 'Marta Regel', type: 'group_assignment_start', effectiveDate: '2026-07-01', description: 'Wechsel Regelgruppe' },
          { id: 'event-krippe', entityType: 'demand', entityId: 'child-active-krippe', entityName: 'Berta Krippe', type: 'group_assignment_start', effectiveDate: '2026-07-02', description: 'Wechsel Krippe' },
          { id: 'event-inactive', entityType: 'demand', entityId: 'child-inactive', entityName: 'Ines Inaktiv', type: 'group_assignment_start', effectiveDate: '2026-07-03', description: 'Wechsel inaktiv' },
          { id: 'event-staff', entityType: 'capacity', entityId: 'staff-1', entityName: 'Erzieher Team', type: 'presence_start', effectiveDate: '2026-07-04', description: 'Dienstbeginn' },
        ],
      },
    },
  };

  return configureStore({ reducer: (state = initialState) => state });
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
  it('shows the stichtag and filters children by active status, name, and current group', async () => {
    renderEventsView();

    expect(screen.getByTestId('events-filter-reference-date')).toHaveTextContent('01.06.2026');
    expect(screen.getByText('Ines Inaktiv')).toBeInTheDocument();

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
