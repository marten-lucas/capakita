import { describe, expect, it } from 'vitest';
import eventReducer, { refreshAllEvents } from './eventSlice';

describe('eventSlice automatic transitions', () => {
  const scenarioId = 'scenario-1';

  it('uses data item names for booking and group assignment events when booking/assignment names are missing', () => {
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
                firstName: 'Mia',
                name: 'Sommer',
                type: 'demand',
                dateofbirth: '2020-01-15',
              },
            },
          },
        },
        simBooking: {
          bookingsByScenario: {
            [scenarioId]: {
              child1: {
                b1: {
                  id: 'b1',
                  startdate: '2026-01-01',
                  enddate: '2026-01-31',
                  times: [],
                },
              },
            },
          },
        },
        simGroup: {
          groupsByScenario: {
            [scenarioId]: {
              child1: {
                ga1: {
                  id: 'ga1',
                  start: '2026-01-01',
                  end: '2026-01-31',
                  groupId: 'g1',
                },
              },
            },
          },
        },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];
    const bookingStartEvent = events.find((event) => event.id === 'booking_start_child1_b1');
    const groupStartEvent = events.find((event) => event.id === 'group_assignment_start_child1_ga1');

    expect(bookingStartEvent?.entityName).toBe('Mia Sommer');
    expect(groupStartEvent?.entityName).toBe('Mia Sommer');
    expect(events.some((event) => event.entityName === 'Unbekannt')).toBe(false);
  });

  it('uses configured auto-event timing for kita and Bavarian school-year start for school transitions', () => {
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
    expect(schoolTransition?.effectiveDate).toBe('2026-09-01');
    expect(schoolTransition?.metadata?.bookingDeltaHours).toBe(-1);
  });

  it('applies Bavarian school cutoff and corridor boundaries for auto school transitions', () => {
    const state = eventReducer(
      undefined,
      refreshAllEvents({
        simScenario: {
          scenarios: [{ id: scenarioId }],
        },
        simData: {
          dataByScenario: {
            [scenarioId]: {
              juneChild: {
                id: 'juneChild',
                name: 'June',
                type: 'demand',
                dateofbirth: '2020-06-30',
              },
              julyChild: {
                id: 'julyChild',
                name: 'July',
                type: 'demand',
                dateofbirth: '2020-07-01',
              },
              sepChild: {
                id: 'sepChild',
                name: 'Sep',
                type: 'demand',
                dateofbirth: '2020-09-30',
              },
              octChild: {
                id: 'octChild',
                name: 'Oct',
                type: 'demand',
                dateofbirth: '2020-10-01',
              },
            },
          },
        },
        simBooking: { bookingsByScenario: { [scenarioId]: {} } },
        simGroup: { groupsByScenario: { [scenarioId]: {} } },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];
    const findDate = (id) => events.find((event) => event.id === id)?.effectiveDate;

    expect(findDate('auto_transition_school_juneChild')).toBe('2026-09-01');
    expect(findDate('auto_transition_school_julyChild')).toBe('2026-09-01');
    expect(findDate('auto_transition_school_sepChild')).toBe('2026-09-01');
    expect(findDate('auto_transition_school_octChild')).toBe('2027-09-01');
  });

  it('creates a predicted exit transition when the child has an end date', () => {
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
                startdate: '2021-01-01',
                enddate: '2026-06-30',
              },
            },
          },
        },
        simBooking: { bookingsByScenario: { [scenarioId]: {} } },
        simGroup: { groupsByScenario: { [scenarioId]: {} } },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];
    const exitTransition = events.find((event) => event.id === 'auto_transition_exit_child1');

    expect(exitTransition?.effectiveDate).toBe('2026-06-30');
    expect(exitTransition?.metadata?.targetStage).toBe('exit');
    expect(exitTransition?.metadata?.bookingDeltaHours).toBe(0);
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

  it('does not create booking/group-assignment events for orphan item ids', () => {
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
        simBooking: {
          bookingsByScenario: {
            [scenarioId]: {
              orphan1: {
                b1: {
                  id: 'b1',
                  startdate: '2026-01-01',
                  enddate: '',
                  times: [],
                },
              },
            },
          },
        },
        simGroup: {
          groupsByScenario: {
            [scenarioId]: {
              orphan1: {
                ga1: {
                  id: 'ga1',
                  start: '2026-01-01',
                  end: '',
                  groupId: 'g1',
                },
              },
            },
          },
        },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];
    expect(events.some((event) => String(event.id || '').includes('orphan1'))).toBe(false);
  });
});
