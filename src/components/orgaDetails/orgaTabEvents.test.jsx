import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import OrgaTabEvents from './orgaTabEvents';
import simScenarioReducer from '../../store/simScenarioSlice';
import simDataReducer from '../../store/simDataSlice';
import simBookingReducer from '../../store/simBookingSlice';
import simGroupReducer from '../../store/simGroupSlice';
import eventReducer from '../../store/eventSlice';

function getInputValue(testId) {
  const element = screen.getByTestId(testId);
  const input = element.tagName === 'INPUT' ? element : element.querySelector('input');
  return input?.value;
}

function segment(booking_start, booking_end, category = 'pedagogical') {
  return { booking_start, booking_end, category };
}

function booking(id, startdate, enddate, segments) {
  return {
    id,
    startdate,
    enddate,
    times: [
      {
        day: 1,
        day_name: 'Mo',
        segments,
      },
    ],
  };
}

function createTestStore() {
  return configureStore({
    reducer: {
      simScenario: simScenarioReducer,
      simData: simDataReducer,
      simBooking: simBookingReducer,
      simGroup: simGroupReducer,
      events: eventReducer,
    },
    preloadedState: {
      simScenario: {
        scenarios: [
          {
            id: 'scenario-1',
            name: 'Szenario 1',
            autoEventSettings: {
              kita: { ageYears: 3, bookingDeltaHours: 0 },
              school: { ageYears: 6, bookingDeltaHours: 0 },
            },
          },
        ],
        selectedScenarioId: 'scenario-1',
        selectedItems: { 'scenario-1': null },
        saveDialogOpen: false,
        loadDialogOpen: false,
      },
      simData: {
        dataByScenario: {
          'scenario-1': {
            child1: {
              id: 'child1',
              name: 'Mia',
              type: 'demand',
              startdate: '2022-01-01',
              enddate: '',
              dateofbirth: '2020-07-01',
            },
          },
        },
      },
      simBooking: {
        bookingsByScenario: {
          'scenario-1': {
            child1: {
              b1: booking('b1', '2022-01-01', '2023-06-30', [segment('08:00', '10:00')]),
              b2: booking('b2', '2023-07-01', '2025-12-31', [segment('08:00', '12:00')]),
              b3: booking('b3', '2026-01-01', '', [segment('08:00', '11:00')]),
            },
          },
        },
      },
      simGroup: {
        groupDefsByScenario: {
          'scenario-1': [
            { id: 'g1', name: 'Krippe', type: 'Krippe' },
            { id: 'g2', name: 'Kita', type: 'Regelgruppe' },
            { id: 'g3', name: 'Schulkind', type: 'Schulkindgruppe' },
          ],
        },
        groupsByScenario: {
          'scenario-1': {
            child1: {
              ga1: { id: 'ga1', groupId: 'g1', start: '2022-01-01', end: '2023-06-30' },
              ga2: { id: 'ga2', groupId: 'g2', start: '2023-07-01', end: '2025-12-31' },
              ga3: { id: 'ga3', groupId: 'g3', start: '2026-01-01', end: '' },
            },
          },
        },
      },
      events: {
        eventsByScenario: {},
        disabledEventIdsByScenario: {},
        _needsRefresh: false,
      },
    },
  });
}

describe('OrgaTabEvents', () => {
  it('adopts transition values from statistics into the auto-event form and scenario settings', () => {
    const store = createTestStore();

    render(
      <MantineProvider>
        <Provider store={store}>
          <OrgaTabEvents />
        </Provider>
      </MantineProvider>
    );

    fireEvent.click(screen.getByTestId('auto-events-bind-statistics'));

    expect(getInputValue('auto-events-kita-age')).toBe('3');
    expect(getInputValue('auto-events-kita-delta')).toBe('2');
    expect(getInputValue('auto-events-school-age')).toBe('5.5');
    expect(getInputValue('auto-events-school-delta')).toBe('-1');

    const scenario = store.getState().simScenario.scenarios[0];
    expect(scenario.autoEventSettings).toMatchObject({
      kita: { ageYears: 3, bookingDeltaHours: 2 },
      school: { ageYears: 5.5, bookingDeltaHours: -1 },
    });
    expect(scenario.autoEventSettings.statisticsBinding?.snapshot).toMatchObject({
      kita: { ageYears: 3, bookingDeltaHours: 2 },
      school: { ageYears: 5.5, bookingDeltaHours: -1 },
    });
  });
});
