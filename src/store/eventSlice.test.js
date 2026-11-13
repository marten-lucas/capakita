import { describe, expect, it, vi } from 'vitest';
import eventReducer, { clearEventOverridesForScenario, refreshAllEvents, refreshEventsForScenario, selectForecastEventsAvailable, selectForecastEventsError, setEventEnabled } from './eventSlice';
import { createAppStore } from './store';
import { setDataItemOverlay, removeDataItemOverlay, setBookingOverlay, removeBookingOverlay, setGroupAssignmentOverlay } from './simOverlaySlice';
import { updateDataItem } from './simDataSlice';
import { updateScenario } from './simScenarioSlice';

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

  it('projects school entry on September 1 when the source attendance period ends the previous day', () => {
    const state = eventReducer(
      undefined,
      refreshAllEvents({
        simScenario: { scenarios: [{ id: scenarioId }] },
        simData: {
          dataByScenario: {
            [scenarioId]: {
              childBoundary: {
                id: 'childBoundary',
                name: 'Mia',
                type: 'demand',
                dateofbirth: '2020-05-10',
                startdate: '2025-01-01',
                enddate: '2026-08-31',
              },
            },
          },
        },
        simBooking: { bookingsByScenario: { [scenarioId]: {} } },
        simGroup: {
          groupsByScenario: {
            [scenarioId]: {
              childBoundary: {
                assignment: {
                  id: 'assignment',
                  groupId: 'g-regel',
                  start: '2025-01-01',
                  end: '2026-08-31',
                },
              },
            },
          },
        },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];
    const schoolTransition = events.find((event) => event.id === 'auto_transition_school_childBoundary');

    expect(schoolTransition?.effectiveDate).toBe('2026-09-01');
    expect(schoolTransition?.metadata?.targetStage).toBe('school');
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

    expect(exitTransition?.effectiveDate).toBe('2026-07-01');
        expect(exitTransition?.sourceDate).toBe('2026-06-30');
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

  it('keeps an automatic transition when the previous group assignment ends on that date', () => {
    const state = eventReducer(
      undefined,
      refreshAllEvents({
        simScenario: { scenarios: [{ id: scenarioId }] },
        simData: {
          dataByScenario: {
            [scenarioId]: {
              child1: {
                id: 'child1',
                name: 'Mia',
                type: 'demand',
                dateofbirth: '2024-01-15',
                startdate: '2026-01-01',
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
                  groupId: 'g-krippe',
                  groupName: 'Krippe',
                  start: '2026-01-01',
                  end: '2027-01-14',
                },
              },
            },
          },
        },
      })
    );

    const events = state.eventsByScenario[scenarioId] || [];
    const transition = events.find((event) => event.id === 'auto_transition_kita_child1');

    expect(events.some((event) => event.id === 'group_assignment_end_child1_ga1' && event.effectiveDate === '2027-01-15')).toBe(true);
    expect(transition?.effectiveDate).toBe('2027-01-15');
    expect(transition?.metadata?.targetStage).toBe('kita');
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

  it('ends presence, absences, bookings and assignments on the next calendar day, including Saturday', () => {
    const state = eventReducer(undefined, refreshAllEvents({
      simScenario: { scenarios: [{ id: scenarioId }] },
      simData: { dataByScenario: { [scenarioId]: { child: { id: 'child', type: 'demand', name: 'Mia', dateofbirth: '2020-01-01', enddate: '2026-08-28', absences: [{ id: 'a', end: '2026-08-28' }] } } } },
      simBooking: { bookingsByScenario: { [scenarioId]: { child: { b: { id: 'b', enddate: '2026-08-28' } } } } },
      simGroup: { groupsByScenario: { [scenarioId]: { child: { g: { id: 'g', groupId: 'g1', end: '2026-08-28' } } } } },
    }));
    const events = state.eventsByScenario[scenarioId];
    for (const type of ['presence_end', 'absence_end', 'booking_end', 'group_assignment_end']) {
      expect(events.find((event) => event.type === type)?.effectiveDate).toBe('2026-08-29');
    }
  });

  it('uses UI absence boundaries over stale legacy fields when generating events', () => {
    const absences = [
      { id: 'open-end', start: '2026-01-10', end: '', startdate: '2025-01-01', enddate: '2026-02-28' },
      { id: 'open-start', start: '', end: '2026-03-15', startdate: '2025-01-01', enddate: '2025-02-01' },
      { id: 'legacy', startdate: '2026-04-01', enddate: '2026-04-30' },
      { id: 'mixed', start: '2026-05-01', enddate: '2026-05-31' },
      { id: 'open-both', start: '', end: '', startdate: '2025-01-01', enddate: '2025-12-31' },
    ];
    const input = {
      simScenario: { scenarios: [{ id: scenarioId }] },
      simData: { dataByScenario: { [scenarioId]: { staff: { id: 'staff', type: 'capacity', name: 'Anna', absences } } } },
      simBooking: { bookingsByScenario: { [scenarioId]: {} } },
      simGroup: { groupsByScenario: { [scenarioId]: {} } },
    };
    const before = structuredClone(input);
    const events = eventReducer(undefined, refreshAllEvents(input)).eventsByScenario[scenarioId]
      .filter((event) => event.category === 'absence');
    expect(events.map(({ id, effectiveDate, sourceDate }) => ({ id, effectiveDate, sourceDate }))).toEqual(expect.arrayContaining([
      { id: 'absence_start_staff_open-end', effectiveDate: '2026-01-10', sourceDate: '2026-01-10' },
      { id: 'absence_end_staff_open-start', effectiveDate: '2026-03-16', sourceDate: '2026-03-15' },
      { id: 'absence_start_staff_legacy', effectiveDate: '2026-04-01', sourceDate: '2026-04-01' },
      { id: 'absence_end_staff_legacy', effectiveDate: '2026-05-01', sourceDate: '2026-04-30' },
      { id: 'absence_start_staff_mixed', effectiveDate: '2026-05-01', sourceDate: '2026-05-01' },
      { id: 'absence_end_staff_mixed', effectiveDate: '2026-06-01', sourceDate: '2026-05-31' },
    ]));
    expect(events).toHaveLength(6);
    expect(input).toEqual(before);
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

const inheritedState = () => ({
  simScenario: { scenarios: [
    { id: 'base' },
    { id: 'child', baseScenarioId: 'base', autoEventSettings: { kita: { ageYears: 2 } } },
    { id: 'grandchild', baseScenarioId: 'child' },
    { id: 'other' },
  ], selectedScenarioId: 'child', selectedItems: {} },
  simData: { dataByScenario: { base: { kid: { id: 'kid', name: 'Mia', type: 'demand', dateofbirth: '2020-01-15', startdate: '2021-01-01', absences: [{ id: 'a', start: '2021-05-01' }] } } } },
  simBooking: { bookingsByScenario: { base: { kid: { b: { id: 'b', startdate: '2021-01-01', enddate: '2021-12-31' } } } } },
  simGroup: { groupsByScenario: { base: { kid: { g: { id: 'g', groupId: 'one', start: '2021-01-01' } } } }, groupDefsByScenario: {} },
  simOverlay: { overlaysByScenario: {} },
});

const event = (state, scenario, id) => state.eventsByScenario[scenario]?.find(item => item.id === id);

describe('overlay-aware event cache', () => {
  it('resolves inherited items, real events, and scenario-specific settings and overrides', () => {
    const input = inheritedState();
    input.simOverlay.overlaysByScenario.child = {
      dataItems: { kid: { ...input.simData.dataByScenario.base.kid, name: 'Overlay', dateofbirth: '2021-02-01', enddate: '2027-12-31' } },
      bookings: { kid: { b: { id: 'b', startdate: '2022-04-01' } } },
      groupassignments: { kid: { g: { id: 'g', groupId: 'two', start: '2023-02-01' } } },
    };
    let state = eventReducer(undefined, setEventEnabled({ scenarioId: 'child', eventId: 'auto_transition_school_kid', enabled: false }));
    state = eventReducer(state, refreshAllEvents(input));
    expect(event(state, 'base', 'auto_transition_kita_kid')?.effectiveDate).toBe('2023-01-15');
    expect(event(state, 'child', 'presence_start_kid')?.entityName).toBe('Overlay');
    expect(event(state, 'grandchild', 'absence_start_kid_a')?.effectiveDate).toBe('2021-05-01');
    expect(event(state, 'child', 'booking_start_kid_b')?.effectiveDate).toBe('2022-04-01');
    expect(event(state, 'base', 'booking_end_kid_b')?.effectiveDate).toBe('2022-01-01');
    expect(event(state, 'child', 'booking_end_kid_b')).toBeUndefined();
    expect(event(state, 'grandchild', 'group_assignment_start_kid_g')?.metadata.groupId).toBe('two');
    expect(event(state, 'child', 'auto_transition_kita_kid')).toBeUndefined(); // overridden assignment starts on the same day
    expect(event(state, 'grandchild', 'auto_transition_kita_kid')?.effectiveDate).toBe('2024-02-01');
    expect(event(state, 'child', 'auto_transition_school_kid')?.enabled).toBe(false);
    expect(event(state, 'grandchild', 'auto_transition_school_kid')?.enabled).toBe(true);
    expect(event(state, 'child', 'auto_transition_exit_kid')?.effectiveDate).toBe('2028-01-01');
    expect(state.eventsByScenario.other).toEqual([]);
  });

  it('invalidates and coalesces edits across the whole chain, including startup and single refreshes', async () => {
    const store = createAppStore({ preloadedState: { ...inheritedState(), events: {
      eventsByScenario: { child: [{ id: 'stale' }] }, disabledEventIdsByScenario: {}, _needsRefresh: false,
    } } });
    expect(store.getState().events._needsRefresh).toBe(true);
    expect(store.getState().events.eventsByScenario).toEqual({});
    await Promise.resolve();
    expect(event(store.getState().events, 'child', 'auto_transition_school_kid')).toBeDefined();
    store.dispatch(setEventEnabled({ scenarioId: 'child', eventId: 'auto_transition_school_kid', enabled: false }));

    let refreshes = 0;
    const unsubscribe = store.subscribe(() => { if (!store.getState().events._needsRefresh) refreshes += 1; });
    store.dispatch(updateDataItem({ scenarioId: 'base', itemId: 'kid', updates: { dateofbirth: '2022-02-01' } }));
    const overlayKid = { ...store.getState().simData.dataByScenario.base.kid, name: 'Changed', dateofbirth: '2023-02-01' };
    store.dispatch(setDataItemOverlay({ scenarioId: 'child', itemId: 'kid', overlayData: overlayKid }));
    store.dispatch(setBookingOverlay({ scenarioId: 'child', itemId: 'kid', bookingId: 'b', overlayData: { id: 'b', startdate: '2024-01-01' } }));
    store.dispatch(setGroupAssignmentOverlay({ scenarioId: 'child', itemId: 'kid', groupId: 'g', overlayData: { id: 'g', groupId: 'two', start: '2024-01-01' } }));
    expect(store.getState().events._needsRefresh).toBe(true);
    expect(store.getState().events.eventsByScenario).toEqual({});
    const current = store.getState();
    store.dispatch(refreshEventsForScenario({ ...current, scenarioId: 'base' }));
    expect(store.getState().events._needsRefresh).toBe(true);
    expect(store.getState().events.eventsByScenario.grandchild).toBeUndefined();
    await Promise.resolve();
    expect(refreshes).toBe(1);
    expect(store.getState().events._needsRefresh).toBe(false);
    expect(event(store.getState().events, 'base', 'auto_transition_kita_kid')?.effectiveDate).toBe('2025-02-01');
    expect(event(store.getState().events, 'child', 'auto_transition_kita_kid')?.effectiveDate).toBe('2025-02-01');
    expect(event(store.getState().events, 'grandchild', 'auto_transition_kita_kid')?.effectiveDate).toBe('2026-02-01');
    expect(event(store.getState().events, 'grandchild', 'booking_start_kid_b')?.effectiveDate).toBe('2024-01-01');
    expect(event(store.getState().events, 'child', 'auto_transition_school_kid')?.enabled).toBe(false);
    store.dispatch(removeDataItemOverlay({ scenarioId: 'child', itemId: 'kid' }));
    await Promise.resolve();
    expect(event(store.getState().events, 'grandchild', 'auto_transition_kita_kid')?.effectiveDate).toBe('2025-02-01');
    store.dispatch(updateScenario({ scenarioId: 'grandchild', updates: { baseScenarioId: 'other' } }));
    await Promise.resolve();
    expect(store.getState().events.eventsByScenario.grandchild).toEqual([]);
    unsubscribe();
  });

  it('isolates incomplete forecasts to affected scenarios, avoids retry loops, and recovers after removal', async () => {
    const store = createAppStore({ preloadedState: inheritedState() });
    await Promise.resolve();
    store.dispatch(setBookingOverlay({ scenarioId: 'child', itemId: 'kid', bookingId: 'extra', overlayData: { id: 'extra', startdate: '2027-01-01' } }));
    await Promise.resolve();
    expect(store.getState().events).toMatchObject({ _needsRefresh: false, _refreshBlocked: false });
    expect(selectForecastEventsAvailable(store.getState(), 'child')).toBe(false);
    expect(selectForecastEventsAvailable(store.getState(), 'grandchild')).toBe(false);
    expect(selectForecastEventsAvailable(store.getState(), 'base')).toBe(true);
    expect(selectForecastEventsAvailable(store.getState(), 'other')).toBe(true);
    expect(selectForecastEventsError(store.getState(), 'child')).toContain('Abweichende Overlay-Auflösung');
    expect(selectForecastEventsError(store.getState(), 'base')).toBeNull();
    expect(event(store.getState().events, 'child', 'booking_start_kid_b')).toBeDefined();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => { notifications += 1; });
    store.dispatch({ type: 'unrelated' });
    await Promise.resolve();
    expect(notifications).toBe(1);
    store.dispatch(removeBookingOverlay({ scenarioId: 'child', itemId: 'kid', bookingId: 'extra' }));
    await Promise.resolve();
    expect(store.getState().events).toMatchObject({ _needsRefresh: false, _refreshBlocked: false, _refreshError: null });
    expect(selectForecastEventsAvailable(store.getState(), 'child')).toBe(true);
    expect(selectForecastEventsAvailable(store.getState(), 'grandchild')).toBe(true);
    unsubscribe();
  });

  it('invalidates only the reset scenario and rebuilds real and automatic events without affecting other overrides', async () => {
    const store = createAppStore({ preloadedState: inheritedState() });
    await Promise.resolve();
    const realId = 'booking_start_kid_b';
    const autoId = 'auto_transition_school_kid';
    store.dispatch(setEventEnabled({ scenarioId: 'child', eventId: realId, enabled: false }));
    store.dispatch(setEventEnabled({ scenarioId: 'child', eventId: autoId, enabled: false }));
    store.dispatch(setEventEnabled({ scenarioId: 'base', eventId: autoId, enabled: false }));
    expect(event(store.getState().events, 'child', autoId).enabled).toBe(false);
    store.dispatch(clearEventOverridesForScenario({ scenarioId: 'child' }));
    expect(store.getState().events.eventsByScenario.child).toBeUndefined();
    expect(selectForecastEventsAvailable(store.getState(), 'child')).toBe(false);
    expect(selectForecastEventsAvailable(store.getState(), 'base')).toBe(true);
    expect(event(store.getState().events, 'base', autoId).enabled).toBe(false);
    // Toggling an uncached event must not create a fake, apparently fresh empty cache.
    store.dispatch(setEventEnabled({ scenarioId: 'child', eventId: realId, enabled: false }));
    expect(store.getState().events.eventsByScenario.child).toBeUndefined();
    await Promise.resolve();
    expect(event(store.getState().events, 'child', realId).enabled).toBe(false);
    expect(event(store.getState().events, 'child', autoId).enabled).toBe(true);
    expect(event(store.getState().events, 'base', autoId).enabled).toBe(false);
    expect(selectForecastEventsAvailable(store.getState(), 'child')).toBe(true);
    store.dispatch(clearEventOverridesForScenario({ scenarioId: 'child' }));
    await Promise.resolve();
    expect(event(store.getState().events, 'child', realId).enabled).toBe(true);
  });

  it('updates only the refreshed scenario status, including during a global rebuild', () => {
    const input = inheritedState();
    input.simOverlay.overlaysByScenario.child = { bookings: { kid: { extra: { id: 'extra', startdate: '2027-01-01' } } } };
    let state = eventReducer(undefined, refreshAllEvents(input));
    expect(state.statusByScenario.child.state).toBe('incomplete');
    expect(state.statusByScenario.grandchild.state).toBe('incomplete');
    const corrected = { ...input, simOverlay: { overlaysByScenario: {} } };
    state = eventReducer(state, refreshEventsForScenario({ ...corrected, scenarioId: 'child' }));
    expect(state.statusByScenario.child.state).toBe('ready');
    expect(state.statusByScenario.grandchild.state).toBe('incomplete');
    state = eventReducer(state, { type: 'simData/loadDataByScenario', payload: corrected.simData.dataByScenario });
    state = eventReducer(state, refreshEventsForScenario({ ...corrected, scenarioId: 'base' }));
    expect(state._needsRefresh).toBe(true);
    expect(selectForecastEventsAvailable({ events: state }, 'base')).toBe(true);
    expect(selectForecastEventsAvailable({ events: state }, 'child')).toBe(false);
  });

  it('preserves legacy global freshness semantics when per-scenario status is absent', () => {
    const events = { eventsByScenario: { s: [] }, _needsRefresh: false };
    expect(selectForecastEventsAvailable({ events }, 's')).toBe(true);
    expect(selectForecastEventsAvailable({ events: { ...events, _needsRefresh: true } }, 's')).toBe(false);
    expect(selectForecastEventsAvailable({ events }, 'missing')).toBe(false);
  });

  it('isolates broken or cyclic chains without marking them complete', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const input = inheritedState();
      input.simScenario.scenarios[1].baseScenarioId = 'grandchild';
      const store = createAppStore({ preloadedState: input });
      await Promise.resolve();
      expect(store.getState().events._needsRefresh).toBe(false);
      expect(selectForecastEventsError(store.getState(), 'child')).toMatch(/Zyklus.*child/);
      expect(selectForecastEventsAvailable(store.getState(), 'child')).toBe(false);
      expect(selectForecastEventsAvailable(store.getState(), 'grandchild')).toBe(false);
      expect(selectForecastEventsAvailable(store.getState(), 'base')).toBe(true);
      expect(selectForecastEventsAvailable(store.getState(), 'other')).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      input.simScenario.scenarios[1].baseScenarioId = 'missing';
      const state = eventReducer(undefined, refreshAllEvents(input));
      expect(state.statusByScenario.child.error).toMatch(/Basisszenario missing nicht gefunden/);
    } finally {
      spy.mockRestore();
    }
  });
});
