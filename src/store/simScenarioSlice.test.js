import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import simScenarioReducer, { importScenario } from './simScenarioSlice';
import simDataReducer from './simDataSlice';
import simBookingReducer from './simBookingSlice';
import simGroupReducer from './simGroupSlice';
import simQualificationReducer from './simQualificationSlice';
import simOverlayReducer from './simOverlaySlice';
import simFinanceReducer from './simFinanceSlice';
import chartReducer from './chartSlice';
import eventReducer from './eventSlice';
import datesOfInterestReducer from './datesOfInterestSlice';
import { selectSelectedScenarioHasAdebisImport } from './simScenarioSlice';

describe('simScenario selectors', () => {
  it('returns false when no scenario is selected', () => {
    const state = {
      simScenario: {
        selectedScenarioId: null,
        scenarios: [],
      },
    };

    expect(selectSelectedScenarioHasAdebisImport(state)).toBe(false);
  });

  it('returns false for selected manual scenario', () => {
    const state = {
      simScenario: {
        selectedScenarioId: 's1',
        scenarios: [
          { id: 's1', imported: false },
          { id: 's2', imported: true },
        ],
      },
    };

    expect(selectSelectedScenarioHasAdebisImport(state)).toBe(false);
  });

  it('returns true for selected imported scenario', () => {
    const state = {
      simScenario: {
        selectedScenarioId: 's2',
        scenarios: [
          { id: 's1', imported: false },
          { id: 's2', imported: true },
        ],
      },
    };

    expect(selectSelectedScenarioHasAdebisImport(state)).toBe(true);
  });

  it('refreshes events after importScenario loads data', async () => {
    const store = configureStore({
      reducer: {
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
    });

    await store.dispatch(importScenario({
      scenarioSettings: {
        name: 'Import Scenario',
        imported: true,
        importedAnonymized: false,
      },
      simDataList: [
        {
          id: 'external-child-1',
          type: 'demand',
          name: 'Kinder A',
          startdate: '2024-01-01',
          enddate: '',
          dateofbirth: '2020-01-01',
          absences: [],
          rawdata: { KINDNR: '1001' },
          adebisId: { id: '1001', source: 'kind' },
        },
      ],
      bookings: [
        {
          id: 'booking-1',
          startdate: '2024-01-01',
          enddate: '',
          times: [{ day: 1, day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '12:00' }] }],
          adebisId: { id: '2001', source: 'belegung' },
        },
      ],
      bookingReference: [
        { bookingKey: 'booking-1', adebisId: { id: '1001', source: 'kind' } },
      ],
      groupDefs: [
        { id: 'g1', name: 'Krippe', type: 'Krippe' },
      ],
      qualiDefs: [],
      groupAssignments: [
        { id: 'ga1', kindId: 'external-child-1', groupId: 'g1', start: '2024-01-01', end: '', rawdata: { KINDNR: '1001' } },
      ],
    }));

    const state = store.getState();
    const scenarioId = state.simScenario.selectedScenarioId;
    const events = state.events.eventsByScenario[scenarioId] || [];

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'group_assignment_start')).toBe(true);
    expect(events.some((event) => event.type === 'booking_start')).toBe(true);
    expect(events.some((event) => event.type === 'auto_group_transition')).toBe(true);
  });
});
