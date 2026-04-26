import { describe, expect, it } from 'vitest';
import eventReducer, { refreshAllEvents } from './eventSlice';

describe('eventSlice automatic transitions', () => {
  const scenarioId = 'scenario-1';

  it('uses configured auto-event timing and booking delta metadata from scenario settings', () => {
    const state = eventReducer(
      undefined,
      refreshAllEvents({
        simScenario: {
          scenarios: [
            {
              id: scenarioId,
              autoEventSettings: {
                kita: { ageYears: 2.5, bookingDeltaHours: 1.5 },
                school: { ageYears: 6.5, bookingDeltaHours: -1 },
              },
            },
          ],
        },
        simData: {
          dataByScenario: {
            [scenarioId]: {
              child1: {
                id: 'child1',
                name: 'Mia',
                type: 'demand',
                dateofbirth: '2020-01-15',
              },
            },
          },
        },
        simBooking: { bookingsByScenario: { [scenarioId]: {} } },
        simGroup: { groupsByScenario: { [scenarioId]: {} } },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];
    const kitaTransition = events.find((event) => event.id === 'auto_transition_kita_child1');
    const schoolTransition = events.find((event) => event.id === 'auto_transition_school_child1');

    expect(kitaTransition?.effectiveDate).toBe('2022-07-15');
    expect(kitaTransition?.metadata?.bookingDeltaHours).toBe(1.5);
    expect(schoolTransition?.effectiveDate).toBe('2026-07-15');
    expect(schoolTransition?.metadata?.bookingDeltaHours).toBe(-1);
  });

  it('suppresses the automatic kita transition when a real group assignment already exists on that date', () => {
    const state = eventReducer(
      undefined,
      refreshAllEvents({
        simScenario: {
          scenarios: [{ id: scenarioId }],
        },
        simData: {
          dataByScenario: {
            [scenarioId]: {
              child1: {
                id: 'child1',
                name: 'Mia',
                type: 'demand',
                dateofbirth: '2020-01-15',
              },
            },
          },
        },
        simBooking: { bookingsByScenario: { [scenarioId]: {} } },
        simGroup: {
          groupsByScenario: {
            [scenarioId]: {
              child1: {
                ga1: {
                  id: 'ga1',
                  start: '2023-01-15',
                  groupId: 'g-kita',
                  groupName: 'Kita Blau',
                  name: 'Mia',
                },
              },
            },
          },
        },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];

    expect(events.some((event) => event.id === 'group_assignment_start_child1_ga1')).toBe(true);
    expect(events.some((event) => event.id === 'auto_transition_kita_child1')).toBe(false);
    expect(events.some((event) => event.id === 'auto_transition_school_child1')).toBe(true);
  });

  it('skips automatic transitions after the child has already left the facility', () => {
    const state = eventReducer(
      undefined,
      refreshAllEvents({
        simScenario: {
          scenarios: [{ id: scenarioId }],
        },
        simData: {
          dataByScenario: {
            [scenarioId]: {
              child2: {
                id: 'child2',
                name: 'Noah',
                type: 'demand',
                dateofbirth: '2020-01-15',
                startdate: '2021-01-01',
                enddate: '2022-12-31',
              },
            },
          },
        },
        simBooking: { bookingsByScenario: { [scenarioId]: {} } },
        simGroup: { groupsByScenario: { [scenarioId]: {} } },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];

    expect(events.some((event) => event.id === 'auto_transition_kita_child2')).toBe(false);
    expect(events.some((event) => event.id === 'auto_transition_school_child2')).toBe(false);
  });
});
