import React from 'react';
import '@testing-library/jest-dom/vitest';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import EventPicker from './EventPicker';
import chartReducer, { ensureScenario, setReferenceDate } from '../../store/chartSlice';
import eventReducer, { refreshEventsForScenario } from '../../store/eventSlice';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

function createTestStore() {
  return configureStore({
    reducer: {
      chart: chartReducer,
      events: eventReducer,
    },
  });
}

function seedScenario(store, scenarioId) {
  store.dispatch(ensureScenario(scenarioId));
  store.dispatch(setReferenceDate({ scenarioId, date: '2099-01-15' }));
  store.dispatch(
    refreshEventsForScenario({
      scenarioId,
      simData: {
        dataByScenario: {
          [scenarioId]: {
            kidA: {
              type: 'demand',
              name: 'Kind A',
              startdate: '2099-01-01',
            },
            kidB: {
              type: 'demand',
              name: 'Kind B',
              startdate: '2099-01-15',
            },
          },
        },
      },
      simBooking: {
        bookingsByScenario: {
          [scenarioId]: {},
        },
      },
      simGroup: {
        groupsByScenario: {
          [scenarioId]: {},
        },
      },
    })
  );
}

describe('EventPicker', () => {
  it('synchronizes the calendar and the side panel', async () => {
    const store = createTestStore();
    const scenarioId = 'scenario-1';
    seedScenario(store, scenarioId);

    render(
      <Provider store={store}>
        <MantineProvider>
          <DatesProvider settings={{ locale: 'de' }}>
            <EventPicker scenarioId={scenarioId} />
          </DatesProvider>
        </MantineProvider>
      </Provider>
    );

    expect(screen.getByTestId('stichtag-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('stichtag-timeline-toggle'));
    expect(await screen.findByTestId('stichtag-timeline')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('stichtag-timeline-item-2099-01-01'));

    expect(screen.getByTestId('stichtag-input')).toHaveTextContent('01.01.2099');

    fireEvent.click(screen.getByTestId('stichtag-input'));

    const selectedDay = await screen.findByRole('button', { name: '2099-01-15', hidden: true });
    fireEvent.click(selectedDay);

    expect(screen.getByTestId('stichtag-input')).toHaveTextContent('15.01.2099');
  });
});
