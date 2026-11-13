import React from 'react';
import { Provider } from 'react-redux';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAppStore } from '../store/store';
import { setDataItemOverlay } from '../store/simOverlaySlice';
import { selectForecastEventsAvailable, selectForecastEventsError, setEventEnabled } from '../store/eventSlice';
import { buildForecastFinanceMonth } from '../utils/forecastFinance';
import { useOverlayData } from './useOverlayData';

describe('overlay-aware forecast inputs', () => {
  it('projects inherited automatic transitions in the child scenario and respects event overrides', async () => {
    const store = createAppStore({ preloadedState: {
      simScenario: { scenarios: [{ id: 'base' }, { id: 'child', baseScenarioId: 'base' }], selectedScenarioId: 'child', selectedItems: {} },
      simData: { dataByScenario: { base: { kid: { id: 'kid', type: 'demand', name: 'Mia', dateofbirth: '2023-03-01', startdate: '2024-01-01' } } } },
      simBooking: { bookingsByScenario: {} },
      simGroup: { groupsByScenario: { base: { kid: { a: { id: 'a', groupId: 'nursery', end: '2026-02-28' } } } }, groupDefsByScenario: { base: [{ id: 'nursery', type: 'Krippe' }] } },
      simOverlay: { overlaysByScenario: {} },
    } });
    const wrapper = ({ children }) => React.createElement(Provider, { store }, children);
    const { result } = renderHook(() => useOverlayData(), { wrapper });
    await act(async () => { await Promise.resolve(); });
    expect(store.getState().events._needsRefresh).toBe(false);
    const forecast = () => buildForecastFinanceMonth({
      mode: 'projected', referenceDate: '2026-01-01', monthDate: '2026-03-01',
      dataItems: result.current.getEffectiveDataItems(), bookingsByItem: { kid: {} },
      groupAssignmentsByItem: { kid: result.current.getEffectiveGroupAssignments('kid') },
      groups: result.current.getEffectiveGroupDefs(), events: store.getState().events.eventsByScenario.child,
      groupFeeCatalogs: {},
    });
    expect(forecast().states[0]).toMatchObject({ stage: 'kita', source: 'projected' });
    act(() => store.dispatch(setEventEnabled({ scenarioId: 'child', eventId: 'auto_transition_kita_kid', enabled: false })));
    expect(forecast().states[0]).toMatchObject({ stage: 'unknown', source: 'unknown' });
    expect(store.getState().events.eventsByScenario.base.find(event => event.id === 'auto_transition_kita_kid').enabled).toBe(true);
  });

  it('marks differing forecast and event overlay inputs incomplete without changing existing forecast semantics', async () => {
    const kid = { id: 'kid', type: 'demand', name: 'Mia', dateofbirth: '2023-03-01', startdate: '2024-01-01' };
    const store = createAppStore({ preloadedState: {
      simScenario: { scenarios: [{ id: 'base' }, { id: 'child', baseScenarioId: 'base' }], selectedScenarioId: 'child', selectedItems: {} },
      simData: { dataByScenario: { base: { kid } } },
      simBooking: { bookingsByScenario: { base: { kid: { b: { id: 'b', startdate: '2024-01-01' } } } } },
      simGroup: { groupsByScenario: { base: { kid: { a: { id: 'a', groupId: 'nursery', start: '2024-01-01', end: '2026-02-28' } } } }, groupDefsByScenario: { base: [{ id: 'nursery', type: 'Krippe' }] } },
      simOverlay: { overlaysByScenario: { child: {
        bookings: { kid: { future: { id: 'future', startdate: '2027-01-01' } } },
        groupassignments: { kid: { future: { id: 'future', groupId: 'regular', start: '2027-01-01' } } },
        groupDefs: [{ id: 'regular', type: 'Regelgruppe' }],
      } } },
    } });
    const wrapper = ({ children }) => React.createElement(Provider, { store }, children);
    const { result } = renderHook(() => useOverlayData(), { wrapper });
    await act(async () => { await Promise.resolve(); });

    expect(Object.keys(result.current.getEffectiveBookings('kid'))).toEqual(['future']);
    expect(Object.keys(result.current.getEffectiveGroupAssignments('kid'))).toEqual(['future']);
    expect(result.current.getEffectiveGroupDefs().map(group => group.id)).toEqual(['regular']);
    expect(store.getState().events).toMatchObject({ _needsRefresh: false, _refreshBlocked: false });
    expect(selectForecastEventsAvailable(store.getState(), 'child')).toBe(false);
    expect(selectForecastEventsAvailable(store.getState(), 'base')).toBe(true);
    expect(selectForecastEventsError(store.getState(), 'child')).toContain('Abweichende Overlay-Auflösung');
    const forecast = () => buildForecastFinanceMonth({
      mode: 'projected', referenceDate: '2026-01-01', monthDate: '2026-03-01',
      dataItems: result.current.getEffectiveDataItems(),
      bookingsByItem: { kid: result.current.getEffectiveBookings('kid') },
      groupAssignmentsByItem: { kid: result.current.getEffectiveGroupAssignments('kid') },
      groups: result.current.getEffectiveGroupDefs(), events: store.getState().events.eventsByScenario.child,
      groupFeeCatalogs: {},
    });
    expect(forecast().states[0]).toMatchObject({ stage: 'kita', source: 'projected' });
    await act(async () => {
      store.dispatch(setDataItemOverlay({ scenarioId: 'child', itemId: 'kid', overlayData: { ...kid, dateofbirth: '2024-03-01' } }));
      expect(store.getState().events._needsRefresh).toBe(true);
      await Promise.resolve();
    });
    expect(forecast().states[0]).toMatchObject({ stage: 'unknown', source: 'unknown' });
    expect(selectForecastEventsAvailable(store.getState(), 'child')).toBe(false);
    expect(selectForecastEventsAvailable(store.getState(), 'base')).toBe(true);
  });
});
