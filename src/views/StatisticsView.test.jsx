import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import StatisticsView from './StatisticsView';
import simScenarioReducer from '../store/simScenarioSlice';
import simDataReducer from '../store/simDataSlice';
import simBookingReducer from '../store/simBookingSlice';
import simGroupReducer from '../store/simGroupSlice';
import simQualificationReducer from '../store/simQualificationSlice';
import simOverlayReducer from '../store/simOverlaySlice';
import simFinanceReducer from '../store/simFinanceSlice';
import chartReducer from '../store/chartSlice';
import eventReducer from '../store/eventSlice';
import datesOfInterestReducer from '../store/datesOfInterestSlice';
import uiReducer from '../store/uiSlice';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function createTestStore(options = {}) {
  const { analysisStoryDeckEnabled = true } = options;
  return configureStore({
    reducer: {
      ui: uiReducer,
      simScenario: simScenarioReducer,
      simData: simDataReducer,
      simBooking: simBookingReducer,
      simGroup: simGroupReducer,
      simQualification: simQualificationReducer,
      simOverlay: simOverlayReducer,
      simFinance: simFinanceReducer,
      chart: chartReducer,
      events: eventReducer,
      datesOfInterest: datesOfInterestReducer,
    },
    preloadedState: {
      ui: {
        activePage: 'statistics',
        browserAutoSaveEnabled: false,
        dataListFilter: 'all',
        dataCaptureQueueMode: false,
        analysisStoryDeckEnabled,
      },
      simScenario: {
        scenarios: [
          {
            id: 'scenario-1',
            name: 'Analyse-Szenario',
            remark: 'Druckbericht für die Verwaltung',
            baseScenarioId: 'scenario-base',
            autoEventSettings: {
              statisticsBinding: {
                appliedAt: '2026-05-21',
                snapshot: {
                  kita: { ageYears: 3, bookingDeltaHours: 2 },
                  school: { ageYears: 5.5, bookingDeltaHours: -1 },
                },
              },
            },
          },
          {
            id: 'scenario-base',
            name: 'Basis-Szenario',
          },
        ],
        selectedScenarioId: 'scenario-1',
        selectedItems: { 'scenario-1': [] },
        saveDialogOpen: false,
        loadDialogOpen: false,
      },
      simData: { dataByScenario: { 'scenario-1': {} } },
      simBooking: { bookingsByScenario: { 'scenario-1': {} } },
      simGroup: {
        groupDefsByScenario: {
          'scenario-1': [],
        },
        groupsByScenario: { 'scenario-1': {} },
      },
      simQualification: {
        qualificationDefsByScenario: {},
        qualificationAssignmentsByScenario: {},
      },
      simOverlay: { overlaysByScenario: {} },
      simFinance: {
        financeByScenario: {
          'scenario-1': {
            settings: {
              partialAbsenceThresholdDays: 42,
              partialAbsenceEmployerSharePercent: 0,
            },
            bayKiBiGRules: [],
            groupFeeCatalogs: {},
            itemFinances: {},
          },
        },
      },
      chart: {
        'scenario-1': {
          referenceDate: '2026-05-21',
        },
      },
      events: {
        eventsByScenario: {},
        disabledEventIdsByScenario: {},
        _needsRefresh: false,
      },
      datesOfInterest: {
        datesByScenario: {},
      },
    },
  });
}

describe('StatisticsView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders story deck mode by default and supports PDF export', () => {
    const store = createTestStore();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <Provider store={store}>
        <MantineProvider>
          <StatisticsView />
        </MantineProvider>
      </Provider>
    );

    expect(screen.getByText('Analyse-Story')).toBeInTheDocument();
    expect(screen.getByTestId('statistics-storydeck-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Als PDF exportieren/i })).toBeInTheDocument();

    screen.getByRole('button', { name: /Als PDF exportieren/i }).click();

    expect(printSpy).toHaveBeenCalledOnce();
  });

  it('falls back to legacy statistics view when story deck is disabled', () => {
    const store = createTestStore({ analysisStoryDeckEnabled: false });

    render(
      <Provider store={store}>
        <MantineProvider>
          <StatisticsView />
        </MantineProvider>
      </Provider>
    );

    expect(screen.getByTestId('statistics-view')).toBeInTheDocument();
    expect(screen.getByText('Statistik')).toBeInTheDocument();
  });
});